"use client";

import { useEffect, useState } from "react";

// Small editor-toolbar badge showing the live deploy's commit SHA.
// Fetches /api/version once on mount and caches the result for the
// session. Hover for full info (commit message, branch, uptime).
//
// Existence rationale: deploy state used to be invisible — a build
// could fail on Railway and the user wouldn't know whether their
// edits were running on yesterday's container. The badge makes that
// status legible without leaving the editor.

type VersionInfo = {
  ok: boolean;
  nodeEnv: string;
  uptimeSec: number;
  bootedAt: string;
  railway: {
    commit: string | null;
    branch: string | null;
    message: string | null;
  };
};

export function DeployBadge() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: VersionInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "fetch failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !info) {
    return (
      <span
        className="text-[10px] tabular-nums px-2 py-0.5 rounded text-black/35"
        title={error ? `version unavailable: ${error}` : "loading version…"}
        aria-label="Deploy version"
      >
        {error ? "v ?" : "v …"}
      </span>
    );
  }

  const sha = info.railway.commit ?? "local";
  const upH = Math.floor(info.uptimeSec / 3600);
  const upM = Math.floor((info.uptimeSec % 3600) / 60);
  const uptime = upH > 0 ? `${upH}h ${upM}m` : `${upM}m`;
  // First line of the commit message — strip co-author etc.
  const firstLine = info.railway.message?.split("\n")[0] ?? "";
  const tooltip = [
    `commit · ${sha}`,
    info.railway.branch ? `branch · ${info.railway.branch}` : "",
    firstLine ? `message · ${firstLine}` : "",
    `up · ${uptime}`,
    `booted · ${new Date(info.bootedAt).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <a
      href="/api/version"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] tabular-nums px-2 py-0.5 rounded font-mono transition hover:opacity-80"
      style={{
        color: "rgba(0,0,0,0.45)",
        background: "rgba(27,58,45,0.06)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
      title={tooltip}
      aria-label={`Deployed commit ${sha}`}
    >
      v {sha}
    </a>
  );
}
