import { DISTRICT_KEYS, KEEPSAKES, type DistrictKey } from "@lj/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./Dialog";
import { formatDate } from "../lib/format";
import type { KeepsakeItem } from "../lib/types";

export function CabinetView({ total, items, pendingId, onAccept }: { collected: number; total: number; items: KeepsakeItem[]; pendingId?: string | null; onAccept?: (item: KeepsakeItem) => Promise<void> }) {
  const [pile, setPile] = useState<KeepsakeItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const newest = items.filter((i) => i.collected).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const slots = DISTRICT_KEYS.map((key) => {
    const got = items.filter((i) => i.districtKey === key && i.collected).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return { key, kind: KEEPSAKES[key as DistrictKey], got };
  }).sort((a, b) => {
    const aNew = a.got.some((i) => i.deedId === newest?.deedId);
    const bNew = b.got.some((i) => i.deedId === newest?.deedId);
    if (aNew !== bNew) return aNew ? -1 : 1;
    if (Boolean(a.got.length) !== Boolean(b.got.length)) return a.got.length ? -1 : 1;
    return 0;
  });
  const kinds = slots.filter((s) => s.got.length).length;
  const catalog = slots.length;
  const left = catalog - kinds;
  const open = pile?.[index] ?? null;
  const show = (slotGot: KeepsakeItem[], at = 0) => {
    setPile(slotGot);
    setIndex(at);
  };
  return (
    <div className="stack cabinet">
      <header className="stack" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>收藏櫃</h1>
          <Link to="/" className="btn ghost">回小龍身邊</Link>
        </div>
        {newest ? (
          <button type="button" className="btn primary" onClick={() => show(slots.find((s) => s.got.some((i) => i.deedId === newest.deedId))?.got ?? [newest])}>看看剛撿到的</button>
        ) : (
          <Link to="/" className="btn primary">去找一顆信物</Link>
        )}
        <p className="stat" aria-label="收藏進度">{kinds}/{catalog}</p>
        <p className="muted">{newest ? `收到了${newest.object}。還有 ${left} 件沒撿到。` : total ? "都撿齊了。" : "櫃裡還沒有東西。小龍說牠今天想去原野。"}</p>
      </header>
      <div className="keepsake-grid" aria-label="九種信物">
        {slots.map((slot) => {
          const got = slot.got.length > 0;
          const top = slot.got[0];
          return (
            <button
              type="button"
              key={slot.key}
              className={got ? `keepsake-cell${top?.deedId === newest?.deedId ? " is-new" : ""}` : "keepsake-cell is-missing"}
              disabled={!got}
              aria-label={got ? `${slot.kind.name}${slot.got.length > 1 ? ` ${slot.got.length} 顆` : ""}` : `還沒撿到的${slot.kind.name}`}
              onClick={() => got && show(slot.got)}
            >
              <span className="keepsake-emoji" aria-hidden>{slot.kind.emoji}</span>
              <small>{slot.kind.name}</small>
              {slot.got.length > 1 && <span className="keepsake-count">{slot.got.length}</span>}
            </button>
          );
        })}
      </div>
      {open && pile && (
        <Dialog title={open.object} busy={busy} onClose={() => { if (!busy) setPile(null); }}>
          <p className="keepsake-emoji">{open.emoji}</p>
          <p>{open.warmLine}</p>
          <small>{formatDate(open.createdAt)}</small>
          {open.mood ? <p>當時的表情是 {open.mood}</p> : <p className="muted">這顆還沒貼表情。</p>}
          {pile.length > 1 && (
            <div className="row" style={{ justifyContent: "center" }}>
              <button type="button" className="btn ghost" onClick={() => setIndex((i) => (i + pile.length - 1) % pile.length)}>上一顆</button>
              <span>{index + 1}/{pile.length}</span>
              <button type="button" className="btn ghost" onClick={() => setIndex((i) => (i + 1) % pile.length)}>下一顆</button>
            </div>
          )}
          {open.deedId === pendingId && onAccept ? (
            <button type="button" className="btn primary" disabled={busy} onClick={() => { setBusy(true); void onAccept(open).catch(() => setBusy(false)); }}>{busy ? "記下來…" : "我也去摸摸看"}</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setPile(null)}>收好信物</button>
          )}
        </Dialog>
      )}
    </div>
  );
}
