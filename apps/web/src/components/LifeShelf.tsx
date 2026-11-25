import { LIFE_ACTIVITIES, type LifeActivityId, type LifeView, lifeActivityStory } from "@lj/core";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatLifeDay } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";
import { Loading } from "./Bits";
import { Dialog } from "./Dialog";
import { TownMark } from "./TownMark";

export function LifeShelf() {
  const { me, reload } = useSession();
  const life = useFetch<LifeView>(me?.character ? "/api/me/life" : null);
  const [detail, setDetail] = useState<LifeActivityId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gate = useRef(false);
  const data = life.data;
  const item = LIFE_ACTIVITIES.find((a) => a.id === detail);

  async function change(body: object) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api<LifeView>("/api/me/life", { method: "PATCH", body });
      life.setData(next);
      await reload();
      setDetail(null);
    } catch {
      setError("剛剛沒連上。再按一次就好。");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  const keepsakeStory = (id: LifeActivityId, earnedOn: string) =>
    data?.history
      .flatMap((d) => (d.day === earnedOn ? d.entries : []))
      .find((e) => e.activityId === id)?.story ??
    lifeActivityStory(id, new Date(`${earnedOn}T04:00:00Z`));

  return (
    <section id="life" className="stack cabinet-layer" aria-labelledby="brought-home">
      <h2 id="brought-home">小龍帶回來的</h2>
      {!me?.character ? (
        <p>先把牠帶回家，再一起玩。</p>
      ) : !data ? (
        life.error ? (
          <>
            <p role="alert">剛剛沒連上，小龍還在等你。</p>
            <button type="button" className="btn primary" onClick={() => void life.reload()}>
              再看一次
            </button>
          </>
        ) : (
          <Loading />
        )
      ) : (
        <>
          <Link className="btn primary" to="/life">
            去看看小龍今天
          </Link>
          <p>每一件都是鎮上有人親手留給小龍的。</p>
          <p className="life-progress" aria-label="小龍帶回來的進度">
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
        </>
      )}
      {item && data && (
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
    </section>
  );
}
