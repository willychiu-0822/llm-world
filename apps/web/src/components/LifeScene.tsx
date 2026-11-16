import type { ReactNode } from "react";

const INK = "#4a3f35";
const SKY: Record<string, [string, string]> = {
  早晨: ["#fdeccb", "#fbf6ec"],
  午後: ["#bcdcf0", "#e9f4fa"],
  傍晚: ["#f3b592", "#fbe3c4"],
  夜裡: ["#2f3a5c", "#56608a"],
};
const LAND: Record<string, { far: string; near: string; leaf: string }> = {
  春: { far: "#cfe6bd", near: "#b4d79c", leaf: "#f6c1cf" },
  夏: { far: "#a8d39a", near: "#86bf73", leaf: "#5f9d55" },
  秋: { far: "#ecd29a", near: "#dfb873", leaf: "#e08a4a" },
  冬: { far: "#e4ecf2", near: "#f7fafc", leaf: "#f7fafc" },
};

/** 小龍當下待的地方：季節決定山坡和樹，時段決定天色。小龍本人由 children 放進來。 */
export function LifeScene({ season, period, lantern = false, label, children }: { season: string; period: string; lantern?: boolean; label: string; children: ReactNode }) {
  const [skyTop, skyBottom] = SKY[period] ?? SKY["午後"]!;
  const land = LAND[season] ?? LAND["春"]!;
  const night = period === "夜裡";
  const id = `life-sky-${period}`;
  return <div className="life-scene-art" role="img" aria-label={label} data-season={season} data-period={period}>
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={skyTop} /><stop offset="1" stopColor={skyBottom} /></linearGradient></defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
      {period === "早晨" && <circle cx="62" cy="96" r="20" fill="#f9d77a" />}
      {period === "午後" && <><circle cx="250" cy="38" r="18" fill="#fbe08a" /><path d="M48 44h34a9 9 0 0 0 0-18 14 14 0 0 0-26-3 11 11 0 0 0-8 21z" fill="#fff" opacity=".85" /></>}
      {period === "傍晚" && <circle cx="262" cy="100" r="22" fill="#f08a5d" />}
      {night && <><path d="M252 26a18 18 0 1 0 14 30 22 22 0 0 1-14-30z" fill="#f7e7a6" />{[[40, 30], [96, 52], [150, 22], [204, 60], [292, 84], [20, 78]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#f7e7a6" />)}</>}
      <path d="M0 132c50-34 96-34 150-8s112 14 170-14v90H0z" fill={land.far} opacity={night ? .55 : 1} />
      <path d="M0 158c70-26 130-20 180-8s96 6 140-8v58H0z" fill={land.near} opacity={night ? .6 : 1} />
      {/* 小屋和樹都往中間靠：手機上畫面會裁掉左右兩邊 */}
      <g transform="translate(30 0)"><g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
        <rect x="30" y="112" width="52" height="40" rx="4" fill="#fbf6ec" />
        <path d="M24 114l32-26 32 26z" fill={season === "冬" ? "#f7fafc" : "#e9a3a0"} />
        <rect x="49" y="128" width="14" height="24" rx="6" fill="#c9a37a" />
        <rect x="67" y="122" width="10" height="10" rx="2" fill={night || period === "傍晚" ? "#f9d77a" : "#cfe5f2"} />
      </g>
      {lantern && <g data-part="lantern" stroke={INK} strokeWidth="2"><path d="M96 100v10" fill="none" /><rect x="89" y="110" width="14" height="18" rx="6" fill="#ef8f6b" /><path d="M96 128v6" fill="none" /></g>}</g>
      <g transform="translate(-26 0)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M262 156v-34" fill="none" strokeWidth="5" />
        {season === "冬"
          ? <><path d="M262 132l-16-14M262 126l16-16M262 122v-16" fill="none" /><path d="M244 116q6-6 10 2M270 110q6-6 10 0" fill="none" stroke="#fff" strokeWidth="4" /></>
          : <><circle cx="262" cy="104" r="26" fill={land.leaf} /><circle cx="244" cy="116" r="14" fill={land.leaf} /><circle cx="280" cy="116" r="14" fill={land.leaf} /></>}
      </g>
      {season === "春" && [[224, 96], [244, 108], [232, 118], [200, 150], [130, 168]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#fff" stroke="#e58fa6" strokeWidth="1.4" />)}
      {season === "夏" && <path d="M120 176q4-12 8 0M196 172q4-12 8 0M296 176q4-12 8 0" fill="none" stroke="#4f8747" strokeWidth="2.4" strokeLinecap="round" />}
      {season === "秋" && [[226, 150], [292, 160], [206, 172], [120, 170]].map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y}q5-7 10 0q-5 5-10 0z`} fill="#e08a4a" stroke={INK} strokeWidth="1.2" />)}
      {season === "冬" && [[30, 40], [80, 70], [130, 36], [180, 84], [230, 64], [300, 40], [110, 104], [200, 30]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#fff" />)}
    </svg>
    <div className="life-scene-dragon">{children}</div>
  </div>;
}
