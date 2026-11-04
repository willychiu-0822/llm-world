import { ACCESSORIES, BODY_SHAPES, DEFAULT_APPEARANCE, type Accessory, type Appearance, type BodyShape } from "@lj/core";

const INK = "#5B4636";

const BODIES: Record<BodyShape, { d: string; top: number; eyeY: number; neckY: number }> = {
  round: { d: "M50 32 C72 32 82 48 82 62 C82 78 68 88 50 88 C32 88 18 78 18 62 C18 48 28 32 50 32 Z", top: 32, eyeY: 56, neckY: 72 },
  pear: { d: "M50 30 C64 30 70 42 72 52 C80 60 84 70 82 78 C79 88 66 90 50 90 C34 90 21 88 18 78 C16 70 20 60 28 52 C30 42 36 30 50 30 Z", top: 30, eyeY: 52, neckY: 66 },
  tall: { d: "M50 22 C66 22 72 34 72 48 L72 74 C72 84 62 90 50 90 C38 90 28 84 28 74 L28 48 C28 34 34 22 50 22 Z", top: 22, eyeY: 46, neckY: 64 },
};

function Accessory({ kind, top, eyeY, neckY, accent }: { kind: Accessory; top: number; eyeY: number; neckY: number; accent: string }) {
  const s = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (kind) {
    case "dragon_horns":
      return (
        <g data-part="dragon_horns" fill={accent} {...s}>
          <path d={`M38 ${top + 6} C34 ${top - 4} 30 ${top - 10} 33 ${top - 14} C38 ${top - 8} 42 ${top - 2} 43 ${top + 3} Z`} />
          <path d={`M62 ${top + 6} C66 ${top - 4} 70 ${top - 10} 67 ${top - 14} C62 ${top - 8} 58 ${top - 2} 57 ${top + 3} Z`} />
        </g>
      );
    case "leaf":
      return (
        <g data-part="leaf" {...s}>
          <path d={`M50 ${top + 1} C50 ${top - 6} 52 ${top - 9} 54 ${top - 11}`} fill="none" />
          <path d={`M54 ${top - 11} C60 ${top - 20} 70 ${top - 18} 72 ${top - 14} C66 ${top - 8} 58 ${top - 7} 54 ${top - 11} Z`} fill={accent} />
        </g>
      );
    case "beret":
      return (
        <g data-part="beret" fill={accent} {...s}>
          <path d={`M30 ${top + 7} C30 ${top - 6} 72 ${top - 8} 72 ${top + 4} C64 ${top + 9} 40 ${top + 11} 30 ${top + 7} Z`} />
          <circle cx="53" cy={top - 7} r="2.5" />
        </g>
      );
    case "scarf":
      return (
        <g data-part="scarf" fill={accent} {...s}>
          <path d={`M27 ${neckY} C38 ${neckY + 6} 62 ${neckY + 6} 73 ${neckY} L74 ${neckY + 7} C62 ${neckY + 13} 38 ${neckY + 13} 26 ${neckY + 7} Z`} />
          <path d={`M60 ${neckY + 8} L64 ${neckY + 22} L70 ${neckY + 19} L67 ${neckY + 7} Z`} />
        </g>
      );
    case "glasses":
      return (
        <g data-part="glasses" fill="none" {...s}>
          <circle cx="40" cy={eyeY} r="7" />
          <circle cx="60" cy={eyeY} r="7" />
          <path d={`M47 ${eyeY} L53 ${eyeY}`} />
        </g>
      );
    case "flower":
      return (
        <g data-part="flower" {...s}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="68" cy={top + 4} rx="4" ry="6.5" fill={accent} transform={`rotate(${a} 68 ${top + 10}) translate(0 0)`} />
          ))}
          <circle cx="68" cy={top + 10} r="3.2" fill="#F6D776" />
        </g>
      );
    case "headphones":
      return (
        <g data-part="headphones" {...s}>
          <path d={`M24 ${eyeY - 2} C24 ${top - 8} 76 ${top - 8} 76 ${eyeY - 2}`} fill="none" strokeWidth={3.2} />
          <rect x="17" y={eyeY - 8} width="10" height="16" rx="5" fill={accent} />
          <rect x="73" y={eyeY - 8} width="10" height="16" rx="5" fill={accent} />
        </g>
      );
    default:
      return null;
  }
}

export function Avatar({ appearance, name, size = 48, className, x, y }: { appearance: Partial<Appearance> | null | undefined; name: string; size?: number; className?: string; x?: number; y?: number }) {
  const a = appearance ?? {};
  const body: BodyShape = (BODY_SHAPES as readonly string[]).includes(a.body ?? "") ? (a.body as BodyShape) : DEFAULT_APPEARANCE.body;
  const accessory: Accessory = (ACCESSORIES as readonly string[]).includes(a.accessory ?? "") ? (a.accessory as Accessory) : "none";
  const main = a.main ?? DEFAULT_APPEARANCE.main;
  const accent = a.accent ?? DEFAULT_APPEARANCE.accent;
  const b = BODIES[body];
  return (
    <svg
      role="img"
      aria-label={name}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      x={x}
      y={y}
      data-body={body}
      data-accessory={accessory}
    >
      <title>{name}</title>
      <ellipse cx="50" cy="93" rx="24" ry="4" fill={INK} opacity="0.12" />
      <ellipse cx="40" cy="89" rx="7" ry="4" fill={main} stroke={INK} strokeWidth="2.2" />
      <ellipse cx="60" cy="89" rx="7" ry="4" fill={main} stroke={INK} strokeWidth="2.2" />
      <path data-part={`body-${body}`} d={b.d} fill={main} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <ellipse cx="34" cy={b.eyeY + 9} rx="5" ry="3" fill="#E9A3A0" opacity="0.55" />
      <ellipse cx="66" cy={b.eyeY + 9} rx="5" ry="3" fill="#E9A3A0" opacity="0.55" />
      <ellipse cx="40" cy={b.eyeY} rx="2.6" ry="3.4" fill={INK} />
      <ellipse cx="60" cy={b.eyeY} rx="2.6" ry="3.4" fill={INK} />
      <circle cx="41" cy={b.eyeY - 1.2} r="0.9" fill="#fff" />
      <circle cx="61" cy={b.eyeY - 1.2} r="0.9" fill="#fff" />
      <path d={`M45 ${b.eyeY + 8} Q50 ${b.eyeY + 12} 55 ${b.eyeY + 8}`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <Accessory kind={accessory} top={b.top} eyeY={b.eyeY} neckY={b.neckY} accent={accent} />
    </svg>
  );
}
