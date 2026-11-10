import { useState } from "react";
import { formatDate } from "../lib/format";
import type { KeepsakeItem } from "../lib/types";

export function CabinetView({ collected, total, items }: { collected: number; total: number; items: KeepsakeItem[] }) {
  const [open, setOpen] = useState<KeepsakeItem | null>(null);
  const groups: { place: string; items: KeepsakeItem[] }[] = [];
  for (const item of items) {
    const place = item.placeName || "鎮上";
    const found = groups.find((g) => g.place === place);
    if (found) found.items.push(item);
    else groups.push({ place, items: [item] });
  }
  const gap = groups.find((g) => g.items.some((i) => !i.collected));
  return (
    <div className="stack cabinet">
      <header className="stack" style={{ gap: 4 }}>
        <h1>信物收藏</h1>
        <p className="stat" aria-label="收藏進度">{collected}/{total}</p>
        <p className="muted">紀念品櫃。{gap ? `${gap.place}那一排還缺一個喔。` : total ? "這一排都撿到了。" : "櫃裡還沒有東西。小龍說牠今天想去原野。"}</p>
      </header>
      {groups.map((g) => (
        <section key={g.place} className="stack" style={{ gap: 8 }}>
          <h2>{g.place}</h2>
          <div className="keepsake-grid">
            {g.items.map((item) => (
              <button
                type="button"
                key={item.deedId}
                className={item.collected ? "keepsake-cell" : "keepsake-cell is-missing"}
                disabled={!item.collected}
                aria-label={item.collected ? item.warmLine : "還沒撿到的信物"}
                onClick={() => item.collected && setOpen(item)}
              >
                <span className="keepsake-emoji" aria-hidden>{item.emoji}</span>
                <small>{item.collected ? item.object : "？"}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      {open && (
        <div className="veil" role="dialog" aria-label={open.object} onClick={() => setOpen(null)}>
          <div className="celebrate" onClick={(e) => e.stopPropagation()}>
            <p className="keepsake-emoji">{open.emoji}</p>
            <p>{open.warmLine}</p>
            <small>{formatDate(open.createdAt)}</small>
            {open.mood ? <p>當時的表情是 {open.mood}</p> : <p className="muted">這顆還沒貼表情。</p>}
          </div>
        </div>
      )}
    </div>
  );
}
