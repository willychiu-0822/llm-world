import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./Dialog";
import { formatDate } from "../lib/format";
import type { KeepsakeItem } from "../lib/types";

export function CabinetView({ collected, total, items, pendingId, onAccept }: { collected: number; total: number; items: KeepsakeItem[]; pendingId?: string | null; onAccept?: (item: KeepsakeItem) => Promise<void> }) {
  const [open, setOpen] = useState<KeepsakeItem | null>(null);
  const [busy, setBusy] = useState(false);
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
        <Link to="/" className="btn primary">回小龍身邊</Link>
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
        <Dialog title={open.object} busy={busy} onClose={() => { if (!busy) setOpen(null); }}>
          <p className="keepsake-emoji">{open.emoji}</p>
          <p>{open.warmLine}</p>
          <small>{formatDate(open.createdAt)}</small>
          {open.mood ? <p>當時的表情是 {open.mood}</p> : <p className="muted">這顆還沒貼表情。</p>}
          {open.deedId === pendingId && onAccept ? (
            <button type="button" className="btn primary" disabled={busy} onClick={() => { setBusy(true); void onAccept(open).catch(() => setBusy(false)); }}>{busy ? "記下來…" : "我也去摸摸看"}</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setOpen(null)}>好</button>
          )}
        </Dialog>
      )}
    </div>
  );
}
