import { describe, expect, it } from "vitest";
import { autonomousLife, lifeClock, lifeScene, readLife } from "./life";

describe("Taipei's little everyday world", () => {
  it("uses the Taipei midnight and all four seasons and periods", () => {
    expect(lifeClock(new Date("2026-11-10T15:59:59Z")).day).toBe("2026-11-10");
    expect(lifeClock(new Date("2026-11-10T16:00:00Z")).day).toBe("2026-11-11");
    const scenes = ["2026-03-10T00:00:00Z", "2026-06-10T04:00:00Z", "2026-09-10T10:00:00Z", "2026-12-10T15:00:00Z"].map(s => lifeScene(new Date(s)));
    for (const [i, word] of ["春天的早晨", "夏天的午後", "秋天的傍晚", "冬天的夜裡"].entries()) expect(scenes[i]).toContain(word);
    expect(new Set(scenes).size).toBe(4);
    expect(autonomousLife("dragon", "2026-11-10")).toBe(autonomousLife("dragon", "2026-11-10"));
  });
  it("reads legacy characters without enabling visits or inventing owned rewards", () => {
    expect(readLife({allowAiQuotes:true})).toMatchObject({allowVisits:false,inventory:[],outfit:null,decoration:null});
    expect(readLife({life:{inventory:[{activityId:"forged"}]}}).inventory).toEqual([]);
  });
});
