"use client";

// Small, reusable field primitives — keeps the form pages tight and
// consistent. No library, no abstractions we don't already use.

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium text-black/70">{label}</span>
        {hint && <span className="text-[11px] text-black/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 placeholder:text-black/30 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition"
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-sm text-black/85 placeholder:text-black/30 focus:outline-none focus:border-[#1b3a2d] focus:ring-2 focus:ring-[#1b3a2d]/12 transition resize-y"
      />
      {maxLength && (
        <div className="absolute bottom-2 right-3 text-[10px] text-black/30 tabular-nums pointer-events-none">
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition active:scale-95 border ${
        active
          ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
          : "bg-white text-black/65 border-black/12 hover:bg-black/5"
      }`}
    >
      {children}
    </button>
  );
}

export function Radio({
  active,
  onClick,
  children,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border transition active:scale-[0.99] ${
        active
          ? "bg-[#1b3a2d] text-white border-[#1b3a2d]"
          : "bg-white text-black/70 border-black/10 hover:border-black/25"
      }`}
    >
      <div className="font-semibold text-sm">{children}</div>
      {hint && (
        <div className={`text-[12px] mt-0.5 ${active ? "text-white/70" : "text-black/45"}`}>
          {hint}
        </div>
      )}
    </button>
  );
}
