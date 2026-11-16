CREATE TABLE "life_days" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"day" text NOT NULL,
	"autonomous" text DEFAULT '' NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"earned_on" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "allow_visits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "life_outfit" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "life_decoration" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "life_legacy" jsonb;--> statement-breakpoint
ALTER TABLE "life_days" ADD CONSTRAINT "life_days_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_items" ADD CONSTRAINT "life_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_days_character_day_idx" ON "life_days" USING btree ("character_id","day");--> statement-breakpoint
CREATE INDEX "life_items_character_idx" ON "life_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "characters_allow_visits_idx" ON "characters" USING btree ("id") WHERE "characters"."allow_visits";