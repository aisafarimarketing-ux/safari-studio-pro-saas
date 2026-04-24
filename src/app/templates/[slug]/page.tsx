import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateBySlug, listTemplates } from "@/lib/templates";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { UseTemplateButton } from "@/components/templates/UseTemplateButton";

// ─── /templates/[slug] ──────────────────────────────────────────────────────
//
// Public SEO-driven template landing page. Renders the pre-built Proposal
// inside the real ProposalCanvas (preview mode) so the visitor is looking
// at genuine Safari Studio output, not a mockup. Sticky CTA at the top
// captures conversion; the "Use this template" clone flow arrives in a
// later commit.

export const dynamicParams = false;

export async function generateStaticParams() {
  return listTemplates().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tpl = getTemplateBySlug(slug);
  if (!tpl) return { title: "Template not found" };
  return {
    title: `${tpl.title} · Safari Studio`,
    description: tpl.metaDescription,
    openGraph: {
      title: tpl.title,
      description: tpl.metaDescription,
      type: "article",
    },
  };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tpl = getTemplateBySlug(slug);
  if (!tpl) notFound();

  return (
    <div className="min-h-screen" style={{ background: "#f8f5ef" }}>
      <TemplateHeader title={tpl.title} summary={tpl.summary} slug={tpl.slug} />
      <TemplateRenderer template={tpl} />
      <TemplateFooterCTA title={tpl.title} slug={tpl.slug} />
    </div>
  );
}

// ─── Sticky header with sign-up nudge ──────────────────────────────────────

function TemplateHeader({ title, summary, slug }: { title: string; summary: string; slug: string }) {
  const FOREST = "#1b3a2d";
  const GOLD = "#c9a84c";
  return (
    <div
      className="sticky top-0 z-40 backdrop-blur border-b flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        background: "rgba(27,58,45,0.96)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="shrink-0 text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded"
          style={{ background: GOLD, color: FOREST }}
        >
          Template
        </div>
        <div className="min-w-0">
          <div className="text-white/85 text-[13px] font-semibold truncate">{title}</div>
          <div className="text-white/50 text-[11px] truncate hidden sm:block">{summary}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/templates"
          className="text-[13px] text-white/60 hover:text-white transition px-3 py-1.5 hidden sm:inline"
        >
          All templates
        </Link>
        <UseTemplateButton
          slug={slug}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold transition hover:brightness-110 active:scale-95"
          style={{ background: GOLD, color: FOREST }}
        />
      </div>
    </div>
  );
}

function TemplateFooterCTA({ title, slug }: { title: string; slug: string }) {
  const FOREST_DEEP = "#142a20";
  const FOREST = "#1b3a2d";
  const GOLD = "#c9a84c";
  return (
    <section className="py-16 px-6" style={{ background: FOREST_DEEP }}>
      <div className="max-w-3xl mx-auto text-center">
        <div
          className="inline-block text-[11px] uppercase tracking-[0.24em] font-semibold"
          style={{ color: GOLD }}
        >
          Customise and send
        </div>
        <h2
          className="mt-4 text-3xl md:text-4xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Make <em className="not-italic" style={{ color: GOLD }}>{title}</em> yours.
        </h2>
        <p className="mt-5 text-white/60 max-w-xl mx-auto text-[15px] leading-relaxed">
          Sign up, clone this template into your workspace, and edit freely — reduce
          days, add destinations, swap camps, retune the voice with AI. What you
          send your client is uniquely theirs.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <UseTemplateButton
            slug={slug}
            className="px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: FOREST }}
          >
            Use this template →
          </UseTemplateButton>
          <Link
            href="/pricing"
            className="px-5 py-3 rounded-xl text-[14px] text-white/75 hover:text-white transition border border-white/15"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
