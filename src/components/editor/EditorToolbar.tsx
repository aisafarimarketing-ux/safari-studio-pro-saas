"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEditorStore } from "@/store/editorStore";
import { useProposalStore } from "@/store/proposalStore";
import type { EditorMode } from "@/store/editorStore";

export function EditorToolbar() {
  const { mode, setMode, openNewProposal } = useEditorStore();
  const { proposal } = useProposalStore();
  const [aiBusy, setAiBusy] = useState(false);

  const handleAIGenerate = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "title",
          context: {
            client: proposal.client,
            trip: proposal.trip,
            currentTitle: proposal.metadata.title,
          },
        }),
      });
      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }
      const data = await res.json();
      if (data?.text) useProposalStore.getState().updateMetadata(String(data.text).trim());
    } catch (err) {
      console.error("[AI] generate failed:", err);
    } finally {
      setAiBusy(false);
    }
  };

  const handlePrint = () => {
    // Switch to preview mode to strip all editor chrome before printing
    setMode("preview");
    setTimeout(() => {
      window.print();
      setTimeout(() => setMode("editor"), 600);
    }, 300);
  };

  const modes: { id: EditorMode; label: string }[] = [
    { id: "editor", label: "Edit" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="h-13 border-b border-black/10 bg-white flex items-center justify-between px-4 shrink-0 gap-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="text-sm text-black/35 hover:text-black/60 transition shrink-0"
        >
          ← Home
        </Link>
        <span className="text-black/15">|</span>

        {/* Logo mark */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#c9a84c] font-bold text-sm shrink-0"
          style={{ background: "rgba(201,168,76,0.15)" }}
        >
          S
        </div>

        {/* Proposal title — editable */}
        <div
          className="text-sm font-semibold text-black/70 outline-none truncate max-w-[180px]"
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

      {/* Center: mode switch */}
      <div className="flex items-center gap-0.5 bg-black/6 rounded-lg p-0.5 shrink-0">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 active:scale-95 ${
              mode === m.id ? "bg-white text-black shadow-sm" : "text-black/45 hover:text-black/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleAIGenerate}
          disabled={aiBusy}
          className="px-3 py-1.5 text-sm border border-black/12 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-95 text-black/60 disabled:opacity-50"
        >
          {aiBusy ? "…" : "AI ✦"}
        </button>
        <button
          onClick={openNewProposal}
          className="px-3 py-1.5 text-sm border border-black/12 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-95 text-black/60"
        >
          New
        </button>
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 text-sm border border-black/12 rounded-lg hover:bg-black/5 transition-all duration-150 active:scale-95 text-black/60"
        >
          Export PDF
        </button>
        <button
          className="px-4 py-1.5 text-sm bg-[#1b3a2d] text-white rounded-lg hover:bg-[#2d5a40] transition-all duration-150 active:scale-95 font-medium"
        >
          Save
        </button>
        <div className="ml-1 pl-2 border-l border-black/10 flex items-center">
          <UserButton />
        </div>
      </div>
    </div>
  );
}
