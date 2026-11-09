import { ACCESSORIES, ACCESSORY_LABELS, BODY_LABELS, BODY_SHAPES, DEFAULT_APPEARANCE, DISTRICTS, PALETTE, type Appearance } from "@lj/core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { DistrictTag } from "../components/Bits";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function CharacterPage() {
  const { me, reload, toast } = useSession();
  const [name, setName] = useState(me?.character?.name ?? "");
  const [appearance, setAppearance] = useState<Appearance>((me?.character?.appearance as Appearance) ?? DEFAULT_APPEARANCE);
  const [personality, setPersonality] = useState(me?.character?.personality ?? "");
  const [allowAiQuotes, setAllowAiQuotes] = useState(me?.character?.sharing.allowAiQuotes ?? true);
  const [error, setError] = useState("");
  const [want, setWant] = useState("");
  const wantInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [nextWant, setNextWant] = useState(false);
  const [district, setDistrict] = useState("music");

  useEffect(() => {
    if (me?.character) {
      setName(me.character.name);
      setAppearance(me.character.appearance as Appearance);
      setPersonality(me.character.personality);
      setAllowAiQuotes(me.character.sharing.allowAiQuotes);
    }
  }, [me?.character?.id]);

  const set = (patch: Partial<Appearance>) => setAppearance((a) => ({ ...a, ...patch }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const firstSave = !me?.character;
    try {
      await api("/api/me/character", { method: "PUT", body: { name, appearance, personality, sharing: { allowAiQuotes } } });
      setError("");
      await reload();
      setSaved(true);
      setNextWant(firstSave);
      if (firstSave) {
        wantInput.current?.focus({ preventScroll: true });
        wantInput.current?.scrollIntoView({ block: "center" });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const addWant = async (e: FormEvent) => {
    e.preventDefault();
    if (!want.trim()) return;
    try {
      await api("/api/me/wants", { method: "POST", body: { text: want, districtKey: district } });
      setWant("");
      await reload();
      toast("記下來了");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const setStatus = async (id: string, status: string) => {
    await api(`/api/me/wants/${id}`, { method: "PATCH", body: { status } });
    await reload();
  };

  return (
    <div className="stack" style={{ maxWidth: 820, margin: "0 auto" }}>
      <form className="panel stack" onSubmit={save} aria-label="角色設定">
        <h1>我的角色</h1>
        <p className="muted">角色可以和你完全不同。牠是你在鎮上的「可能的自己」：替你探索，也讓你嘗試新事物時多一層勇氣。</p>
        <div className="row wrap character-layout" style={{ alignItems: "flex-start" }}>
          <div className="panel soft character-preview" style={{ display: "grid", placeItems: "center", minWidth: 160 }}>
            <Avatar appearance={appearance} name={name || "我的角色"} size={140} />
            <strong>{name || "（名字）"}</strong>
          </div>
          <div className="stack grow">
            <label className="field">
              <span>名字</span>
              <input aria-label="角色名字" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
            </label>
            <div className="field">
              <span>體型</span>
              <div className="pick">
                {BODY_SHAPES.map((b) => (
                  <button type="button" key={b} aria-pressed={appearance.body === b} onClick={() => set({ body: b })}>
                    <Avatar appearance={{ ...appearance, body: b, accessory: "none" }} name={BODY_LABELS[b]} size={44} />
                    {BODY_LABELS[b]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>配件</span>
              <div className="pick">
                {ACCESSORIES.map((a) => (
                  <button type="button" key={a} aria-pressed={appearance.accessory === a} onClick={() => set({ accessory: a })}>
                    <Avatar appearance={{ ...appearance, accessory: a }} name={ACCESSORY_LABELS[a]} size={44} />
                    {ACCESSORY_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>身體顏色</span>
              <div className="swatches">
                {PALETTE.map((c) => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`身體顏色 ${c}`} aria-pressed={appearance.main === c} onClick={() => set({ main: c })} />)}
              </div>
            </div>
            <div className="field">
              <span>配件顏色</span>
              <div className="swatches">
                {PALETTE.map((c) => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`配件顏色 ${c}`} aria-pressed={appearance.accent === c} onClick={() => set({ accent: c })} />)}
              </div>
            </div>
          </div>
        </div>
        <label className="field">
          <span>外觀描述（別人看得到）</span>
          <input aria-label="外觀描述" value={appearance.description} onChange={(e) => set({ description: e.target.value })} maxLength={120} placeholder="例如：背著吉他的街頭歌手" />
        </label>
        <label className="field">
          <span>個性（給你的 AI 參考）</span>
          <textarea aria-label="個性" value={personality} onChange={(e) => setPersonality(e.target.value)} rows={2} maxLength={200} placeholder="例如：外向、愛熱鬧、喜歡站上舞台" />
        </label>
        <label className="check">
          <input type="checkbox" checked={allowAiQuotes} onChange={(e) => setAllowAiQuotes(e.target.checked)} />
          允許別人的 AI 角色引用我分享的隨筆（回答他們的問題）
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="btn primary" type="submit">儲存角色</button>
      </form>

      <section className="panel stack">
        <h2>想做的事</h2>
        {saved && <p role="status" className="notice">角色已儲存{nextWant ? "。下一步：寫下一件想做的事" : "。"}</p>}
        <p className="muted">可以很模糊。你的角色會依這些方向，在鎮上找跟你相似的人的第一步。</p>
        <ul className="plain">
          {me?.wants.map((w) => (
            <li key={w.id} className="row wrap">
              <DistrictTag k={w.districtKey} />
              <span className="grow" style={{ textDecoration: w.status === "done" ? "line-through" : undefined }}>{w.text}</span>
              {w.status === "active" ? (
                <button className="btn small ghost" onClick={() => setStatus(w.id, "done")}>做到了</button>
              ) : (
                <button className="btn small ghost" onClick={() => setStatus(w.id, "active")}>再想做一次</button>
              )}
              <button className="btn small ghost" onClick={() => setStatus(w.id, "dropped")}>先放下</button>
            </li>
          ))}
        </ul>
        <form className="row wrap" onSubmit={addWant} aria-label="新增想做的事">
          <input ref={wantInput} aria-label="想做的事" className="grow" value={want} onChange={(e) => setWant(e.target.value)} placeholder="例如：想在別人面前唱一首歌" maxLength={100} style={{ minWidth: 200, flex: 2 }} />
          <select aria-label="主題區" value={district} onChange={(e) => setDistrict(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
            {DISTRICTS.map((d) => <option key={d.key} value={d.key}>{d.name}（{d.theme}）</option>)}
          </select>
          <button className="btn" type="submit">寫下來</button>
        </form>
      </section>
    </div>
  );
}
