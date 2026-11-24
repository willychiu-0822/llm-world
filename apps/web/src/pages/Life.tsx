import { LIFE_ACTIVITIES, lifeActivityStory, type LifeActivityId, type LifeView } from "@lj/core";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Dialog";
import { TownMark } from "../components/TownMark";
import { LifeScene } from "../components/LifeScene";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { formatLifeDay } from "../lib/format";
import { useFetch } from "../lib/useFetch";

function Meeting({ data }: { data: LifeView }) {
  const e = data.encounter;
  return (
    <div className="life-meeting">
      {e.kind === "player" && <Avatar appearance={e.appearance as never} name={e.name} size={56} />}
      <p>
        {e.kind === "player"
          ? `在小栗家碰到「${e.name}」的小龍，一起喝了茶。`
          : "小栗在家等著，茶都泡好了。"}
      </p>
    </div>
  );
}

export function LifePage({ cabinet = false }: { cabinet?: boolean }) {
  const { me, reload } = useSession();
  const life = useFetch<LifeView>(me?.character ? "/api/me/life" : null);
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<LifeActivityId>("music");
  const [result, setResult] = useState<LifeActivityId | null>(null);
  const [detail, setDetail] = useState<LifeActivityId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gate = useRef(false);
  const data = life.data;
  const activity = data?.activities.find((a) => a.id === selected);
  const item = LIFE_ACTIVITIES.find((a) => a.id === detail);
  const reward = data?.activities.find((a) => a.id === result);

  async function change(body: object, play = false) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api<LifeView>(play ? "/api/me/life/activities" : "/api/me/life", {
        method: play ? "POST" : "PATCH",
        body,
      });
      life.setData(next);
      await reload();
      if (play) {
        setChoosing(false);
        setResult(selected);
      } else setDetail(null);
    } catch {
      setError("剛剛沒連上。再按一次就好。");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function loadVisit() {
    setBusy(true);
    setError("");
    try {
      life.setData(await api<LifeView>("/api/me/life?visit=1"));
    } catch {
      setError("剛剛沒連上。再按一次就好。");
    } finally {
      setBusy(false);
    }
  }
  function pickPlace(id: LifeActivityId) {
    setSelected(id);
    if (id === "visit") void loadVisit();
  }
  function choose() {
    const available = data?.activities.filter((a) => a.open && !a.done) ?? [];
    const next =
      available.find((a) => a.id === data?.recommendedId)?.id ?? available[0]?.id ?? "music";
    setSelected(next);
    setChoosing(true);
    if (next === "visit") void loadVisit();
  }
  if (!me?.character)
    return (
      <section className="panel stack">
        <h1>小龍還在蛋裡</h1>
        <p>先把牠帶回家，再一起玩。</p>
        <Link to="/" className="btn primary">
          回小龍身邊
        </Link>
      </section>
    );
  if (!data)
    return (
      <section className="panel stack">
        <h1>小龍的今天</h1>
        <p role={life.error ? "alert" : "status"}>
          {life.error ? "剛剛沒連上，小龍還在等你。" : "翻開今天的小本子…"}
        </p>
        {life.error && (
          <button className="btn primary" onClick={() => void life.reload()}>
            再看一次
          </button>
        )}
        <Link className="btn ghost" to="/">
          回小龍身邊
        </Link>
      </section>
    );
  const openToday = data.activities.filter((a) => a.open);
  const allDone = openToday.every((a) => a.done);
  const keepsakeStory = (id: LifeActivityId, earnedOn: string) =>
    data.history
      .flatMap((d) => (d.day === earnedOn ? d.entries : []))
      .find((e) => e.activityId === id)?.story ??
    lifeActivityStory(id, new Date(`${earnedOn}T04:00:00Z`));
  return (
    <div className="stack life-page">
      <div className="row between">
        <h1>{cabinet ? "生活收藏" : "小龍的今天"}</h1>
        <Link className={`btn ${cabinet ? "primary" : "ghost small"}`} to="/">
          回小龍身邊
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {cabinet ? (
        <>
          <p>每一件都是鎮上有人親手留給小龍的。</p>
          <p className="life-progress" aria-label="生活收藏進度">
            {data.inventory.length}/{LIFE_ACTIVITIES.length}
          </p>
          <div className="life-shelf">
            {LIFE_ACTIVITIES.map((a) => {
              const owned = data.inventory.some((i) => i.activityId === a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`life-item ${owned ? "" : "is-missing"}`}
                  onClick={() => setDetail(a.id)}
                  aria-label={`${a.reward}${owned ? "，已收集" : "，還沒帶回家"}`}
                >
                  <span className="life-object" aria-hidden>
                    <TownMark name={a.id} size={40} />
                  </span>
                  <strong>{a.reward}</strong>
                  <small>{a.category}</small>
                  <span>{owned ? `${a.giver}留的` : "還沒帶回家"}</span>
                </button>
              );
            })}
          </div>
          <Link className="btn ghost" to="/life">
            去看看小龍今天
          </Link>
        </>
      ) : (
        <>
          <section className="panel life-today life-first" aria-label="小龍現在">
            <LifeScene
              season={data.season}
              period={data.period}
              lantern={!!data.decoration}
              label={`${data.season}天${data.period}的龍角鎮，${me.character.name}在家門口`}
            >
              <Avatar
                appearance={me.character.appearance as never}
                name={me.character.name}
                size={104}
              />
              {data.outfit && (
                <span className="life-scene-outfit" aria-hidden>
                  🧣
                </span>
              )}
            </LifeScene>
            <div className="stack life-first-words">
              <p className="muted">
                {formatLifeDay(data.today.day, { season: data.season, period: data.period })}
              </p>
              <h2>
                {me.character.name}，今天{data.mood}
              </h2>
              <p>{data.today.autonomous}</p>
              {allDone ? (
                <Link to="/life/cabinet" className="btn primary">
                  看看今天帶回來的
                </Link>
              ) : (
                <button type="button" className="btn primary" onClick={choose}>
                  陪牠去玩
                </button>
              )}
            </div>
          </section>
          <div className="life-columns">
            <section className="panel stack life-mind" aria-label="小龍在想什麼">
              <h2>牠在想什麼</h2>
              <p className="life-scene">{data.scene}</p>
              <div className="life-wish">
                <strong>想要什麼？</strong>
                <p>{data.wish}</p>
                <strong>可以幫點什麼？</strong>
                <p>{data.help}</p>
              </div>
              <p className="muted">
                {allDone
                  ? "今天想去的地方都去了。明天牠會想去別的地方。"
                  : `小龍今天只想去 ${openToday.map((a) => a.place).join("、")}。其他地方明天再說。`}
              </p>
            </section>
            <section className="panel stack life-diary" aria-label="小龍日記">
              <h2>今天的小本子</h2>
              {data.today.entries.length ? (
                <ul className="plain stack">
                  {data.today.entries.map((e) => {
                    const a = LIFE_ACTIVITIES.find((a) => a.id === e.activityId)!;
                    return (
                      <li key={e.activityId} className="life-entry">
                        <strong>
                          <TownMark name={a.id} size={22} /> {a.name}
                        </strong>
                        <p>{e.story}</p>
                        <small>帶回了{a.reward}。</small>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>今天先慢慢晃。上面那件糗事，已經夠牠笑半天。</p>
              )}
              <Link className="btn ghost" to="/life/cabinet">
                打開生活收藏
              </Link>
            </section>
          </div>
          <div className="life-columns">
            <section className="panel stack life-heart" aria-label="鎮民的心意">
              <h2>鎮民的心意</h2>
              {data.inspiration ? (
                <>
                  <p>
                    {data.inspiration.isDemo ? "範例" : data.inspiration.who}留下一份心意：「
                    {data.inspiration.title}」
                  </p>
                  <p className="muted">在{data.inspiration.placeName}</p>
                  <Link className="btn ghost" to={`/places/${data.inspiration.placeId}`}>
                    去看看這份心意
                  </Link>
                </>
              ) : (
                <p>鎮上還沒有人留下新的心意。小龍會幫你留意。</p>
              )}
            </section>
            <section className="panel stack life-visit" aria-label="串門子">
              <h2>串門子</h2>
              <p>
                {data.allowVisits
                  ? "小龍會去朋友家串門，也可能被別的小龍遇到。別人只看得到名字和長相。"
                  : "小龍先待在家，不去串門。"}
              </p>
              <button
                type="button"
                className="btn ghost"
                aria-busy={busy}
                disabled={busy}
                onClick={() => void change({ allowVisits: !data.allowVisits })}
              >
                {data.allowVisits ? "先不串門" : "讓小龍去串門"}
              </button>
            </section>
          </div>
          {data.history.length > 1 && (
            <section className="panel stack">
              <h2>前幾天也很好玩</h2>
              {data.history.slice(1).map((day) => (
                <article key={day.day}>
                  <h3>{formatLifeDay(day.day)}</h3>
                  <p>{day.autonomous}</p>
                  <p>
                    {day.entries
                      .map((e) => LIFE_ACTIVITIES.find((a) => a.id === e.activityId)!.name)
                      .join("、")}
                  </p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {choosing && (
        <Dialog title="陪小龍去玩" busy={busy} onClose={() => setChoosing(false)}>
          <h2>這次去哪裡？</h2>
          <div className="life-choices" role="radiogroup" aria-label="挑一個小冒險">
            {data.activities.map((a) => (
              <button
                type="button"
                role="radio"
                aria-checked={selected === a.id}
                key={a.id}
                className={`btn ghost ${selected === a.id ? "is-chosen" : ""}`}
                disabled={busy || a.done || !a.open}
                onClick={() => pickPlace(a.id)}
              >
                <TownMark name={a.id} size={22} />{" "}
                <span>
                  {a.name}
                  {a.done ? " · 今天玩過了" : !a.open ? " · 今天沒開" : ""}
                </span>
              </button>
            ))}
          </div>
          <p>{activity?.story}</p>
          {selected === "visit" && <Meeting data={data} />}
          <p className="muted">帶回：{activity?.reward}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn primary"
            aria-busy={busy}
            disabled={busy}
            onClick={() => void change({ activityId: selected }, true)}
          >
            {busy ? "小龍出發囉…" : "就去這裡"}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => setChoosing(false)}
          >
            先待在家
          </button>
        </Dialog>
      )}
      {reward && (
        <Dialog title="帶回小驚喜" onClose={() => setResult(null)}>
          <p className="life-object" aria-hidden>
            <TownMark name={reward.id} size={56} />
          </p>
          <h2>{reward.reward}，帶回來了！</h2>
          <p>{reward.story}</p>
          <p className="life-origin">
            <strong>{reward.giver}留給小龍的</strong>
            {reward.origin}
          </p>
          {result === "visit" && <Meeting data={data} />}
          <p>小龍說：「下次還想跟你一起。」</p>
          <button type="button" className="btn primary" onClick={() => setResult(null)}>
            收好紀念品
          </button>
        </Dialog>
      )}
      {item && (
        <Dialog title={item.reward} busy={busy} onClose={() => setDetail(null)}>
          <p className="life-object" aria-hidden>
            <TownMark name={item.id} size={56} />
          </p>
          <h2>{item.reward}</h2>
          <p>{item.category}</p>
          {data.inventory.find((i) => i.activityId === item.id) ? (
            <>
              <p>
                {formatLifeDay(data.inventory.find((i) => i.activityId === item.id)!.earnedOn)} ·{" "}
                {item.place}
              </p>
              <p className="life-origin">
                <strong>{item.giver}留給小龍的</strong>
                {item.origin}
              </p>
              <p>
                {keepsakeStory(
                  item.id,
                  data.inventory.find((i) => i.activityId === item.id)!.earnedOn,
                )}
              </p>
              {item.id === "shop" || item.id === "festival" ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() =>
                    void change(
                      item.id === "shop"
                        ? { outfit: data.outfit ? null : "shop" }
                        : { decoration: data.decoration ? null : "festival" },
                    )
                  }
                >
                  {busy
                    ? "放好囉…"
                    : item.id === "shop"
                      ? data.outfit
                        ? "收回圍巾"
                        : "穿上圍巾"
                      : data.decoration
                        ? "收起小燈"
                        : "擺在家裡"}
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={() => setDetail(null)}>
                  收好
                </button>
              )}
            </>
          ) : (
            <>
              <p className="life-origin is-waiting">
                <strong>這一格在等{item.giver}</strong>還不知道會留下什麼。
              </p>
              <p>陪小龍{item.name}，就能帶回來。</p>
              <Link to="/life" className="btn primary" onClick={() => setDetail(null)}>
                找小龍一起玩
              </Link>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
