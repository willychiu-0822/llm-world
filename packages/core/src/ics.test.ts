import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  const ics = buildIcs({
    uid: "step-1@longjiao",
    title: "聲樂試用課, 第一次",
    description: "Nova 說：去吧\n流程都問好了",
    location: "龍角鎮音樂坊；台北市某路 1 號",
    start: new Date("2026-11-07T02:00:00Z"),
    durationMin: 60,
    alarmMinutesBefore: 30,
  });

  it("is a VCALENDAR with one VEVENT and CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
  });

  it("writes UTC start/end times", () => {
    expect(ics).toContain("DTSTART:20261107T020000Z");
    expect(ics).toContain("DTEND:20261107T030000Z");
  });

  it("escapes commas, semicolons and newlines", () => {
    expect(ics).toContain("SUMMARY:聲樂試用課\\, 第一次");
    expect(ics).toContain("DESCRIPTION:Nova 說：去吧\\n流程都問好了");
    expect(ics).toContain("LOCATION:龍角鎮音樂坊；台北市某路 1 號");
  });

  it("includes a display alarm", () => {
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT30M");
  });
});
