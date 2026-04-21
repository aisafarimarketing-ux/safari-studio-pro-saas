"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import { SignaturePad } from "@/components/editor/SignaturePad";
import type { Section } from "@/lib/types";

// Personal Note — a branded letter from the consultant. Renders under every
// cover variant as the default, so the person and company crafting the
// proposal always have a recognisable signature block regardless of which
// cover the operator picked.
//
// Three editable zones:
//   1. Greeting body — opener, paragraphs, sign-off preamble + "Best regards,"
//   2. Signature pad — click-to-sign canvas, writes to operator.signatureUrl
//   3. Branded contact footer — logo, company name, phone, email + consultant photo
//
// Every text field is contentEditable and wired to the right store slice.
// Every image slot is click-to-upload / right-click-to-replace.

export function PersonalNoteSection({ section }: { section: Section }) {
  const { proposal, updateSectionContent, updateOperator } = useProposalStore();
  const { mode } = useEditorStore();
  const isEditor = mode === "editor";
  const { operator, client, trip, theme } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);

  const body =
    (section.content.body as string) ||
    "Thank you very much for your interest in doing a safari with us.\n\nPlease review the day-by-day itinerary and let me know your thoughts and feedback. I would be delighted to tailor the trip further to accommodate your personal preferences.";
  const signOffLead =
    (section.content.signOffLead as string) ||
    "Thanks again and I remain at your full disposal!";
  const signOff = (section.content.signOff as string) || "Best regards,";
  const opener =
    (section.content.opener as string) ||
    `Good day ${client.guestNames?.split(/[,&]|and/)[0]?.trim() || "there"},`;

  const pickImageAndSet = (onPicked: (dataUrl: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await uploadImage(file);
        onPicked(dataUrl);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Image upload failed");
      }
    };
    input.click();
  };

  const isMinimal = section.layoutVariant === "minimal";

  return (
    <div
      className="relative"
      style={{ background: tokens.sectionSurface, color: tokens.bodyText }}
    >
      {isEditor && (
        <div className="absolute top-14 right-4 z-[35]">
          <AIWriteButton
            kind="greeting"
            currentText={body}
            context={{
              clientName: client.guestNames,
              consultantName: operator.consultantName,
              destinations: trip.destinations,
              nights: trip.nights,
              dates: trip.dates,
              tripStyle: trip.tripStyle,
            }}
            onResult={(text) => updateSectionContent(section.id, { body: text })}
            compact
          />
        </div>
      )}

      <div className={`mx-auto px-10 md:px-14 py-14 ${isMinimal ? "max-w-[720px]" : "max-w-[840px]"}`}>
        {/* Greeting body */}
        <div
          className="text-[15px] font-semibold mb-3 outline-none"
          style={{ color: tokens.headingText }}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updateSectionContent(section.id, { opener: e.currentTarget.textContent ?? "" })
          }
        >
          {opener}
        </div>

        <div
          className="text-[14.5px] leading-[1.75] whitespace-pre-line outline-none"
          contentEditable={isEditor}
          suppressContentEditableWarning
          data-ai-editable="greeting"
          onBlur={(e) =>
            updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })
          }
        >
          {body}
        </div>

        <div
          className="mt-6 text-[14.5px] leading-[1.75] outline-none"
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updateSectionContent(section.id, { signOffLead: e.currentTarget.textContent ?? "" })
          }
        >
          {signOffLead}
        </div>

        <div
          className="mt-1 text-[14.5px] leading-[1.75] outline-none"
          contentEditable={isEditor}
          suppressContentEditableWarning
          onBlur={(e) =>
            updateSectionContent(section.id, { signOff: e.currentTarget.textContent ?? "" })
          }
        >
          {signOff}
        </div>

        {/* Signature pad */}
        <div className="mt-5">
          <div
            className="relative cursor-pointer"
            style={{
              width: 200,
              height: 64,
              display: operator.signatureUrl || isEditor ? "flex" : "none",
            }}
            onClick={() => {
              if (isEditor) setSignaturePadOpen(true);
            }}
            title={isEditor ? "Click to sign" : undefined}
          >
            {operator.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operator.signatureUrl}
                alt="Signature"
                className="max-h-full max-w-full object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
            ) : isEditor ? (
              <div
                className="text-[11px] uppercase tracking-[0.22em] flex items-center justify-center w-full h-full"
                style={{
                  color: tokens.mutedText,
                  border: `1px dashed ${tokens.border}`,
                  borderRadius: 4,
                }}
              >
                ✎ Click to sign
              </div>
            ) : null}
          </div>

          {/* Consultant name — editable */}
          <div
            className="mt-2 text-[14.5px] font-medium outline-none"
            style={{ color: tokens.headingText }}
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) =>
              updateOperator({ consultantName: e.currentTarget.textContent?.trim() ?? operator.consultantName })
            }
          >
            {operator.consultantName || "Your name"}
          </div>
        </div>

        {/* Branded contact strip — logo · company info · consultant photo */}
        <div
          className="mt-10 pt-8 grid grid-cols-[auto_1fr_auto] items-center gap-6"
          style={{ borderTop: `1px solid ${tokens.border}` }}
        >
          {/* Company logo */}
          <div
            className="shrink-0 flex items-center justify-center cursor-pointer"
            style={{ width: 92, height: 92 }}
            onClick={() => {
              if (isEditor) pickImageAndSet((u) => updateOperator({ logoUrl: u }));
            }}
            onContextMenu={(e) => {
              if (!isEditor) return;
              e.preventDefault();
              pickImageAndSet((u) => updateOperator({ logoUrl: u }));
            }}
            title={isEditor ? "Click / right-click to replace logo" : undefined}
          >
            {operator.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operator.logoUrl}
                alt={operator.companyName}
                className="max-w-full max-h-full object-contain"
              />
            ) : isEditor ? (
              <div
                className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.22em] text-center"
                style={{
                  color: tokens.mutedText,
                  border: `1px dashed ${tokens.border}`,
                  borderRadius: 4,
                }}
              >
                + Logo
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-[11px] uppercase tracking-[0.28em] font-semibold text-center"
                style={{ color: tokens.headingText }}
              >
                {operator.companyName}
              </div>
            )}
          </div>

          {/* Company + consultant contact */}
          <div className="min-w-0 space-y-0.5" style={{ color: tokens.bodyText }}>
            <div
              className="text-[15px] font-semibold outline-none"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({ companyName: e.currentTarget.textContent?.trim() ?? operator.companyName })
              }
            >
              {operator.companyName}
            </div>
            <div
              className="text-[13px] outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({ phone: e.currentTarget.textContent?.trim() ?? operator.phone })
              }
            >
              {operator.phone || (isEditor ? "Phone" : "")}
            </div>
            <div
              className="text-[13px] outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({ email: e.currentTarget.textContent?.trim() ?? operator.email })
              }
            >
              {operator.email || (isEditor ? "Email" : "")}
            </div>
          </div>

          {/* Consultant photo */}
          <div
            className="shrink-0 overflow-hidden cursor-pointer"
            style={{ width: 72, height: 72, background: tokens.cardBg, borderRadius: 4 }}
            onClick={() => {
              if (isEditor) pickImageAndSet((u) => updateOperator({ consultantPhoto: u }));
            }}
            onContextMenu={(e) => {
              if (!isEditor) return;
              e.preventDefault();
              pickImageAndSet((u) => updateOperator({ consultantPhoto: u }));
            }}
            title={isEditor ? "Click / right-click to replace photo" : undefined}
          >
            {operator.consultantPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operator.consultantPhoto}
                alt={operator.consultantName}
                className="w-full h-full object-cover"
              />
            ) : isEditor ? (
              <div
                className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.22em] text-center"
                style={{ color: tokens.mutedText }}
              >
                + Photo
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold"
                style={{ color: tokens.accent }}
              >
                {operator.consultantName?.charAt(0) ?? "·"}
              </div>
            )}
          </div>
        </div>
      </div>

      {signaturePadOpen && (
        <SignaturePad
          initial={operator.signatureUrl ?? null}
          onSave={(dataUrl) => updateOperator({ signatureUrl: dataUrl })}
          onClose={() => setSignaturePadOpen(false)}
        />
      )}
    </div>
  );
}
