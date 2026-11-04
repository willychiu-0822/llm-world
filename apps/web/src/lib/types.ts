import type { Appearance, District } from "@lj/core";

export interface Want {
  id: string;
  text: string;
  districtKey: string;
  status: string;
}

export interface Me {
  user: { id: string; email: string; displayName: string; roles: string[] };
  character: { id: string; name: string; appearance: Appearance; personality: string; sharing: { allowAiQuotes: boolean } } | null;
  wants: Want[];
  provider: { id: string; name: string; status: string } | null;
  unread: { notifications: number; discoveries: number };
}

export interface Predecessor {
  deedId: string;
  text: string;
  executor: string;
  characterName: string | null;
  isDemo: boolean;
}

export interface Session {
  id: string;
  startsAt: string;
  capacity: number;
  remaining: number;
}

export interface CharacterLite {
  name: string;
  appearance: Appearance;
}

export interface Deed {
  id: string;
  executor: "ai" | "self";
  title: string;
  summary: string;
  districtKey: string;
  placeId: string;
  trialId: string | null;
  relatedDeedIds: string[];
  recordSource: string;
  visibility: "public" | "private";
  isFirst: boolean;
  isDemo: boolean;
  createdAt: string;
  character: CharacterLite | null;
}

export interface DeedView extends Deed {
  place: { id: string; name: string; districtKey: string } | null;
  trial: { id: string; title: string } | null;
  sharedNotes: { before?: string; after?: string };
  related: { id: string; title: string }[];
  isMine: boolean;
  followers?: { referenced: number; completed: number };
}

export interface Trial {
  id: string;
  placeId: string;
  title: string;
  description: string;
  durationMin: number;
  exitAnytime: boolean;
  buddyOk: boolean;
  whenText: string;
  processInfo: string;
  aiFirstStepHint: string;
  selfFirstStepHint: string;
  status: string;
  isDemo: boolean;
}

export interface TrialView extends Trial {
  provider: { id: string; name: string; description: string };
  place: { id: string; name: string; districtKey: string; realAddress: string | null; online: boolean };
  faqs: { id: string; question: string; answer: string }[];
  sessions: Session[];
}

export interface Town {
  districts: District[];
  places: import("../components/TownMap").MapPlace[];
}

export interface Step {
  id: string;
  executor: "ai" | "self";
  text: string;
  status: "draft" | "confirmed" | "done" | "dropped";
  proposedBy: "user" | "ai";
  proposalReason: string | null;
  wantId: string | null;
  sourceDeedIds: string[];
  trialId: string | null;
  sessionId: string | null;
  plannedAt: string | null;
  where: string | null;
  result: string | null;
  createdAt: string;
  doneAt: string | null;
  notes: { before: { body: string; shared: boolean } | null; after: { body: string; shared: boolean } | null };
  deedId: string | null;
  trial: { id: string; title: string } | null;
  session: { id: string; startsAt: string } | null;
  attended: boolean;
}
