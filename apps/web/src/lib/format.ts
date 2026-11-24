import { lifeClock } from "@lj/core";

const TZ = "Asia/Taipei";

export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(v));
}

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(v));
}

export function timeAgo(v: string | Date, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(v).getTime()) / 1000);
  if (s < 60) return "剛剛";
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return formatDate(v);
}

/** 生活頁的日子：2026-11-14 寫成「11 月 14 日」，有時段就接「秋天的早晨」。 */
export function formatLifeDay(day: string, extras?: { season?: string; period?: string }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = Number(match[2]);
  const date = Number(match[3]);
  const season = extras?.season ?? lifeClock(new Date(`${day}T04:00:00.000Z`)).season;
  const seasonWord = season.endsWith("天") ? season : `${season}天`;
  const head = `${month} 月 ${date} 日`;
  return extras?.period ? `${head}，${seasonWord}的${extras.period}` : `${head}，${seasonWord}`;
}
