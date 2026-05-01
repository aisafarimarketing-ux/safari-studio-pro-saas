"use client";

import { useState } from "react";
import { useProposalStore } from "@/store/proposalStore";
import { useEditorStore } from "@/store/editorStore";
import { resolveTokens } from "@/lib/theme";
import { uploadImage } from "@/lib/uploadImage";
import { AIWriteButton } from "@/components/editor/AIWriteButton";
import { SignaturePad } from "@/components/editor/SignaturePad";
import { ContactCards } from "@/components/sections/personal-note/ContactCards";
import { EditableOperatorLogoTile } from "@/components/brand/EditableOperatorLogoTile";
import type { Section, Proposal } from "@/lib/types";

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

// Pull first names out of `client.guestNames`. The opener should
// greet by FIRST NAME ONLY — never the surname or full name. Handles
// single-guest, two-guest (& / and / ,), and three+ guest cases.
//   "Sam Kombe"                  → "Sam"
//   "Sam Kombe & Lily Wong"      → "Sam and Lily"
//   "Sam Kombe, Lily Wong"       → "Sam and Lily"
//   "Sam Kombe, Lily, John Doe"  → "Sam, Lily and John"
function extractFirstNames(fullNames: string | undefined): string {
  if (!fullNames) return "";
  const guests = fullNames
    .split(/\s*[,&]\s*|\s+and\s+/i)
    .map((g) => g.trim())
    .filter(Boolean);
  const firstNames = guests
    .map((name) => name.split(/\s+/)[0])
    .filter(Boolean);
  if (firstNames.length === 0) return "";
  if (firstNames.length === 1) return firstNames[0];
  if (firstNames.length === 2) return `${firstNames[0]} and ${firstNames[1]}`;
  return (
    firstNames.slice(0, -1).join(", ") +
    " and " +
    firstNames[firstNames.length - 1]
  );
}

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
    `Good day ${extractFirstNames(client.guestNames) || "there"},`;

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
  const isEditorialImage = section.layoutVariant === "editorial-letter-image";

  // Editorial-letter-image — 60/40 split with a warm safari image on
  // the right. The letter content is the same editable body as
  // branded-letter but the bottom branded contact strip is omitted —
  // contact lives in the new contact-cards footer variant instead.
  if (isEditorialImage) {
    return (
      <EditorialLetterImageVariant
        section={section}
        proposal={proposal}
        body={body}
        signOff={signOff}
        signOffLead={signOffLead}
        opener={opener}
        isEditor={isEditor}
        signaturePadOpen={signaturePadOpen}
        setSignaturePadOpen={setSignaturePadOpen}
        updateSectionContent={updateSectionContent}
        updateOperator={updateOperator}
        pickImageAndSet={pickImageAndSet}
      />
    );
  }

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

      <div className={`mx-auto px-10 md:px-14 pt-10 ${isMinimal ? "max-w-[720px]" : "max-w-[840px]"}`}>
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
          {/* Role title — appears under the name when set. Editable in the editor. */}
          {(operator.consultantRole || isEditor) && (
            <div
              className="mt-0.5 text-[12px] outline-none"
              style={{ color: tokens.mutedText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({ consultantRole: e.currentTarget.textContent?.trim() ?? operator.consultantRole })
              }
            >
              {operator.consultantRole || (isEditor ? "Your role (optional)" : "")}
            </div>
          )}
        </div>
      </div>

      {/* Branded contact strip — wider container so the photo, the
          three contact cards, and the logo all have room to breathe.
          The letter above stays in the narrow editorial column for
          readability; the strip below uses 1200px because it carries
          chrome (icons, photo, logo) rather than prose. */}
      <div
        className="mx-auto px-6 md:px-10 mt-10 pt-8 pb-12 max-w-[1200px]"
        style={{ borderTop: `1px solid ${tokens.border}` }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 md:gap-10">
          {/* Consultant — photo + name stacked vertically. The photo
              still drives the click-to-replace flow; the name sits
              beneath as the editorial signature line. Both auto-
              populate from the user's profile on new proposals via
              applyIdentityToOperator (consultantIdentity.ts). */}
          <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: 96 }}>
            <div
              className="overflow-hidden cursor-pointer w-full"
              style={{ height: 96, background: tokens.cardBg, borderRadius: 4 }}
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
            {/* Name beneath the photo — small caps, editorial. Always
                visible (placeholder hint in editor when blank). */}
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-center leading-tight outline-none w-full"
              style={{ color: tokens.headingText }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateOperator({
                  consultantName: e.currentTarget.textContent?.trim() ?? operator.consultantName,
                })
              }
            >
              {operator.consultantName || (isEditor ? "Your name" : "")}
            </div>
          </div>

          {/* Three contact cards — Phone / Email / WhatsApp. Sit between
              the consultant photo on the left and the company logo on
              the right; in editor mode each card's value is click-to-
              edit and a "Style" affordance on hover lets the operator
              recolour the icon chip + glyph for this proposal. */}
          <ContactCards
            isEditor={isEditor}
            values={{
              phone: operator.phone,
              email: operator.email,
              whatsapp: operator.whatsapp,
            }}
            style={{
              iconBg: section.content.contactIconBg as string | undefined,
              iconColor: section.content.contactIconColor as string | undefined,
              cardBg: section.content.contactCardBg as string | undefined,
            }}
            onValueChange={(next) =>
              updateOperator({
                phone: next.phone ?? "",
                email: next.email ?? "",
                whatsapp: next.whatsapp ?? "",
              })
            }
            onStyleChange={(next) =>
              updateSectionContent(section.id, {
                contactIconBg: next.iconBg,
                contactIconColor: next.iconColor,
                contactCardBg: next.cardBg,
              })
            }
          />

          {/* Company logo — same hover editor as the cover (Replace,
              Remove BG, Reset). `bare` because the logo here sits on
              the section bg directly, not inside a paper tile. */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 92, height: 92 }}
          >
            <EditableOperatorLogoTile
              bare
              isEditor={isEditor}
              logoUrl={operator.logoUrl}
              companyName={operator.companyName}
              logoHeight={68}
              onLogoChange={(url) => updateOperator({ logoUrl: url })}
            />
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

// ─── Editorial-letter-image variant ────────────────────────────────────
//
// Two-column editorial letter:
//   LEFT  (60%) — greeting · body · sign-off · script signature · name/role
//   RIGHT (40%) — warm safari image with rounded corners
//
// Pulls the side image from `section.content.sideImageUrl` if set,
// otherwise falls back to the proposal's cover hero image so the
// operator gets a sensible default the moment they switch to this
// variant. Contact details live in the new contact-cards footer
// variant — this section is purely editorial.

function EditorialLetterImageVariant({
  section, proposal, body, signOff, signOffLead, opener,
  isEditor, signaturePadOpen, setSignaturePadOpen,
  updateSectionContent, updateOperator, pickImageAndSet,
}: {
  section: Section;
  proposal: Proposal;
  body: string;
  signOff: string;
  signOffLead: string;
  opener: string;
  isEditor: boolean;
  signaturePadOpen: boolean;
  setSignaturePadOpen: (open: boolean) => void;
  updateSectionContent: (id: string, patch: Record<string, unknown>) => void;
  updateOperator: (patch: Partial<Proposal["operator"]>) => void;
  pickImageAndSet: (onPicked: (dataUrl: string) => void) => void;
}) {
  const { operator, theme, client, trip } = proposal;
  const tokens = resolveTokens(theme.tokens, section.styleOverrides);

  // Side image — explicit override → cover hero → null (placeholder).
  const explicitSideImage = section.content.sideImageUrl as string | undefined;
  const coverSection = proposal.sections.find((s) => s.type === "cover");
  const coverHero = coverSection?.content?.heroImageUrl as string | undefined;
  const sideImageUrl = explicitSideImage || coverHero || null;

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

      <div className="mx-auto px-6 md:px-12 py-4 md:py-6" style={{ maxWidth: 1140 }}>
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12 items-stretch">
          {/* LEFT — letter */}
          <div className="min-w-0 flex flex-col justify-center">
            {/* Greeting */}
            <div
              className="outline-none font-semibold"
              style={{
                color: tokens.headingText,
                fontFamily: `'${theme.displayFont}', serif`,
                fontSize: "clamp(20px, 2.6vw, 26px)",
                lineHeight: 1.2,
              }}
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) =>
                updateSectionContent(section.id, { opener: e.currentTarget.textContent ?? "" })
              }
            >
              {opener}
            </div>

            {/* Body */}
            <div
              className="mt-5 text-[14.5px] leading-[1.75] whitespace-pre-line outline-none"
              contentEditable={isEditor}
              suppressContentEditableWarning
              data-ai-editable="greeting"
              onBlur={(e) =>
                updateSectionContent(section.id, { body: e.currentTarget.textContent ?? "" })
              }
            >
              {body}
            </div>

            {/* Sign-off lead */}
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

            {/* Signature */}
            <div className="mt-5">
              <div
                className="relative cursor-pointer"
                style={{
                  width: 200,
                  height: 64,
                  display: operator.signatureUrl || isEditor ? "flex" : "none",
                }}
                onClick={() => { if (isEditor) setSignaturePadOpen(true); }}
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

              <div
                className="mt-2 text-[14.5px] font-semibold outline-none"
                style={{ color: tokens.headingText }}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateOperator({ consultantName: e.currentTarget.textContent?.trim() ?? operator.consultantName })
                }
              >
                {operator.consultantName || "Your name"}
              </div>
              {(operator.consultantRole || isEditor) && (
                <div
                  className="mt-0.5 text-[12.5px] outline-none"
                  style={{ color: tokens.mutedText }}
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    updateOperator({ consultantRole: e.currentTarget.textContent?.trim() ?? operator.consultantRole })
                  }
                >
                  {operator.consultantRole || (isEditor ? "Your role (optional)" : "")}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — side image */}
          <div className="min-w-0">
            <div
              className="relative overflow-hidden cursor-pointer"
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: 14,
                background: tokens.cardBg,
                border: `1px solid ${tokens.border}`,
              }}
              onClick={() => {
                if (!isEditor) return;
                pickImageAndSet((u) => updateSectionContent(section.id, { sideImageUrl: u }));
              }}
              onContextMenu={(e) => {
                if (!isEditor) return;
                e.preventDefault();
                pickImageAndSet((u) => updateSectionContent(section.id, { sideImageUrl: u }));
              }}
              title={isEditor ? "Click / right-click to replace image" : undefined}
            >
              {sideImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sideImageUrl} alt="" className="w-full h-full object-cover" />
              ) : isEditor ? (
                <div
                  className="absolute inset-0 flex items-center justify-center text-[11.5px] uppercase tracking-[0.22em]"
                  style={{ color: tokens.mutedText }}
                >
                  ＋ Add image
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Contact strip — three social cards (Phone / Email / WhatsApp).
          Originally this variant punted contact details to the Footer's
          contact-cards variant, but operators reported "icons missing"
          when their proposal sat on this default Personal Note variant
          and they hadn't (or didn't) add a Footer contact-cards section.
          Render the strip in-section so contacts are always visible
          here regardless of footer configuration. The Style picker on
          the cards lets operators recolour to taste. */}
      <div
        className="mx-auto px-6 md:px-12 mt-8 pt-8 pb-10"
        style={{ maxWidth: 1200, borderTop: `1px solid ${tokens.border}` }}
      >
        <ContactCards
          isEditor={isEditor}
          values={{
            phone: operator.phone,
            email: operator.email,
            whatsapp: operator.whatsapp,
          }}
          style={{
            iconBg: section.content.contactIconBg as string | undefined,
            iconColor: section.content.contactIconColor as string | undefined,
            cardBg: section.content.contactCardBg as string | undefined,
          }}
          onValueChange={(next) =>
            updateOperator({
              phone: next.phone ?? "",
              email: next.email ?? "",
              whatsapp: next.whatsapp ?? "",
            })
          }
          onStyleChange={(next) =>
            updateSectionContent(section.id, {
              contactIconBg: next.iconBg,
              contactIconColor: next.iconColor,
              contactCardBg: next.cardBg,
            })
          }
        />
      </div>

      {isEditor && signaturePadOpen && (
        <SignaturePad
          onClose={() => setSignaturePadOpen(false)}
          onSave={(dataUrl) => {
            updateOperator({ signatureUrl: dataUrl });
            setSignaturePadOpen(false);
          }}
        />
      )}
    </div>
  );
}

