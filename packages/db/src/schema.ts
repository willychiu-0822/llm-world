import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  roles: text("roles").array().notNull().default(sql`ARRAY['user']::text[]`),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const characters = pgTable("characters", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  appearance: jsonb("appearance").notNull(),
  personality: text("personality").notNull().default(""),
  sharing: jsonb("sharing").notNull().default({ allowAiQuotes: true }),
  lastActivePlaceId: text("last_active_place_id"),
  lastActiveAt: ts("last_active_at"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const wants = pgTable(
  "wants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    districtKey: text("district_key").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("wants_user_idx").on(t.userId)],
);

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | approved | suspended
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    districtKey: text("district_key").notNull(),
    kind: text("kind").notNull(), // public | shop
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    roofColor: text("roof_color").notNull().default("#E8B4A0"),
    slot: integer("slot").notNull().default(0),
    providerId: text("provider_id").references(() => providers.id, { onDelete: "cascade" }),
    realAddress: text("real_address"),
    online: boolean("online").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("places_district_idx").on(t.districtKey)],
);

export const trials = pgTable("trials", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull(),
  exitAnytime: boolean("exit_anytime").notNull().default(true),
  buddyOk: boolean("buddy_ok").notNull().default(true),
  whenText: text("when_text").notNull().default(""),
  processInfo: text("process_info").notNull().default(""),
  aiFirstStepHint: text("ai_first_step_hint").notNull().default(""),
  selfFirstStepHint: text("self_first_step_hint").notNull().default(""),
  status: text("status").notNull().default("active"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const trialFaqs = pgTable("trial_faqs", {
  id: text("id").primaryKey(),
  trialId: text("trial_id").notNull().references(() => trials.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: createdAt(),
});

export const trialSessions = pgTable("trial_sessions", {
  id: text("id").primaryKey(),
  trialId: text("trial_id").notNull().references(() => trials.id, { onDelete: "cascade" }),
  startsAt: ts("starts_at").notNull(),
  capacity: integer("capacity").notNull().default(20),
  createdAt: createdAt(),
});

export const firstSteps = pgTable(
  "first_steps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    wantId: text("want_id").references(() => wants.id, { onDelete: "set null" }),
    executor: text("executor").notNull(), // ai | self
    text: text("text").notNull(),
    status: text("status").notNull(), // draft | confirmed | done | dropped
    proposedBy: text("proposed_by").notNull().default("user"), // user | ai
    proposalReason: text("proposal_reason"),
    sourceDeedIds: text("source_deed_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    trialId: text("trial_id").references(() => trials.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => trialSessions.id, { onDelete: "set null" }),
    plannedAt: ts("planned_at"),
    whereText: text("where_text"),
    result: text("result"),
    createdAt: createdAt(),
    confirmedAt: ts("confirmed_at"),
    doneAt: ts("done_at"),
  },
  (t) => [index("first_steps_user_idx").on(t.userId)],
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    firstStepId: text("first_step_id").notNull().references(() => firstSteps.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // before | after
    body: text("body").notNull(),
    shared: boolean("shared").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notes_step_kind_uq").on(t.firstStepId, t.kind)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => trialSessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    firstStepId: text("first_step_id").references(() => firstSteps.id, { onDelete: "set null" }),
    attendedAt: ts("attended_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bookings_session_user_uq").on(t.sessionId, t.userId)],
);

export const deeds = pgTable(
  "deeds",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    firstStepId: text("first_step_id").unique().references(() => firstSteps.id, { onDelete: "set null" }),
    executor: text("executor").notNull(), // ai | self
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    districtKey: text("district_key").notNull(),
    placeId: text("place_id").notNull().references(() => places.id),
    trialId: text("trial_id").references(() => trials.id, { onDelete: "set null" }),
    relatedDeedIds: text("related_deed_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    recordSource: text("record_source").notNull(), // provider_confirmed | self | ai
    visibility: text("visibility").notNull().default("public"),
    moderationState: text("moderation_state").notNull().default("ok"), // ok | flagged | removed
    isFirst: boolean("is_first").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("deeds_place_idx").on(t.placeId), index("deeds_district_idx").on(t.districtKey)],
);

export const discoveries = pgTable("discoveries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  items: jsonb("items").notNull(),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

export const providerQuestions = pgTable("provider_questions", {
  id: text("id").primaryKey(),
  trialId: text("trial_id").notNull().references(() => trials.id, { onDelete: "cascade" }),
  askerUserId: text("asker_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstStepId: text("first_step_id").references(() => firstSteps.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  answer: text("answer"),
  answeredAt: ts("answered_at"),
  createdAt: createdAt(),
});

export const trialEvents = pgTable("trial_events", {
  id: text("id").primaryKey(),
  trialId: text("trial_id").notNull().references(() => trials.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // ai_view | question | booking | attended
  createdAt: createdAt(),
});

export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    deedId: text("deed_id").notNull().references(() => deeds.id, { onDelete: "cascade" }),
    followerUserId: text("follower_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    firstStepId: text("first_step_id").notNull().references(() => firstSteps.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("referenced"), // referenced | completed
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("follows_deed_step_uq").on(t.deedId, t.firstStepId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const discoverySeen = pgTable(
  "discovery_seen",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("discovery_seen_uq").on(t.userId, t.itemId)],
);

export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  info: jsonb("info").notNull(),
  createdAt: createdAt(),
});

export const oauthRequests = pgTable("oauth_requests", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  state: text("state"),
  scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
  resource: text("resource"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const oauthCodes = pgTable("oauth_codes", {
  code: text("code").primaryKey(), // sha256
  clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
  resource: text("resource"),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const oauthTokens = pgTable("oauth_tokens", {
  token: text("token").primaryKey(), // sha256
  kind: text("kind").notNull(), // access | refresh
  clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
  resource: text("resource"),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

export const moderationLog = pgTable("moderation_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  targetType: text("target_type").notNull(),
  excerpt: text("excerpt").notNull(),
  categories: text("categories").array().notNull().default(sql`ARRAY[]::text[]`),
  action: text("action").notNull(),
  createdAt: createdAt(),
});
