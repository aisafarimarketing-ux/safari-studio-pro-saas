"use client";

import { useEffect } from "react";
import { use } from "react";

// /studio/[id] — thin redirector. The editor loads its proposal from
// localStorage rather than a URL param, so this route just stashes the
// id and bounces to /studio where the editor actually lives. Exists so
// request/client detail pages can deep-link to a specific proposal via
// a plain <Link> without 404-ing.

export default function StudioIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    try { localStorage.setItem("activeProposalId", id); } catch {}
    // Full reload — the editor reads localStorage on mount, so a client
    // router.replace wouldn't re-trigger that read. Use replace so back
    // button doesn't land on this stub.
    window.location.replace("/studio");
  }, [id]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[13px] text-black/55"
      style={{ background: "#f8f5ef" }}
    >
      Opening proposal…
    </div>
  );
}
