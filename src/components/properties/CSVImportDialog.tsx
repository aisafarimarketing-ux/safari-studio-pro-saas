"use client";

import { useMemo, useState } from "react";

// Bulk property importer — operator uploads a CSV (or pastes one) and we
// preview + commit the rows server-side via POST /api/properties/import.
//
// We parse the CSV client-side with a tiny RFC-4180 friendly parser so
// quoted values with commas work. The server treats the parsed rows as
// untrusted input and validates/sanitises everything.

const EXPECTED_COLUMNS = [
  "name",
  "propertyClass",
  "locationName",
  "country",
  "region",
  "shortSummary",
  "whatMakesSpecial",
  "whyWeChoose",
  "amenities",        // pipe-separated
  "mealPlan",
  "suggestedNights",
  "suitability",      // pipe-separated
  "tags",             // pipe-separated
] as const;

type Row = Partial<Record<(typeof EXPECTED_COLUMNS)[number], string>>;

type ImportResult = {
  created: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
};

export function CSVImportDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (created: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!raw.trim()) return [];
    try {
      return parseCSV(raw);
    } catch {
      return [];
    }
  }, [raw]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError("No rows detected. Make sure the first line is the column header.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/properties/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.status === 402) { window.location.href = "/account-suspended"; return; }
      if (res.status === 409) { window.location.href = "/select-organization"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      if (data.created > 0) onComplete(data.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = EXPECTED_COLUMNS.join(",");
    const example = `"Mara Plains Camp",tented_camp,"Maasai Mara",Kenya,"Olare Motorogi","Seven tents on the Olare Motorogi Conservancy — a private reserve bordering the Mara.","Private conservancy access means night drives, walking safaris, and four guests per vehicle.","We send repeat-guests here when they want the Mara without the crowds.","Private plunge pool|Wi-Fi|Library|Spa",full_board,3,"photography|honeymoon","luxury|conservancy"`;
    const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safari-studio-properties-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ss-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden ss-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-7 py-5 border-b border-black/8 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#1b3a2d] font-semibold">Library</div>
            <h2 className="text-xl font-bold tracking-tight text-black/85 mt-1">Import from CSV</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-black/40 hover:text-black/70 transition" aria-label="Close">✕</button>
        </header>

        <div className="flex-1 overflow-auto px-7 py-6 space-y-5">
          {!result && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-black/12 bg-white hover:bg-black/[0.03] cursor-pointer transition">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                  <span>Choose file</span>
                </label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-sm underline text-black/55 hover:text-black/85 transition"
                >
                  Download a template CSV
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-black/70 mb-1.5">
                  Or paste CSV
                </label>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={8}
                  placeholder="name,propertyClass,locationName,country,region,…"
                  className="w-full px-3 py-2 rounded-lg border border-black/12 font-mono text-[12px] text-black/75 resize-y focus:outline-none focus:border-[#1b3a2d]"
                />
              </div>

              {rows.length > 0 && (
                <div className="rounded-xl border border-black/8 overflow-hidden">
                  <div className="px-4 py-2.5 bg-black/[0.03] text-[12px] text-black/60 border-b border-black/6">
                    Preview: {rows.length} row{rows.length === 1 ? "" : "s"} detected
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[12px]">
                      <thead className="bg-black/[0.02] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-black/50 font-medium w-10">#</th>
                          <th className="text-left px-3 py-2 text-black/50 font-medium">Name</th>
                          <th className="text-left px-3 py-2 text-black/50 font-medium">Class</th>
                          <th className="text-left px-3 py-2 text-black/50 font-medium">Location</th>
                          <th className="text-left px-3 py-2 text-black/50 font-medium">Country</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 15).map((r, i) => (
                          <tr key={i} className="border-t border-black/5">
                            <td className="px-3 py-2 text-black/40 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2 text-black/85">{r.name || <em className="text-[#b34334]">blank</em>}</td>
                            <td className="px-3 py-2 text-black/55">{r.propertyClass || "—"}</td>
                            <td className="px-3 py-2 text-black/55">{r.locationName || "—"}</td>
                            <td className="px-3 py-2 text-black/55">{r.country || "—"}</td>
                          </tr>
                        ))}
                        {rows.length > 15 && (
                          <tr className="border-t border-black/5">
                            <td colSpan={5} className="px-3 py-2 text-center text-black/40">
                              …and {rows.length - 15} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-[#b34334]/30 bg-[#b34334]/5 p-3 text-[13px] text-[#b34334]">
                  {error}
                </div>
              )}

              <div className="text-[12px] text-black/45 leading-relaxed">
                <strong className="text-black/65">Columns:</strong>{" "}
                {EXPECTED_COLUMNS.join(", ")}. Pipe-separate multi-value fields (amenities, suitability, tags). Unknown <code>propertyClass</code> / <code>mealPlan</code> / <code>suitability</code> values are dropped silently.
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-xl p-5" style={{ background: result.failed === 0 ? "rgba(27,58,45,0.05)" : "rgba(201,168,76,0.1)" }}>
                <div className="text-[14px] font-semibold text-black/85">
                  {result.created} {result.created === 1 ? "property" : "properties"} imported
                  {result.failed > 0 && <> · <span className="text-[#b34334]">{result.failed} failed</span></>}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-black/8 overflow-hidden">
                  <div className="px-4 py-2.5 bg-black/[0.03] text-[12px] text-black/60 border-b border-black/6">
                    Errors
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[12px]">
                      <tbody>
                        {result.errors.map((e) => (
                          <tr key={e.row} className="border-t border-black/5">
                            <td className="px-3 py-2 text-black/40 tabular-nums w-10">{e.row}</td>
                            <td className="px-3 py-2 text-black/75">{e.name}</td>
                            <td className="px-3 py-2 text-[#b34334]">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-7 py-4 border-t border-black/8 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-black/40">
            {rows.length > 0 && !result ? `${rows.length} row${rows.length === 1 ? "" : "s"} ready` : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-black/60 hover:bg-black/5 transition"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || rows.length === 0}
                className="px-5 py-2 text-sm rounded-lg bg-[#1b3a2d] text-white font-semibold hover:bg-[#2d5a40] active:scale-95 transition disabled:opacity-60"
              >
                {importing ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── CSV parser (tiny RFC-4180) ────────────────────────────────────────────
//
// Handles quoted fields, embedded commas, embedded quotes (""), CR/LF line
// endings. Doesn't support the quoted-line-break edge case because properties
// shouldn't have multi-line values in a simple import file.

function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row: Row = {};
    header.forEach((key, idx) => {
      if (!isExpectedColumn(key)) return;
      const v = cells[idx] ?? "";
      row[key] = v;
    });
    rows.push(row);
  }
  return rows;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur.length === 0) {
        inQ = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function isExpectedColumn(key: string): key is (typeof EXPECTED_COLUMNS)[number] {
  return (EXPECTED_COLUMNS as readonly string[]).includes(key);
}
