import { DISTRICT_KEYS } from "@lj/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./Dialog";
import { formatDate } from "../lib/format";
import type { KeepsakeItem } from "../lib/types";

export function CabinetView({ collected, total, items, pendingId, onAccept }: { collected: number; total: number; items: KeepsakeItem[]; pendingId?: string | null; onAccept?: (item: KeepsakeItem) => Promise<void> }) {
  const [open, setOpen] = useState<KeepsakeItem | null>(null);
  const [busy, setBusy] = useState(false);
  const newest = items.filter((i) => i.collected).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const ranked = [...items].sort((a, b) => {
    if (a.deedId === newest?.deedId) return -1;
    if (b.deedId === newest?.deedId) return 1;
    if (a.collected !== b.collected) return a.collected ? -1 : 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  const groups: { place: string; items: KeepsakeItem[] }[] = [];
  for (const item of ranked) {
    const place = item.placeName || "鎮上";
    const found = groups.find((g) => g.place === place);
    if (found) found.items.push(item);
    else groups.push({ place, items: [item] });
  }
  const kinds = new Set(items.filter((i) => i.collected).map((i) => i.districtKey)).size;
  const catalog = DISTRICT_KEYS.length;
  const left = catalog - kinds;
  return (
    <div className="stack cabinet">
      <header className="stack" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>收藏櫃</h1>
          <Link to="/" className="btn ghost">回小龍身邊</Link>
        </div>
        {newest ? (
          <button type="button" className="btn primary" onClick={() => setOpen(newest)}>看看剛撿到的</button>
        ) : (
          <Link to="/" className="btn primary">去找一顆信物</Link>
        )}
        <p className="stat" aria-label="收藏進度">{kinds}/{catalog}</p>
        <p className="muted">{newest ? `收到了${newest.object}。還有 ${left} 件沒撿到。` : total ? "都撿齊了。" : "櫃裡還沒有東西。小龍說牠今天想去原野。"}</p>
      </header>
      {groups.map((g) => (
        <section key={g.place} className="stack" style={{ gap: 8 }}>
          <h2>{g.place}</h2>
          <div className="keepsake-grid">
            {g.items.map((item) => (
              <button
                type="button"
                key={item.deedId}
                className={item.collected ? `keepsake-cell${item.deedId === newest?.deedId ? " is-new" : ""}` : "keepsake-cell is-missing"}
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
