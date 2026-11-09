export interface District {
  key: DistrictKey;
  name: string;
  theme: string;
  color: string;
  publicPlaceId: string;
  publicPlaceName: string;
}

export const DISTRICT_KEYS = ["music", "sports", "crafts", "food", "learning", "outdoors", "social", "volunteer", "misc"] as const;
export type DistrictKey = (typeof DISTRICT_KEYS)[number];

const d = (key: DistrictKey, name: string, theme: string, color: string, publicPlaceName: string): District => ({
  key,
  name,
  theme,
  color,
  publicPlaceId: `pub_${key}`,
  publicPlaceName,
});

/** 龍角鎮的 8 個主題區 + 萬事屋。 */
export const DISTRICTS: District[] = [
  d("music", "音樂坊", "音樂", "#E8B4A0", "音樂坊小廣場"),
  d("sports", "運動場", "運動", "#A8C8A0", "運動場跑道"),
  d("crafts", "手作巷", "藝術、手作", "#D8C0E0", "手作巷長椅"),
  d("food", "美食街", "料理、美食", "#F0D090", "美食街共享餐桌"),
  d("learning", "學習館", "學習", "#A8C0D8", "學習館閱覽室"),
  d("outdoors", "原野", "戶外、自然", "#B8D8A8", "原野大樹下"),
  d("social", "交流廣場", "交流、社交", "#F0B8C0", "交流廣場噴泉"),
  d("volunteer", "志工站", "志工、公益", "#C8D8B0", "志工站服務台"),
  d("misc", "萬事屋", "其他", "#D8C8B0", "萬事屋門口"),
];

export const DISTRICT_BY_KEY: Record<DistrictKey, District> = Object.fromEntries(DISTRICTS.map((x) => [x.key, x])) as Record<
  DistrictKey,
  District
>;

export function isDistrictKey(v: string): v is DistrictKey {
  return (DISTRICT_KEYS as readonly string[]).includes(v);
}
