"use client";

import { OrganizationList } from "@clerk/nextjs";
import Link from "next/link";

export default function SelectOrganizationPage() {
  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#1a1a1a] flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-black/10 bg-white flex items-center px-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c9a84c] font-bold text-base"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            S
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-black/80">
            Safari Studio
          </span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black/85">
            Choose your workspace
          </h1>
          <p className="mt-2 text-black/55 text-[15px] leading-relaxed">
            Create a workspace for your travel business or join an existing one.
            Every proposal, brand asset, and team seat lives inside a workspace.
          </p>
        </div>

        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
          skipInvitationScreen
          appearance={{
            elements: {
              rootBox: { width: "100%", maxWidth: "28rem" },
              cardBox: { width: "100%" },
            },
          }}
        />
      </main>
    </div>
  );
}
