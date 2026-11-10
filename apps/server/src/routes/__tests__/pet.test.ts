import { describe, expect, it } from "vitest";
import { login, nova, userWithCharacter, useTestApp } from "../../test/helpers";

async function deed(agent: Awaited<ReturnType<typeof login>>, text: string) {
  const step = (await agent.post("/api/first-steps").send({ executor: "self", text })).body;
  return (await agent.post(`/api/first-steps/${step.id}/complete`).send({})).body.deed as { id: string; title: string };
}

describe("novice keepsakes", () => {
  const env = useTestApp();

  it("brings back someone else's keepsake, a backpack, and a grey silhouette for the rest", async () => {
    const mia = await userWithCharacter(env.app, "mia@example.com", { ...nova, name: "小雀" });
    const a = await deed(mia, "去上一次聲樂課");
    const b = await deed(mia, "在樂器行摸一把吉他");
    const baby = await userWithCharacter(env.app, "baby@example.com", { ...nova, name: "小龍" });

    const walked = await baby.post("/api/me/walk");
    expect(walked.status).toBe(200);
    expect(walked.body.reward).toBe("backpack");
    expect([a.id, b.id]).toContain(walked.body.keepsake.deedId);
    expect(walked.body.keepsake.warmLine).toContain("小雀的");
    expect(walked.body.keepsake.warmLine).not.toContain("明信片");
    expect(walked.body.pet).toMatchObject({ collected: 1, total: 2, accessories: ["backpack"], canWalk: false, stars: 0, stage: 0 });
    expect(walked.body.pet.pending.deedId).toBe(walked.body.keepsake.deedId);

    const again = await baby.post("/api/me/walk");
    expect(again.status).toBe(409);
    const taken = await baby.post("/api/first-steps").send({ executor: "self", text: "我也去摸摸看", sourceDeedIds: [walked.body.keepsake.deedId] });
    expect(taken.status).toBe(201);
    expect((await baby.get("/api/me")).body.pet.pending).toBeNull();

    const dex = (await baby.get("/api/me/keepsakes")).body;
    expect(dex.collected).toBe(1);
    expect(dex.total).toBe(2);
    expect(dex.items.filter((i: { collected: boolean }) => !i.collected)).toHaveLength(1);
    expect(dex.items.find((i: { collected: boolean }) => !i.collected).warmLine).toBeUndefined();

    const renamed = await baby.put("/api/me/character").send({ ...nova, name: "小龍二號" });
    expect(renamed.body.pet.collected).toBe(1);
    expect(renamed.body.pet.accessories).toEqual(["backpack"]);
  });

  it("does not hand the baby their own deed, and stars grow when a challenge is done", async () => {
    const baby = await userWithCharacter(env.app, "solo@example.com");
    await deed(baby, "自己的事");
    expect((await baby.post("/api/me/walk")).status).toBe(409);

    const pal = await userWithCharacter(env.app, "pal@example.com", { ...nova, name: "阿遊" });
    const theirs = await deed(pal, "摸了一把吉他");
    const walked = await baby.post("/api/me/walk");
    expect(walked.body.keepsake.deedId).toBe(theirs.id);

    const step = (await baby.post("/api/first-steps").send({ executor: "self", text: "我也去摸一把", sourceDeedIds: [theirs.id] })).body;
    expect((await baby.post(`/api/first-steps/${step.id}/complete`).send({ noteAfter: "😆" })).status).toBe(200);
    const mood = await baby.patch("/api/me/pet").send({ mood: { deedId: theirs.id, sticker: "😆" } });
    expect(mood.body).toMatchObject({ stars: 2, stage: 0, nextAt: 3 });
    const dex = (await baby.get("/api/me/keepsakes")).body;
    expect(dex.items.find((i: { deedId: string }) => i.deedId === theirs.id).mood).toBe("😆");
  });

  it("hides the talking-friend letter until stage 2", async () => {
    const pal = await userWithCharacter(env.app, "letters@example.com", { ...nova, name: "阿信" });
    const baby = await userWithCharacter(env.app, "grow@example.com");
    for (let n = 0; n < 7; n++) {
      const step = (await baby.post("/api/first-steps").send({ executor: "self", text: `小事 ${n}` })).body;
      await baby.post(`/api/first-steps/${step.id}/complete`).send({});
    }
    let me = (await baby.get("/api/me")).body;
    expect(me.pet).toMatchObject({ stars: 7, stage: 2, letter: true });
    await baby.patch("/api/me/pet").send({ letterDismissed: true, notify: false });
    me = (await baby.get("/api/me")).body;
    expect(me.pet.letter).toBe(false);
    expect(me.pet.notify).toBe(false);
    expect((await pal.get("/api/me")).body.pet.letter).toBe(false);
  });
});
