import { STICKERS, growthLine, growthStage, nextGrowthAt, starLine, type Sticker } from "@lj/core";

export function Celebrate({ fromStars, error, onClose }: { fromStars: number; error: string; onClose: (sticker?: Sticker) => void }) {
  const stars = fromStars + 1;
  const goal = nextGrowthAt(stars) ?? stars;
  const stage = growthStage(stars);
  const grew = stage > growthStage(fromStars);
  return (
    <div className="veil" role="dialog" aria-label="做到了" onClick={() => onClose()}>
      <div className="celebrate">
        <div className="confetti" aria-hidden><span>★</span><span>★</span><span>★</span><span>★</span></div>
        <p className="star-pop">★ +1</p>
        <p>{starLine(stars)}</p>
        <p className="stat" aria-label="星星進度">★ {stars}/{goal}</p>
        {grew && <p className="notice grow-note">{growthLine(stage)}</p>}
        <p>當時的表情是？</p>
        <div className="stickers" role="group" aria-label="當時的表情是">
          {STICKERS.map((s) => (
            <button type="button" key={s} className="sticker" onClick={(e) => { e.stopPropagation(); onClose(s); }}>{s}</button>
          ))}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <p className="muted">點旁邊關掉。</p>
      </div>
    </div>
  );
}
