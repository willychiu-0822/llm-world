import { login, type useTestApp } from "./helpers";

type Env = ReturnType<typeof useTestApp>;

export async function approvedProvider(env: Env, email = "leo@example.com", name = "Leo 的新手慢跑") {
  const leo = await login(env.app, email, "Leo");
  const applied = await leo.post("/api/provider/apply").send({ name, description: "每週日帶新手慢跑" });
  if (applied.status !== 201) throw new Error(JSON.stringify(applied.body));
  const admin = await login(env.app, "admin@example.com");
  const ok = await admin.post(`/api/admin/providers/${applied.body.id}/approve`);
  if (ok.status !== 200) throw new Error(JSON.stringify(ok.body));
  return leo;
}

export async function leoTrial(env: Env, leo: Awaited<ReturnType<typeof login>>) {
  const shop = (await leo.post("/api/provider/shops").send({ districtKey: "sports", name: "Leo 慢跑站", realAddress: "台北市河濱公園入口", roofColor: "#A8C8A0" })).body;
  const trial = (
    await leo.post("/api/provider/trials").send({
      placeId: shop.id,
      title: "新手 5K 慢跑",
      durationMin: 60,
      exitAnytime: true,
      buddyOk: true,
      whenText: "每週日 07:00",
      processInfo: "前 10 分鐘只做暖身；大約一半的人是第一次跑；最慢的人由我陪跑。",
      aiFirstStepHint: "來問 Leo 的 agent 任何問題",
      selfFirstStepHint: "報名這週日的慢跑",
    })
  ).body;
  await leo.post(`/api/provider/trials/${trial.id}/faqs`).send({ question: "跟不上怎麼辦？", answer: "可以走跑交替，我會陪最後一位。" });
  const session = (await leo.post(`/api/provider/trials/${trial.id}/sessions`).send({ startsAt: "2030-11-10T07:00:00+08:00", capacity: 2 })).body;
  return { shop, trial, session };
}

