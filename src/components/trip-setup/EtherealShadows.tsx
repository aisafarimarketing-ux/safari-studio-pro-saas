"use client";

import { useRef, useId, useEffect, type CSSProperties } from "react";
import { animate, useMotionValue, type AnimationPlaybackControls } from "framer-motion";

// ─── EtherealShadows ─────────────────────────────────────────────────────
//
// Animated atmospheric backdrop. SVG turbulence + displacement filter
// drives a slow shifting mask over a solid colour fill, giving the
// "something is humming in the background" feel we want behind the
// AutomatingOverlay while the AI is drafting.
//
// Pure CSS / SVG — no canvas, no new dep beyond framer-motion (already
// in the package). Idles around 1-2% CPU on a mid-range laptop.
//
// Tints to brand by setting `color` (any CSS colour). Default is a
// muted brand teal; the AutomatingOverlay overrides to deep teal +
// gold for the safari-night aesthetic.
//
// Adapted from a Framer-published shadow component; trimmed to the
// minimum we need (no hard-coded h1 title, no responsive image
// switcher, no preset-vs-custom branching) and re-typed for strict
// TS without `any`.

interface AnimationConfig {
  scale: number; // 1-100 (turbulence amplitude)
  speed: number; // 1-100 (rotation speed)
}

interface NoiseConfig {
  opacity: number; // 0-1
  scale: number; // pixel scale for the noise tile
}

export interface EtherealShadowsProps {
  color?: string;
  animation?: AnimationConfig;
  noise?: NoiseConfig;
  style?: CSSProperties;
  className?: string;
}

function mapRange(
  value: number,
  fromLow: number,
  fromHigh: number,
  toLow: number,
  toHigh: number,
): number {
  if (fromLow === fromHigh) return toLow;
  const pct = (value - fromLow) / (fromHigh - fromLow);
  return toLow + pct * (toHigh - toLow);
}

function useInstanceId(): string {
  const id = useId();
  return `ss-ethereal-${id.replace(/:/g, "")}`;
}

export function EtherealShadows({
  color = "rgba(31, 58, 58, 0.85)",
  animation = { scale: 60, speed: 40 },
  noise,
  style,
  className,
}: EtherealShadowsProps) {
  const id = useInstanceId();
  const animationEnabled = animation.scale > 0;
  const feColorMatrixRef = useRef<SVGFEColorMatrixElement>(null);
  const hueRotate = useMotionValue(0);
  const hueAnim = useRef<AnimationPlaybackControls | null>(null);

  const displacementScale = mapRange(animation.scale, 1, 100, 20, 100);
  const animationDuration = mapRange(animation.speed, 1, 100, 1000, 50);

  useEffect(() => {
    if (!animationEnabled || !feColorMatrixRef.current) return;
    hueAnim.current?.stop();
    hueRotate.set(0);
    hueAnim.current = animate(hueRotate, 360, {
      duration: animationDuration / 25,
      repeat: Infinity,
      repeatType: "loop",
      ease: "linear",
      onUpdate: (value) => {
        feColorMatrixRef.current?.setAttribute("values", String(value));
      },
    });
    return () => {
      hueAnim.current?.stop();
    };
  }, [animationEnabled, animationDuration, hueRotate]);

  return (
    <div
      className={className}
      style={{
        overflow: "hidden",
        position: "relative",
        width: "100%",
        height: "100%",
        ...style,
      }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          inset: -displacementScale,
          filter: animationEnabled ? `url(#${id}) blur(4px)` : "none",
        }}
      >
        {animationEnabled && (
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <filter id={id}>
                <feTurbulence
                  result="undulation"
                  numOctaves={2}
                  baseFrequency={`${mapRange(animation.scale, 0, 100, 0.001, 0.0005)},${mapRange(animation.scale, 0, 100, 0.004, 0.002)}`}
                  seed="0"
                  type="turbulence"
                />
                <feColorMatrix
                  ref={feColorMatrixRef}
                  in="undulation"
                  type="hueRotate"
                  values="180"
                />
                <feColorMatrix
                  in="dist"
                  result="circulation"
                  type="matrix"
                  values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="circulation"
                  scale={displacementScale}
                  result="dist"
                />
                <feDisplacementMap
                  in="dist"
                  in2="undulation"
                  scale={displacementScale}
                  result="output"
                />
              </filter>
            </defs>
          </svg>
        )}
        <div
          style={{
            backgroundColor: color,
            // Inline radial-gradient mask gives us the soft "blob"
            // shape without depending on an external image. The shadow
            // animates across this gradient; no network round-trip.
            maskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0) 100%)",
            maskSize: "120% 120%",
            WebkitMaskSize: "120% 120%",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      {noise && noise.opacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
            backgroundSize: noise.scale * 200,
            backgroundRepeat: "repeat",
            opacity: noise.opacity / 2,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}
