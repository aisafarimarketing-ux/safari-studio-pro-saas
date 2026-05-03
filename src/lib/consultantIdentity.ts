import type { OperatorProfile } from "@/lib/types";

// ─── Consultant identity ────────────────────────────────────────────────────
//
// A per-user identity bundle — name + role + photo + signature — that
// gets stamped onto a proposal's operator fields at creation time so
// every draft carries its author's brand, not just the org's generic
// company card.
//
// Applied at CREATE only. Opening an existing proposal doesn't rewrite
// the identity — the author who drafted it owns the signature.

// Always produce a polished display name. Used at every "create
// proposal" boundary so the consultant signature never falls back to
// raw email.
//
// Resolution order:
//   1. A real name from the Clerk profile (firstName + lastName).
//   2. The email's local-part, capitalised ("collins@example.com" →
//      "Collins"). Friendly enough for a default; the operator can
//      edit it in Settings.
//   3. The literal "Consultant" as a last resort.
//
// Also auto-heals rows where `name` was previously seeded with the
// email itself (legacy bug fixed in lib/currentUser.ts) — if name
// contains an "@" we treat it as missing and fall through to the
// local-part path.

export function friendlyConsultantName(input: {
  name: string | null | undefined;
  email: string | null | undefined;
}): string {
  const rawName = input.name?.trim() || "";
  // Auto-heal: legacy rows where User.name === User.email shouldn't
  // surface as "name". An "@" in the name is the giveaway.
  const looksLikeEmail = rawName.includes("@");
  if (rawName && !looksLikeEmail) return rawName;

  const email = input.email?.trim() || "";
  const local = email.split("@")[0]?.trim() ?? "";
  if (local) {
    // Replace separators with spaces and title-case each word.
    // "collins.kitui" / "collins_kitui" / "collins-kitui" → "Collins Kitui".
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return "Consultant";
}

export type ConsultantIdentity = {
  name: string;
  email: string | null;
  roleTitle: string | null;
  photoUrl: string | null;
  signatureUrl: string | null;
  whatsapp: string | null;
};

/**
 * Build a ConsultantIdentity from an API /api/me response. Accepts the
 * relaxed shape the endpoint returns (nullable everywhere). The name is
 * funnelled through friendlyConsultantName so the consultant always has
 * a polished display string, never raw email.
 */
export function identityFromMe(me: {
  user: { name: string | null; email?: string | null };
  membership: {
    roleTitle: string | null;
    profilePhotoUrl: string | null;
    signatureUrl: string | null;
    whatsapp?: string | null;
  } | null;
}): ConsultantIdentity {
  return {
    name: friendlyConsultantName({ name: me.user.name, email: me.user.email }),
    email: me.user.email?.trim() || null,
    roleTitle: me.membership?.roleTitle?.trim() || null,
    photoUrl: me.membership?.profilePhotoUrl?.trim() || null,
    signatureUrl: me.membership?.signatureUrl?.trim() || null,
    whatsapp: me.membership?.whatsapp?.trim() || null,
  };
}

/**
 * Overlay identity onto a proposal's operator block. Never overwrites
 * non-empty existing fields — if the operator explicitly edited one,
 * their edit wins. Never wipes; only fills gaps.
 */
export function applyIdentityToOperator(
  operator: OperatorProfile,
  identity: ConsultantIdentity,
): OperatorProfile {
  return {
    ...operator,
    consultantName: identity.name || operator.consultantName,
    consultantPhoto: operator.consultantPhoto || identity.photoUrl || undefined,
    consultantRole: operator.consultantRole || identity.roleTitle || undefined,
    signatureUrl: operator.signatureUrl || identity.signatureUrl || undefined,
    email: operator.email || identity.email || operator.email,
    whatsapp: operator.whatsapp || identity.whatsapp || operator.whatsapp,
  };
}
