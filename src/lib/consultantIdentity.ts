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

export type ConsultantIdentity = {
  name: string;
  roleTitle: string | null;
  photoUrl: string | null;
  signatureUrl: string | null;
};

/**
 * Build a ConsultantIdentity from an API /api/me response. Accepts the
 * relaxed shape the endpoint returns (nullable everywhere).
 */
export function identityFromMe(me: {
  user: { name: string | null };
  membership: {
    roleTitle: string | null;
    profilePhotoUrl: string | null;
    signatureUrl: string | null;
  } | null;
}): ConsultantIdentity {
  return {
    name: me.user.name?.trim() ?? "",
    roleTitle: me.membership?.roleTitle?.trim() || null,
    photoUrl: me.membership?.profilePhotoUrl?.trim() || null,
    signatureUrl: me.membership?.signatureUrl?.trim() || null,
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
  };
}
