"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── ExpandingCards ──────────────────────────────────────────────────────
//
// Horizontal expanding card row (collapses to vertical on viewports
// below 768px). One card is "active" at any time and grows to 5fr
// while every other card shrinks to 1fr. Activation by hover, focus,
// or click. Smooth grid-template transition.
//
// Active card: full-colour image at scale 100% + icon + title +
// description fading in with staggered delays.
//
// Inactive cards: grayscale image scaled 110% + a rotated 90°
// vertical title sitting at the card's left edge.
//
// Per-card editor affordance: when `isEditor` and `onChangeImage`
// are passed, each card hovers a small "Change image" pill top-right
// that opens a file picker. The file is handed to onChangeImage,
// which (for our use) uploads via uploadImage and writes the URL
// back to section.content.imageOverrides.

export interface CardItem {
  id: string | number;
  title: string;
  description: string;
  imgSrc: string | null;
  icon: React.ReactNode;
  /** Optional href — currently unused by the closing section but
   *  preserved from the source component's API. */
  linkHref?: string;
}

interface ExpandingCardsProps extends React.HTMLAttributes<HTMLUListElement> {
  items: CardItem[];
  defaultActiveIndex?: number;
  /** Editor-mode image swap. Called with (cardId, file). */
  isEditor?: boolean;
  onChangeImage?: (id: string | number, file: File) => void;
  /** Tint used for the inactive card edge glow / placeholder bg. */
  accentColor?: string;
  /** Cream / parchment colour used as image fallback when imgSrc is empty. */
  placeholderColor?: string;
}

export const ExpandingCards = React.forwardRef<
  HTMLUListElement,
  ExpandingCardsProps
>((props, ref) => {
  const {
    className,
    items,
    defaultActiveIndex = 0,
    isEditor = false,
    onChangeImage,
    accentColor = "#a85230",
    placeholderColor = "#f5e8c8",
    ...rest
  } = props;

  const [activeIndex, setActiveIndex] = React.useState<number | null>(
    defaultActiveIndex,
  );
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const gridStyle = React.useMemo(() => {
    if (activeIndex === null) return {};
    if (isDesktop) {
      const columns = items
        .map((_, index) => (index === activeIndex ? "5fr" : "1fr"))
        .join(" ");
      return { gridTemplateColumns: columns };
    }
    const rows = items
      .map((_, index) => (index === activeIndex ? "5fr" : "1fr"))
      .join(" ");
    return { gridTemplateRows: rows };
  }, [activeIndex, items, isDesktop]);

  const handleInteraction = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <ul
      className={cn(
        "w-full max-w-6xl gap-2 grid",
        // Generous min-height so cards are tall enough to read
        // when one is expanded; shorter on narrow viewports.
        "h-[500px] md:h-[480px]",
        "transition-[grid-template-columns,grid-template-rows] duration-500 ease-out",
        className,
      )}
      style={{
        ...gridStyle,
        ...(isDesktop
          ? { gridTemplateRows: "1fr" }
          : { gridTemplateColumns: "1fr" }),
      }}
      ref={ref}
      {...rest}
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-lg border shadow-sm",
            "md:min-w-[80px]",
            "min-h-0 min-w-0",
          )}
          style={{
            background: placeholderColor,
            borderColor: "rgba(0,0,0,0.08)",
          }}
          onMouseEnter={() => handleInteraction(index)}
          onFocus={() => handleInteraction(index)}
          onClick={() => handleInteraction(index)}
          tabIndex={0}
          data-active={activeIndex === index}
        >
          {item.imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imgSrc}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-out group-data-[active=true]:scale-100 group-data-[active=true]:grayscale-0 scale-110 grayscale"
            />
          ) : (
            // Empty image — show an accent-tinted placeholder so the
            // card still has visual presence in editor mode before
            // an image is uploaded.
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}10 100%)`,
                color: accentColor,
              }}
            >
              <span
                aria-hidden
                className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-70"
              >
                Add a photo
              </span>
            </div>
          )}

          {/* Top-to-bottom dark gradient for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

          <article className="absolute inset-0 flex flex-col justify-end gap-2 p-4">
            {/* Vertical title shown only on inactive desktop cards.
                Disappears when the card is active. */}
            <h3 className="hidden origin-left rotate-90 text-sm font-light uppercase tracking-wider text-white/85 opacity-100 transition-all duration-300 ease-out md:block group-data-[active=true]:opacity-0">
              {item.title}
            </h3>

            <div className="text-white/95 opacity-0 transition-all duration-300 delay-75 ease-out group-data-[active=true]:opacity-100">
              {item.icon}
            </div>

            <h3 className="text-xl font-bold text-white opacity-0 transition-all duration-300 delay-150 ease-out group-data-[active=true]:opacity-100">
              {item.title}
            </h3>

            <p className="w-full max-w-xs text-sm text-white/85 opacity-0 transition-all duration-300 delay-225 ease-out group-data-[active=true]:opacity-100">
              {item.description}
            </p>
          </article>

          {/* Editor: Change-image pill on hover */}
          {isEditor && onChangeImage && (
            <ChangeImagePill onPick={(file) => onChangeImage(item.id, file)} />
          )}
        </li>
      ))}
    </ul>
  );
});
ExpandingCards.displayName = "ExpandingCards";

// ─── ChangeImagePill ─────────────────────────────────────────────────────

function ChangeImagePill({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div
      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-sm text-[10.5px] font-semibold text-black/75 hover:text-black border border-black/10 shadow-sm transition"
      >
        Change image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
