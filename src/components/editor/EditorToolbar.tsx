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
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import { nanoid } from "@/lib/nanoid";

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
  const { setMode } = useEditorStore();
  const { proposal } = useProposalStore();

  const [shareState, setShareState] = useState<ShareState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "rendering" | "error">("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);

  // ── Share (= Copy link, with primary affordance) ──
  const handleShare = async () => {
    const id = useProposalStore.getState().proposal.id;
    const url = `${window.location.origin}/p/${id}`;
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
  // Playwright pdf-service sidecar. Falls back to the browser's native
  // print dialog when the service isn't configured (HTTP 503 with code
  // PDF_NOT_CONFIGURED) so you always have a path to a PDF.
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
        // Server doesn't have the renderer configured yet — fall back to
        // browser print so the user is never stuck.
        const data = await res.json().catch(() => ({}));
        console.warn("[pdf] service not configured, falling back to print:", data?.error);
        setMode("preview");
        setTimeout(() => {
          window.print();
          setTimeout(() => setMode("editor"), 600);
          setPdfState("idle");
        }, 300);
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

      {/* Centre: Brand DNA hint (non-blocking, dismissible) */}
      <div className="hidden lg:flex items-center shrink-0 min-w-0 mx-2">
        <BrandDNAHint />
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
          onDownloadPDF={handleDownloadPDF}
          pdfState={pdfState}
          onDuplicate={handleDuplicate}
          duplicating={duplicating}
        />

        <button
          onClick={handlePreview}
          className="px-3.5 py-1.5 text-sm border border-black/12 rounded-lg hover:bg-black/5 text-black/65 transition active:scale-95"
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
  onDownloadPDF,
  pdfState,
  onDuplicate,
  duplicating,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCopyLink: () => void;
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
        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border border-black/10 rounded-xl shadow-xl py-1 ss-popover-in">
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
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 text-sm text-black/75 hover:bg-black/[0.04] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
