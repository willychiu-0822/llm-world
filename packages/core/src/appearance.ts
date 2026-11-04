export const BODY_SHAPES = ["round", "pear", "tall"] as const;
export const ACCESSORIES = ["none", "dragon_horns", "leaf", "beret", "scarf", "glasses", "flower", "headphones"] as const;
/** Soft picture-book palette. */
export const PALETTE = ["#F3E3C3", "#F2C6A8", "#B9CFA4", "#A9C7DE", "#CDB8DA", "#F1DC8F", "#E9AFB4", "#D9C2A0"] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface Appearance {
  body: BodyShape;
  accessory: Accessory;
  main: string;
  accent: string;
  description: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  body: "round",
  accessory: "dragon_horns",
  main: PALETTE[0],
  accent: PALETTE[3],
  description: "",
};

export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: "無",
  dragon_horns: "小龍角",
  leaf: "葉子",
  beret: "貝雷帽",
  scarf: "圍巾",
  glasses: "圓眼鏡",
  flower: "小花",
  headphones: "耳機",
};

export const BODY_LABELS: Record<BodyShape, string> = { round: "圓圓", pear: "西洋梨", tall: "高高" };
