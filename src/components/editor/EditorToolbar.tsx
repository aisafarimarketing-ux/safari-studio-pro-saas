"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OrganizationSwitcher,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { BrandDNAHint } from "@/components/brand-dna/BrandDNAHint";
import { CommentsDrawer } from "./CommentsDrawer";
import { ProposalViewsWidget } from "./ProposalViewsWidget";
import { RebuildBudgetDialog } from "./RebuildBudgetDialog";
import { useEditorStore, type EditorView } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { nanoid } from "@/lib/nanoid";
import { recompressProposalImages } from "@/lib/recompressProposalImages";

// ─── Editor toolbar ─────────────────────────────────────────────────────────
//
// Action hierarchy (right-to-left):
//   SHARE          — primary, gold pill. Copies the public link.
//   PREVIEW        — secondary, outline. Switches to preview mode.
//   ⋯ menu         — Copy link · Download PDF · Duplicate.
//   Save indicator — read-only. Auto-save runs in ProposalEditor via
//                    useAutoSaveProposal; this is just the visual state.
//
// Brand DNA hint chip lives in the centre; only renders when Brand DNA is
// incomplete and the user hasn't dismissed it for the session.

type AutoSaveState = "idle" | "saving" | "saved" | "error";
type ShareState = "idle" | "copied" | "error";

export function EditorToolbar({
  autoSaveState,
  autoSaveError,
  lastSavedAt,
}: {
  autoSaveState: AutoSaveState;
  autoSaveError: string | null;
  lastSavedAt: Date | null;
}) {
  const router = useRouter();
  const setMode = useEditorStore((s) => s.setMode);
  const editorView = useEditorStore((s) => s.editorView);
  const setEditorView = useEditorStore((s) => s.setEditorView);
  const { proposal } = useProposalStore();

  const [shareState, setShareState] = useState<ShareState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "rendering" | "error">("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressResult, setCompressResult] = useState<string | null>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);

  // "Proposal is X MB — too big to auto-save" is the signal that the
  // user's saved images exceed the body-size cap. Only that specific
  // error is fixable by re-encoding; others need different handling.
  const isSizeError = Boolean(autoSaveError?.startsWith("Proposal is "));

  const handleCompressImages = async () => {
    setCompressing(true);
    setCompressResult(null);
    try {
      const current = useProposalStore.getState().proposal;
      const result = await recompressProposalImages(current);
      useProposalStore.getState().hydrateProposal(result.proposal);
      const savedMb = ((result.beforeBytes - result.afterBytes) / 1024 / 1024).toFixed(1);
      setCompressResult(
        result.recompressedCount > 0
          ? `Compressed ${result.recompressedCount} image${result.recompressedCount === 1 ? "" : "s"} · saved ${savedMb}MB. Auto-save will retry.`
          : "No oversized images found. Try removing a few images manually.",
      );
    } catch (err) {
      setCompressResult(err instanceof Error ? err.message : "Compression failed");
    } finally {
      setCompressing(false);
    }
  };
  const [pdfConfigDialog, setPdfConfigDialog] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });

  // ── Share (= Copy link, with primary affordance) ──
  // Side effect: notifies the server so it can flip Proposal.status from
  // "draft" → "sent" on first share and fire the GHL `proposal_sent`
  // workflow. Fire-and-forget — clipboard copy never waits on this.
  const handleShare = async () => {
    const id = useProposalStore.getState().proposal.id;
    const url = `${window.location.origin}/p/${id}`;
    void fetch(`/api/proposals/${id}/share`, { method: "POST" }).catch(() => {});
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2200);
    } catch {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2200);
    }
  };

  // ── PDF export — calls the server-side render endpoint backed by the
  // Playwright pdf-service sidecar. On 503 (sidecar not configured) we
  // open the dedicated /p/[id]/print route in a new tab so the user gets
  // a chrome-free magazine layout and can use the browser's native
  // print-to-PDF. We explicitly tell them why instead of silently
  // falling back to a broken `window.print()` on the editor DOM.
  const handleDownloadPDF = async () => {
    setMenuOpen(false);
    if (pdfState === "rendering") return;
    setPdfState("rendering");
    setPdfError(null);
    const id = useProposalStore.getState().proposal.id;
    const title = useProposalStore.getState().proposal.metadata.title || "proposal";
    try {
      const res = await fetch(`/api/proposals/${id}/pdf`, { method: "POST" });
      if (res.status === 503) {
        // Server doesn't have the renderer configured yet — open the clean
        // print view in a new tab so the user can "Save as PDF" via the
        // browser. Show a clear explanation; never silently redirect.
        const data = await res.json().catch(() => ({}));
        setPdfConfigDialog({
          open: true,
          message:
            data?.error ||
            "The high-fidelity PDF renderer isn't configured on this deployment.",
        });
        setPdfState("idle");
        return;
      }
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9._-]+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfState("idle");
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF export failed");
      setPdfState("error");
      setTimeout(() => setPdfState("idle"), 4000);
    }
  };

  // Opens the clean print view in a new tab and auto-triggers print. The
  // print page sets window.__SS_READY__ once hydrated so we can wait for it.
  const openPrintView = () => {
    const id = useProposalStore.getState().proposal.id;
    const win = window.open(`/p/${id}/print?autoPrint=1`, "_blank");
    // Fallback if popup is blocked.
    if (!win) {
      window.location.href = `/p/${id}/print?autoPrint=1`;
    }
    setPdfConfigDialog({ open: false, message: "" });
  };

  // ── Duplicate proposal ──
  const handleDuplicate = async () => {
    if (duplicating) return;
    setMenuOpen(false);
    setDuplicating(true);
    try {
      const current = useProposalStore.getState().proposal;
      const copy = {
        ...current,
        id: nanoid(),
        metadata: {
          ...current.metadata,
          title: `${current.metadata.title} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: copy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.setItem("activeProposalId", copy.id); } catch {}
      router.push("/studio");
      // Force a fresh load of the new proposal id
      setTimeout(() => window.location.reload(), 50);
    } catch (err) {
      console.error("[Duplicate] failed:", err);
      // Duplicate failures are rare and the router.push is aborted above
      // when the fetch throws. Surface via console; no dedicated UI state.
    } finally {
      setDuplicating(false);
    }
  };

  // ── Preview ──
  const handlePreview = () => setMode("preview");

  return (
    <div className="h-13 border-b border-black/10 bg-white flex items-center justify-between px-4 shrink-0 gap-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {/* Left: breadcrumb + editable title */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="text-sm text-black/40 hover:text-black/70 transition shrink-0"
        >
          ← Dashboard
        </Link>
        <span className="text-black/15" aria-hidden>/</span>
        <div
          className="text-sm font-semibold text-black/80 outline-none truncate max-w-[320px]"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const v = e.currentTarget.textContent?.trim();
            if (v) useProposalStore.getState().updateMetadata(v);
          }}
        >
          {proposal.metadata.title}
        </div>
      </div>

      {/* Centre: 3-mode editor view switch — Edit / Structure / Style.
          Edit hides both panels (canvas dominates). Structure expands
          the left sidebar for section reordering. Style slides the
          right panel in for theme controls. The Brand DNA hint chip
          tucks below at smaller widths so the switch stays the focal
          centre. */}
      <div className="hidden md:flex items-center gap-3 shrink-0 min-w-0 mx-2">
        <EditorViewSwitch view={editorView} onChange={setEditorView} />
        <div className="hidden xl:flex items-center">
          <BrandDNAHint />
        </div>
      </div>

      {/* Right: action stack — Save indicator · Comments · ⋯ · Preview · SHARE */}
      <div className="flex items-center gap-2 shrink-0">
        <AutoSaveIndicator state={autoSaveState} error={autoSaveError} lastSavedAt={lastSavedAt} />

        <ProposalViewsWidget proposalId={proposal.id} />

        <CommentsDrawer proposalId={proposal.id} />

        <ActionsMenu
          open={menuOpen}
          setOpen={setMenuOpen}
          onCopyLink={handleShare}
          onPreview={handlePreview}
          onRebuildBudget={() => setRebuildOpen(true)}
          onDownloadPDF={handleDownloadPDF}
          pdfState={pdfState}
          onDuplicate={handleDuplicate}
          duplicating={duplicating}
        />

        {/* Preview — outline button, visible. Promoted out of the ⋯
            menu per spec so the path to "see it as a guest will" is
            one click. */}
        <button
          onClick={handlePreview}
          className="hidden md:inline-flex items-center px-3.5 py-1.5 text-sm rounded-lg transition active:scale-95 font-medium border border-black/12 text-black/75 hover:bg-black/[0.03]"
          title="Preview as a guest"
        >
          Preview
        </button>

        <button
          onClick={handleShare}
          className={`px-4 py-1.5 text-sm rounded-lg transition active:scale-95 font-semibold ${
            shareState === "copied"
              ? "bg-[#2d5a40] text-white"
              : shareState === "error"
                ? "bg-[#b34334] text-white"
                : "text-[#1b3a2d] hover:brightness-110"
          }`}
          style={
            shareState === "idle"
              ? { background: "#c9a84c" }
              : undefined
          }
          title="Copy shareable link"
        >
          {shareState === "copied" && "Link copied ✓"}
          {shareState === "error" && "Copy failed"}
          {shareState === "idle" && "Share"}
        </button>

        <UserMenuSlot />
      </div>

      {autoSaveState === "error" && autoSaveError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#b34334] text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
          <div className="text-lg leading-none">⚠</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Auto-save failed</div>
            <div className="text-[13px] text-white/85 mt-0.5 break-words">
              {autoSaveError} — your next change will retry automatically.
            </div>
            {isSizeError && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={handleCompressImages}
                  disabled={compressing}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-white text-[#b34334] hover:bg-white/90 disabled:opacity-60 disabled:cursor-wait transition"
                >
                  {compressing ? "Compressing images…" : "Compress existing images"}
                </button>
                {compressResult && (
                  <div className="mt-1.5 text-[11.5px] text-white/85 break-words">
                    {compressResult}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {pdfState === "error" && pdfError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#b34334] text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
          <div className="text-lg leading-none">⚠</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">PDF export failed</div>
            <div className="text-[13px] text-white/85 mt-0.5 break-words">{pdfError}</div>
          </div>
        </div>
      )}

      <PDFConfigDialog
        open={pdfConfigDialog.open}
        message={pdfConfigDialog.message}
        onClose={() => setPdfConfigDialog({ open: false, message: "" })}
        onUsePrintView={openPrintView}
      />

      <RebuildBudgetDialog
        open={rebuildOpen}
        onClose={() => setRebuildOpen(false)}
      />
    </div>
  );
}

// ─── Editor view switch — Edit / Structure / Style ─────────────────────────
//
// Segmented control. The selected pill carries the forest-green
// background; the others sit on a soft sand track that matches the
// closing/footer brand language. Centered between the breadcrumb (left)
// and the action stack (right) so it reads as the primary navigation
// of the editor surface.

function EditorViewSwitch({
  view,
  onChange,
}: {
  view: EditorView;
  onChange: (view: EditorView) => void;
}) {
  const items: { key: EditorView; label: string }[] = [
    { key: "edit", label: "Edit" },
    { key: "structure", label: "Structure" },
    { key: "style", label: "Style" },
  ];
  return (
    <div
      className="inline-flex items-center p-0.5 rounded-full"
      style={{
        background: "rgba(13,38,32,0.05)",
        border: "1px solid rgba(13,38,32,0.06)",
      }}
      role="tablist"
      aria-label="Editor view"
    >
      {items.map((it) => {
        const active = view === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className="text-[12px] font-semibold px-3.5 py-1 rounded-full transition"
            style={{
              background: active ? "#1b3a2d" : "transparent",
              color: active ? "white" : "rgba(13,38,32,0.65)",
              boxShadow: active ? "0 1px 2px rgba(13,38,32,0.18)" : "none",
              letterSpacing: "0.01em",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Auto-save indicator — read-only status chip ───────────────────────────

function AutoSaveIndicator({
  state,
  error,
  lastSavedAt,
}: {
  state: AutoSaveState;
  error: string | null;
  lastSavedAt: Date | null;
}) {
  const label =
    state === "saving"
      ? "Saving…"
      : state === "error"
        ? "Save failed"
        : state === "saved"
          ? "Saved just now"
          : lastSavedAt
            ? `Saved ${formatRelative(lastSavedAt)}`
            : "All changes saved";
  const color =
    state === "error" ? "text-[#b34334]" : state === "saved" ? "text-[#1b3a2d]" : "text-black/45";
  return (
    <span
      className={`px-2 py-1 text-[12px] font-medium tabular-nums ${color}`}
      title={state === "error" && error ? `Auto-save failed: ${error}` : undefined}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function formatRelative(d: Date): string {
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Actions menu ──────────────────────────────────────────────────────────

function ActionsMenu({
  open,
  setOpen,
  onCopyLink,
  onPreview,
  onRebuildBudget,
  onDownloadPDF,
  pdfState,
  onDuplicate,
  duplicating,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCopyLink: () => void;
  onPreview: () => void;
  onRebuildBudget: () => void;
  onDownloadPDF: () => void;
  pdfState: "idle" | "rendering" | "error";
  onDuplicate: () => void;
  duplicating: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-9 h-8 flex items-center justify-center rounded-lg border border-black/12 text-black/55 hover:bg-black/5 transition"
        aria-label="More actions"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-black/10 rounded-xl shadow-xl py-1 ss-popover-in">
          <MenuItem
            onClick={() => { setOpen(false); onRebuildBudget(); }}
            accent
          >
            <span className="flex items-center justify-between gap-2">
              <span>Rebuild to a budget…</span>
              <span className="text-[9.5px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.2)", color: "#8a7125" }}>AI</span>
            </span>
          </MenuItem>
          <div className="my-1 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }} />
          <MenuItem onClick={() => { setOpen(false); onPreview(); }}>Preview</MenuItem>
          <MenuItem onClick={() => { setOpen(false); onCopyLink(); }}>Copy link</MenuItem>
          <MenuItem onClick={onDownloadPDF} disabled={pdfState === "rendering"}>
            {pdfState === "rendering" ? "Rendering PDF…" : pdfState === "error" ? "PDF failed — retry" : "Download PDF"}
          </MenuItem>
          <MenuItem onClick={onDuplicate} disabled={duplicating}>
            {duplicating ? "Duplicating…" : "Duplicate"}
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  accent,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
        accent
          ? "font-semibold text-[#1b3a2d] hover:bg-[rgba(201,168,76,0.1)]"
          : "text-black/75 hover:bg-black/[0.04]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── User menu slot — kept from the previous toolbar so the avatar
// behaviour and SignedOut fallback are unchanged.

function UserMenuSlot() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="ml-1 pl-2 border-l border-black/10 flex items-center min-w-[40px] justify-center">
        <div className="w-8 h-8 rounded-full bg-black/10 animate-pulse" />
      </div>
    );
  }
  if (!isSignedIn) {
    return (
      <div className="ml-1 pl-2 border-l border-black/10 flex items-center min-w-[40px] justify-center">
        <Link
          href="/sign-in"
          className="px-3 py-1.5 text-sm rounded-lg border border-black/12 text-black/60 hover:bg-black/5 transition"
        >
          Sign in
        </Link>
      </div>
    );
  }
  const initials = (
    (user?.firstName?.[0] ?? "") +
    (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
  ).toUpperCase();
  return (
    <div className="ml-1 pl-2 border-l border-black/10 flex items-center gap-2 min-w-[40px]">
      <OrganizationSwitcher
        hidePersonal
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
        afterLeaveOrganizationUrl="/select-organization"
        appearance={{
          elements: {
            organizationSwitcherTrigger: {
              padding: "4px 10px",
              borderRadius: "0.5rem",
              fontSize: "13px",
              maxWidth: "160px",
            },
            organizationSwitcherPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
            organizationSwitcherPopoverRootBox: { zIndex: 9999 },
          },
        }}
      />
      <div className="relative w-8 h-8">
        <SignOutButton redirectUrl="/">
          <button
            type="button"
            className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#1b3a2d] hover:bg-[#2d5a40] transition"
            title={`Sign out (${user?.primaryEmailAddress?.emailAddress ?? ""})`}
            aria-label="Sign out"
          >
            {initials || "•"}
          </button>
        </SignOutButton>
        <div className="absolute inset-0">
          <UserButton
            appearance={{
              elements: {
                rootBox: { width: "2rem", height: "2rem" },
                avatarBox: { width: "2rem", height: "2rem" },
                userButtonTrigger: { pointerEvents: "auto" },
                userButtonPopoverCard: { zIndex: 9999, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
                userButtonPopoverRootBox: { zIndex: 9999 },
                userButtonPopoverMain: { zIndex: 9999 },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── PDF service config dialog ─────────────────────────────────────────────

function PDFConfigDialog({
  open,
  message,
  onClose,
  onUsePrintView,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
  onUsePrintView: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 ss-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg ss-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 py-6">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#1b3a2d] mb-2">
            PDF export
          </div>
          <h3 className="text-xl font-bold tracking-tight text-black/85">
            High-fidelity renderer not deployed
          </h3>
          <p className="mt-3 text-[14px] text-black/65 leading-relaxed">
            {message}
          </p>
          <div className="mt-5 rounded-xl border border-black/10 bg-black/[0.02] p-4 space-y-2">
            <div className="text-[12px] font-semibold text-black/75">To enable Download PDF:</div>
            <ol className="text-[13px] text-black/65 list-decimal pl-5 space-y-1">
              <li>Deploy <code className="font-mono text-[12px] bg-black/[0.05] px-1 rounded">pdf-service/</code> as a separate Railway service.</li>
              <li>On the main app, set <code className="font-mono text-[12px] bg-black/[0.05] px-1 rounded">PDF_RENDER_URL</code>, <code className="font-mono text-[12px] bg-black/[0.05] px-1 rounded">PDF_SHARED_SECRET</code>, and <code className="font-mono text-[12px] bg-black/[0.05] px-1 rounded">PUBLIC_BASE_URL</code>.</li>
              <li>Redeploy.</li>
            </ol>
          </div>
          <div className="mt-5 text-[13px] text-black/60 leading-relaxed">
            <strong className="text-black/75">For now:</strong> open the clean print view in a new tab and use your browser&apos;s <em>Print → Save as PDF</em>. The print page is already magazine-quality — chrome-free, A4-paginated, with print-specific typography.
          </div>
        </div>
        <div className="px-7 py-4 border-t border-black/8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-black/60 hover:bg-black/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUsePrintView}
            className="px-4 py-2 text-sm rounded-lg bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] transition"
          >
            Open print view →
          </button>
        </div>
      </div>
    </div>
  );
}
