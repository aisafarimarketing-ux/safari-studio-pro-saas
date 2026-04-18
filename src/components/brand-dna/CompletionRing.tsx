"use client";

// Circular SVG ring — compact, no dependencies.
// Used on the dashboard card, the Brand DNA page header, and anywhere else
// we want a glanceable "how complete is this?" signal.

export function CompletionRing({
  percent,
  size = 72,
  stroke = 6,
  trackColor = "rgba(0,0,0,0.08)",
  fillColor = "#1b3a2d",
  accent = "#c9a84c",
  label = true,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  accent?: string;
  label?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  // Low-completion states get the gold accent to feel like an invitation
  // rather than a warning; high completion gets the forest to read as "done".
  const strokeColor = clamped >= 66 ? fillColor : accent;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={trackColor}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={strokeColor}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center leading-none">
            <div
              className="font-semibold tabular-nums"
              style={{ fontSize: size * 0.3, color: fillColor }}
            >
              {Math.round(clamped)}
            </div>
            <div
              className="uppercase tracking-wider text-black/40 font-medium mt-0.5"
              style={{ fontSize: Math.max(8, size * 0.12) }}
            >
              %
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
