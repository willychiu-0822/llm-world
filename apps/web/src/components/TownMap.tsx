import type { Appearance, District, DistrictKey } from "@lj/core";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar";

export interface MapPlace {
  id: string;
  kind: "public" | "shop";
  districtKey: string;
  name: string;
  roofColor: string;
  slot: number;
  isDemo: boolean;
  providerName: string | null;
  deedCount: number;
  trialCount: number;
  presence: { total: number; characters: { name: string; appearance: Appearance | Record<string, unknown> }[] };
}

const W = 1200;
const H = 880;
const INK = "#5B4636";

const LAYOUT: Record<DistrictKey, { x: number; y: number; rx: number; ry: number; seed: number }> = {
  crafts: { x: 230, y: 205, rx: 172, ry: 128, seed: 11 },
  music: { x: 600, y: 185, rx: 180, ry: 125, seed: 23 },
  learning: { x: 970, y: 205, rx: 172, ry: 128, seed: 37 },
  food: { x: 215, y: 455, rx: 168, ry: 128, seed: 41 },
  social: { x: 600, y: 445, rx: 172, ry: 132, seed: 53 },
  sports: { x: 985, y: 455, rx: 172, ry: 132, seed: 67 },
  outdoors: { x: 230, y: 712, rx: 182, ry: 128, seed: 71 },
  volunteer: { x: 600, y: 722, rx: 172, ry: 122, seed: 83 },
  misc: { x: 970, y: 712, rx: 178, ry: 128, seed: 97 },
};

/** Shop positions around a district's landmark, by slot. */
const SLOTS: [number, number][] = [
  [-112, -30],
  [108, -34],
  [-118, 48],
  [114, 44],
  [-58, 82],
  [58, 84],
  [-60, -78],
  [62, -80],
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft, hand-drawn looking closed blob (Catmull-Rom through jittered ellipse points). */
function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number, n = 12) {
  const r = rng(seed);
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.88 + r() * 0.2;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}

const stroke = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Original landmark drawings, one per district, centred on (0,0). */
function Landmark({ k, color }: { k: string; color: string }) {
  switch (k) {
    case "music":
      return (
        <g {...stroke}>
          <path d="M-34 10 L-30 -14 Q0 -40 30 -14 L34 10 Z" fill="#F6E7D2" />
          <path d="M-40 -12 Q0 -50 40 -12 Q0 -26 -40 -12 Z" fill={color} />
          <path d="M-22 10 L-22 -10 M22 10 L22 -10" />
          <path d="M6 -4 L6 -22 L16 -25 L16 -9" fill="none" />
          <circle cx="3" cy="-3" r="4" fill={INK} />
          <circle cx="13" cy="-8" r="4" fill={INK} />
        </g>
      );
    case "sports":
      return (
        <g {...stroke}>
          <ellipse cx="0" cy="0" rx="40" ry="22" fill="#E9C9A0" />
          <ellipse cx="0" cy="0" rx="26" ry="11" fill="#BFD9A8" />
          <path d="M-14 -22 L-14 -40 L6 -34 L-14 -28" fill="#F2B8A8" />
        </g>
      );
    case "crafts":
      return (
        <g {...stroke}>
          <path d="M-20 18 L-6 -30 L8 18 M-14 -4 L2 -4" fill="none" />
          <rect x="-26" y="-26" width="38" height="28" rx="3" fill="#FFF8EC" transform="rotate(-6)" />
          <circle cx="-10" cy="-14" r="5" fill={color} />
          <circle cx="2" cy="-10" r="4" fill="#A9C7DE" />
          <path d="M22 18 L30 -18" strokeWidth="4" />
          <path d="M28 -18 L32 -28 L34 -17 Z" fill="#E9AFB4" />
        </g>
      );
    case "food":
      return (
        <g {...stroke}>
          <rect x="-34" y="-8" width="68" height="26" rx="3" fill="#F6E7D2" />
          <path d="M-40 -8 L-34 -28 L34 -28 L40 -8 Z" fill="#FFFFFF" />
          <path d="M-40 -8 L-34 -28 L-20 -28 L-26 -8 Z M-12 -8 L-6 -28 L8 -28 L2 -8 Z M16 -8 L20 -28 L34 -28 L30 -8 Z" fill={color} />
          <path d="M-14 4 Q-8 -4 -2 4 M6 4 Q12 -4 18 4" fill="none" />
        </g>
      );
    case "learning":
      return (
        <g {...stroke}>
          <rect x="-32" y="-14" width="64" height="32" rx="3" fill="#F6E7D2" />
          <path d="M-38 -14 L0 -40 L38 -14 Z" fill={color} />
          <path d="M-14 18 L-14 2 L14 2 L14 18" fill="#FFF8EC" />
          <path d="M-12 -24 Q-6 -28 0 -24 Q6 -28 12 -24 L12 -16 Q6 -20 0 -16 Q-6 -20 -12 -16 Z" fill="#FFF8EC" />
        </g>
      );
    case "outdoors":
      return (
        <g {...stroke}>
          <path d="M-6 22 L-4 -4 L4 -4 L6 22 Z" fill="#B88B63" />
          <circle cx="0" cy="-22" r="24" fill={color} />
          <circle cx="-16" cy="-10" r="14" fill={color} />
          <circle cx="16" cy="-10" r="14" fill={color} />
          <circle cx="-6" cy="-28" r="3" fill="#E9AFB4" stroke="none" />
          <circle cx="10" cy="-18" r="3" fill="#E9AFB4" stroke="none" />
        </g>
      );
    case "social":
      return (
        <g {...stroke}>
          <ellipse cx="0" cy="12" rx="40" ry="14" fill="#BFD7E8" />
          <ellipse cx="0" cy="6" rx="16" ry="6" fill="#F6E7D2" />
          <path d="M0 6 L0 -22" strokeWidth="4" />
          <path d="M0 -22 Q-16 -30 -22 -10 M0 -22 Q16 -30 22 -10 M0 -22 Q-4 -38 0 -40 Q4 -38 0 -22" fill="none" stroke="#7FB0D0" strokeWidth="3" />
        </g>
      );
    case "volunteer":
      return (
        <g {...stroke}>
          <path d="M-34 18 L-34 -6 L0 -30 L34 -6 L34 18 Z" fill="#F6E7D2" />
          <path d="M0 10 C-18 -2 -14 -18 -4 -16 C-1 -15 0 -12 0 -10 C0 -12 1 -15 4 -16 C14 -18 18 -2 0 10 Z" fill={color} />
        </g>
      );
    default:
      return (
        <g {...stroke}>
          <rect x="-32" y="-16" width="64" height="34" rx="4" fill="#F6E7D2" />
          <path d="M-38 -16 L-30 -34 L30 -34 L38 -16 Z" fill={color} />
          <rect x="-8" y="0" width="16" height="18" fill="#FFF8EC" />
          <text x="0" y="-19" textAnchor="middle" fontSize="13" fill={INK} stroke="none" fontWeight={700}>
            萬
          </text>
        </g>
      );
  }
}

function Shop({ color }: { color: string }) {
  return (
    <g {...stroke} strokeWidth={2}>
      <rect x="-15" y="-6" width="30" height="22" rx="2" fill="#FFF8EC" />
      <path d="M-20 -5 L0 -22 L20 -5 Z" fill={color} />
      <rect x="-5" y="4" width="10" height="12" fill={color} opacity="0.7" />
    </g>
  );
}

function Presence({ place, x, y }: { place: MapPlace; x: number; y: number }) {
  const shown = place.presence.characters.slice(0, 3);
  const extra = place.presence.total - shown.length;
  if (!shown.length) return null;
  return (
    <g className="presence">
      {shown.map((c, i) => (
        <Avatar key={i} appearance={c.appearance as Appearance} name={`${c.name} 在這裡`} size={38} x={x + i * 24 - 8} y={y} />
      ))}
      {extra > 0 && (
        <text x={x + shown.length * 24 + 16} y={y + 26} fontSize="16" fill={INK} fontWeight={700}>
          +{extra}
        </text>
      )}
    </g>
  );
}

function Tree({ x, y, s = 1, c = "#A9C79A" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...stroke} strokeWidth={2}>
      <path d="M-3 14 L-2 0 L2 0 L3 14 Z" fill="#B88B63" />
      <circle cx="0" cy="-6" r="13" fill={c} />
    </g>
  );
}

const TREES: [number, number, number][] = [
  [40, 60, 1.1], [420, 60, 0.9], [780, 70, 1], [1150, 80, 1.2], [60, 330, 0.9], [1150, 330, 1], [420, 330, 0.8], [790, 330, 0.85],
  [50, 850, 1.1], [420, 840, 0.9], [790, 850, 1], [1160, 840, 1.1], [400, 610, 0.8], [800, 615, 0.8],
];

export function TownMap({ districts, places, children, onInteract }: { districts: District[]; places: MapPlace[]; children?: ReactNode; onInteract?: () => void }) {
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const suppressClick = useRef(false);

  const [box, setBox] = useState({ w: W, h: H });
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width || W, h: e.contentRect.height || H }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // preserveAspectRatio="xMidYMid slice": one viewBox unit = k screen px; the visible area is centred.
  const k = Math.max(box.w / W, box.h / H);
  const visW = box.w / k;
  const visH = box.h / k;
  const clampRef = useRef((v: { s: number; x: number; y: number }) => v);
  clampRef.current = (v) => {
    const sc = Math.min(2.6, Math.max(1, v.s));
    const minX = (W + visW) / 2 - W * sc;
    const maxX = (W - visW) / 2;
    const minY = (H + visH) / 2 - H * sc;
    const maxY = (H - visH) / 2;
    return { s: sc, x: Math.min(maxX, Math.max(minX, v.x)), y: Math.min(maxY, Math.max(minY, v.y)) };
  };
  const clamp = (v: { s: number; x: number; y: number }) => clampRef.current(v);
  const unitsPerPx = () => 1 / k;
  const zoomAt = useCallback((factor: number, cx = W / 2, cy = H / 2) => {
    setView((v) => {
      const sc = Math.min(2.6, Math.max(1, v.s * factor));
      const r = sc / v.s;
      return clampRef.current({ s: sc, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r });
    });
  }, []);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (W - visW) / 2 + (clientX - r.left) / k, y: (H - visH) / 2 + (clientY - r.top) / k };
  };

  const onWheel = (e: RWheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  };
  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    onInteract?.();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
    } else {
      drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.s * (d / pinch.current.d);
      zoomAt(target / view.s);
      suppressClick.current = true;
      return;
    }
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 6) {
      g.moved = true;
      suppressClick.current = true;
    }
    if (g.moved) {
      const u = unitsPerPx();
      setView((v) => clamp({ ...v, x: g.vx + dx * u, y: g.vy + dy * u }));
    }
  };
  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
    setTimeout(() => (suppressClick.current = false), 0);
  };

  const byDistrict = useMemo(() => {
    const m = new Map<string, MapPlace[]>();
    for (const p of places) m.set(p.districtKey, [...(m.get(p.districtKey) ?? []), p]);
    return m;
  }, [places]);

  return (
    <div className="town">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="龍角鎮地圖"
        className="town-svg"
        preserveAspectRatio="xMidYMid slice"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <defs>
          <filter id="lj-wobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="7" />
          </filter>
          <filter id="lj-paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.2  0 0 0 0.06 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <radialGradient id="lj-meadow" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="var(--map-meadow-1)" />
            <stop offset="100%" stopColor="var(--map-meadow-2)" />
          </radialGradient>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
          <rect width={W} height={H} fill="url(#lj-meadow)" />
          <rect width={W} height={H} filter="url(#lj-paper)" fill="#fff" />
          <path
            d="M-20 585 C140 545 260 640 420 600 C560 565 640 620 780 596 C930 570 1040 640 1220 598"
            fill="none"
            stroke="var(--map-river)"
            strokeWidth="44"
            strokeLinecap="round"
            filter="url(#lj-wobble)"
          />
          <path d="M-20 585 C140 545 260 640 420 600 C560 565 640 620 780 596 C930 570 1040 640 1220 598" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeDasharray="14 22" />
          {(["crafts", "music", "learning", "food", "sports", "outdoors", "volunteer", "misc"] as DistrictKey[]).map((k) => {
            const a = LAYOUT.social;
            const b = LAYOUT[k];
            const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
            const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.05;
            return <path key={k} d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke="var(--map-road)" strokeWidth="18" strokeLinecap="round" opacity="0.9" />;
          })}
          {[230, 600, 970].map((x) => (
            <g key={x} transform={`translate(${x} ${x === 600 ? 605 : x === 230 ? 593 : 600})`} {...stroke} strokeWidth={2}>
              <path d="M-26 -12 Q0 -26 26 -12 L26 12 Q0 0 -26 12 Z" fill="#E9D3B4" />
            </g>
          ))}
          {TREES.map(([x, y, s], i) => (
            <Tree key={i} x={x} y={y} s={s} c={i % 3 === 0 ? "#B9D3A0" : i % 3 === 1 ? "#A3C48F" : "#C5DBA9"} />
          ))}

          {districts.map((d) => {
            const L = LAYOUT[d.key];
            return (
              <g key={`blob-${d.key}`} aria-hidden>
                <path d={blobPath(L.x, L.y, L.rx, L.ry, L.seed)} fill={d.color} fillOpacity="0.55" stroke={INK} strokeOpacity="0.35" strokeWidth="2.5" filter="url(#lj-wobble)" />
                <path d={blobPath(L.x, L.y, L.rx * 0.82, L.ry * 0.78, L.seed + 1)} fill={d.color} fillOpacity="0.35" />
              </g>
            );
          })}
          {districts.map((d) => {
            const L = LAYOUT[d.key];
            const ps = byDistrict.get(d.key) ?? [];
            const pub = ps.find((p) => p.kind === "public");
            const shops = ps.filter((p) => p.kind === "shop").sort((a, b) => a.slot - b.slot);
            const shown = shops.slice(0, SLOTS.length);
            return (
              <g key={d.key} data-testid={`district-${d.key}`} className="district">
                {pub && (
                  <Link to={`/places/${pub.id}`} aria-label={`${pub.name}（${pub.deedCount} 個信物）`} className="map-place">
                    <g transform={`translate(${L.x} ${L.y})`}>
                      <circle r="46" fill="transparent" />
                      <Landmark k={d.key} color={d.color} />
                    </g>
                  </Link>
                )}
                {pub && <Presence place={pub} x={L.x + 30} y={L.y + 8} />}
                {shown.map((s, i) => {
                  const [ox, oy] = SLOTS[i];
                  return (
                    <g key={s.id}>
                      <Link to={`/places/${s.id}`} aria-label={`${s.name}（${s.deedCount} 個信物、${s.trialCount} 個試用機會）`} className="map-place">
                        <g transform={`translate(${L.x + ox} ${L.y + oy})`}>
                          <circle r="24" fill="transparent" />
                          <Shop color={s.roofColor} />
                          <text y="34" textAnchor="middle" fontSize="14" fill={INK} className="map-label">
                            {s.name.length > 7 ? `${s.name.slice(0, 7)}…` : s.name}
                          </text>
                        </g>
                      </Link>
                      <Presence place={s} x={L.x + ox + 14} y={L.y + oy - 34} />
                    </g>
                  );
                })}
                {shops.length > SLOTS.length && (
                  <text x={L.x} y={L.y + L.ry - 6} textAnchor="middle" fontSize="13" fill={INK}>
                    還有 {shops.length - SLOTS.length} 間店
                  </text>
                )}
                <g transform={`translate(${L.x} ${L.y - L.ry + 14})`} className="map-banner">
                  <rect x={-62} y={-19} width={124} height={36} rx={18} fill="var(--map-banner)" stroke={INK} strokeWidth="2" />
                  <text y="7" textAnchor="middle" fontSize="20" fontWeight={700} fill={INK}>
                    {d.name}
                  </text>
                </g>
              </g>
            );
          })}
          {children}
        </g>
      </svg>
      <div className="town-controls">
        <button type="button" className="btn round" aria-label="放大" onClick={() => zoomAt(1.25)}>
          ＋
        </button>
        <button type="button" className="btn round" aria-label="縮小" onClick={() => zoomAt(1 / 1.25)}>
          －
        </button>
        <button type="button" className="btn round" aria-label="重置地圖" onClick={() => setView({ s: 1, x: 0, y: 0 })}>
          ⟲
        </button>
      </div>
    </div>
  );
}
