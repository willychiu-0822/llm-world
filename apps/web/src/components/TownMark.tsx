import type { ReactNode } from "react";
import type { KeepsakeMark, LifeActivityId, TownSightMark } from "@lj/core";

/** Picture-book marks drawn with the same ink as the dragon. One drawing per object. */
export const UI_MARKS = ["home", "map", "basket", "mail", "gear", "post", "paw"] as const;
export type UiMark = (typeof UI_MARKS)[number];
export type MarkName = KeepsakeMark | LifeActivityId | TownSightMark | UiMark;

const INK = "#5B4636";
const PAPER = "#FFFDF8";
const WOOL = "#F3E3C3";
const SKIN = "#F2C6A8";
const LEAF = "#B9CFA4";
const SKY = "#A9C7DE";
const BUTTER = "#F1DC8F";
const ROSE = "#E9AFB4";
const CLAY = "#E7C4A8";
const STONE = "#D9C2A0";

const pen = {
  fill: "none" as const,
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Mark({ children }: { children: ReactNode }) {
  return <g {...pen}>{children}</g>;
}

const DRAWS: Record<MarkName, () => ReactNode> = {
  pick: () => (
    <Mark>
      <path d="M32 8 C46 16 52 32 42 48 C36 58 32 60 32 60 C32 60 28 58 22 48 C12 32 18 16 32 8 Z" fill={SKIN} />
      <path d="M24 24 H40" />
    </Mark>
  ),
  ribbon: () => (
    <Mark>
      <path d="M22 30 L14 56 L26 46 L32 56 L32 34" fill={ROSE} />
      <path d="M42 30 L50 56 L38 46 L32 56 L32 34" fill={ROSE} />
      <circle cx="32" cy="24" r="13" fill={ROSE} />
      <circle cx="32" cy="24" r="5" fill={BUTTER} />
    </Mark>
  ),
  clay: () => (
    <Mark>
      <path d="M22 24 H42 L38 50 C38 54 26 54 26 50 Z" fill={CLAY} />
      <ellipse cx="32" cy="24" rx="14" ry="5" fill={WOOL} />
      <path d="M24 34 H40" />
    </Mark>
  ),
  spoon: () => (
    <Mark>
      <ellipse cx="22" cy="44" rx="12" ry="9" fill={WOOL} />
      <path d="M22 35 L44 12" />
    </Mark>
  ),
  bookmark: () => (
    <Mark>
      <path d="M18 8 H46 V56 L32 44 L18 56 Z" fill={SKY} />
      <path d="M26 20 H38 M26 28 H38" />
    </Mark>
  ),
  flower: () => (
    <Mark>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="32" cy="18" rx="6" ry="10" fill={ROSE} transform={`rotate(${angle} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="5" fill={BUTTER} />
    </Mark>
  ),
  cup: () => (
    <Mark>
      <path d="M16 22 H40 L36 46 H20 Z" fill={PAPER} />
      <path d="M40 26 C52 26 52 42 40 42" />
      <path d="M12 52 H48" />
    </Mark>
  ),
  pouch: () => (
    <Mark>
      <path d="M18 26 C18 16 46 16 46 26 V48 C46 54 18 54 18 48 Z" fill={LEAF} />
      <path d="M18 28 H46" />
      <path d="M32 28 V36" />
      <circle cx="32" cy="38" r="2.2" fill={INK} stroke="none" />
    </Mark>
  ),
  pebble: () => (
    <Mark>
      <path d="M14 36 C16 24 28 20 40 22 C52 24 56 34 50 44 C44 54 24 54 16 46 C12 42 12 40 14 36 Z" fill={STONE} />
      <path d="M22 34 C28 30 34 32 40 28" />
    </Mark>
  ),
  shop: () => (
    <Mark>
      <path d="M8 36 C16 28 26 38 34 32 C42 26 50 36 58 30 L56 44 C42 52 16 52 8 44 Z" fill={PAPER} />
      <circle cx="20" cy="34" r="5.5" fill={PAPER} />
      <circle cx="34" cy="30" r="6.5" fill={PAPER} />
      <circle cx="48" cy="34" r="5.5" fill={PAPER} />
      <path d="M44 46 C48 56 58 54 56 44" fill={SKY} />
    </Mark>
  ),
  exercise: () => (
    <Mark>
      <path d="M18 40 C18 22 36 12 50 16 C44 28 48 40 40 52 C28 56 18 50 18 40 Z" fill={LEAF} />
      <path d="M24 42 C32 36 38 28 44 20" />
      <circle cx="30" cy="36" r="3" fill={PAPER} />
    </Mark>
  ),
  music: () => (
    <Mark>
      <circle cx="32" cy="12" r="3.2" />
      <path d="M32 15 V20" />
      <path d="M18 36 C18 22 46 22 46 36 L50 44 H14 Z" fill={BUTTER} />
      <path d="M22 36 H42" />
      <circle cx="32" cy="50" r="4.5" fill={BUTTER} />
    </Mark>
  ),
  visit: () => (
    <Mark>
      <path d="M8 28 H26 L24 44 H12 Z" fill={PAPER} />
      <path d="M26 32 C34 32 34 42 26 42" />
      <path d="M36 24 H54 L52 42 H38 Z" fill={WOOL} />
      <path d="M54 28 C62 28 62 40 54 40" />
      <path d="M8 50 H56" />
    </Mark>
  ),
  festival: () => (
    <Mark>
      <path d="M32 6 V14" />
      <path d="M20 18 H44 L40 46 H24 Z" fill={ROSE} />
      <path d="M20 28 H44 M22 36 H42" />
      <path d="M24 46 L32 56 L40 46" fill={BUTTER} />
    </Mark>
  ),
  town: () => (
    <Mark>
      <rect x="12" y="22" width="24" height="30" rx="4" fill={PAPER} transform="rotate(-10 24 37)" />
      <rect x="28" y="16" width="24" height="32" rx="4" fill={SKY} />
      <path d="M34 26 H46 M34 34 H46" />
      <circle cx="34" cy="42" r="2" />
      <circle cx="46" cy="42" r="2" />
    </Mark>
  ),
  abroad: () => (
    <Mark>
      <path d="M26 10 H38 V20 C48 24 50 32 50 40 V48 C50 56 14 56 14 48 V40 C14 32 16 24 26 20 Z" fill={SKY} />
      <path d="M24 10 H40" />
      <path d="M18 36 H46" />
      <circle cx="26" cy="44" r="1.8" fill={BUTTER} stroke="none" />
      <circle cx="34" cy="48" r="1.8" fill={PAPER} stroke="none" />
      <circle cx="40" cy="42" r="1.6" fill={BUTTER} stroke="none" />
    </Mark>
  ),
  leaf: () => (
    <Mark>
      <path d="M16 46 C16 24 36 10 52 14 C40 28 44 42 34 54 C24 58 16 54 16 46 Z" fill={LEAF} />
      <path d="M22 46 C32 38 40 26 48 18" />
    </Mark>
  ),
  bird: () => (
    <Mark>
      <ellipse cx="30" cy="36" rx="16" ry="12" fill={WOOL} />
      <path d="M42 34 L54 30 L44 40 Z" fill={BUTTER} />
      <circle cx="24" cy="34" r="1.8" fill={INK} stroke="none" />
      <path d="M18 28 C22 16 36 18 38 26" fill={SKY} />
      <path d="M22 46 L18 54 M30 47 L32 54" />
    </Mark>
  ),
  sun: () => (
    <Mark>
      <circle cx="32" cy="32" r="12" fill={BUTTER} />
      <path d="M32 8 V14 M32 50 V56 M8 32 H14 M50 32 H56 M14 14 L18 18 M46 46 L50 50 M50 14 L46 18 M18 46 L14 50" />
    </Mark>
  ),
  bread: () => (
    <Mark>
      <path d="M10 36 C10 22 22 16 32 16 C46 16 56 24 56 36 C56 48 46 54 32 54 C18 54 10 46 10 36 Z" fill={WOOL} />
      <path d="M20 34 L44 30" />
    </Mark>
  ),
  home: () => (
    <Mark>
      <path d="M10 30 L32 12 L54 30" />
      <path d="M16 28 V52 H48 V28" fill={WOOL} />
      <path d="M28 52 V38 H36 V52" fill={PAPER} />
    </Mark>
  ),
  map: () => (
    <Mark>
      <path d="M8 16 L22 22 V52 L8 46 Z" fill={LEAF} />
      <path d="M22 22 L42 14 V44 L22 52 Z" fill={PAPER} />
      <path d="M42 14 L56 20 V50 L42 44 Z" fill={SKY} />
      <path d="M16 30 C22 26 28 34 36 28" />
    </Mark>
  ),
  basket: () => (
    <Mark>
      <path d="M14 28 H50 L46 52 H18 Z" fill={WOOL} />
      <path d="M20 36 H44 M22 44 H42 M24 28 V50 M32 28 V52 M40 28 V50" />
      <path d="M20 28 C20 14 44 14 44 28" />
    </Mark>
  ),
  mail: () => (
    <Mark>
      <rect x="8" y="16" width="48" height="34" rx="4" fill={PAPER} />
      <path d="M8 18 L32 36 L56 18" />
    </Mark>
  ),
  gear: () => (
    <Mark>
      <circle cx="32" cy="32" r="10" fill={PAPER} />
      <circle cx="32" cy="32" r="4" fill={WOOL} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <rect key={angle} x="29" y="6" width="6" height="10" rx="2" fill={WOOL} transform={`rotate(${angle} 32 32)`} />
      ))}
    </Mark>
  ),
  post: () => (
    <Mark>
      <path d="M16 28 C16 16 48 16 48 28 V44 H16 Z" fill={SKY} />
      <path d="M16 32 H48" />
      <path d="M48 20 H56 V30 H48" fill={ROSE} />
      <path d="M30 44 V56 M22 56 H42" />
    </Mark>
  ),
  paw: () => (
    <Mark>
      <ellipse cx="32" cy="40" rx="12" ry="10" fill={SKIN} />
      <circle cx="18" cy="24" r="5" fill={SKIN} />
      <circle cx="32" cy="18" r="5.5" fill={SKIN} />
      <circle cx="46" cy="24" r="5" fill={SKIN} />
    </Mark>
  ),
};

export function TownMark({ name, size = 40, className }: { name: MarkName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `town-mark ${className}` : "town-mark"}
      data-mark={name}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {DRAWS[name]()}
    </svg>
  );
}
