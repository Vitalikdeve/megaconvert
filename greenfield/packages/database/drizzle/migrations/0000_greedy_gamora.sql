CREATE TYPE "public"."auth_device_kind" AS ENUM('desktop', 'mobile', 'tablet', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."auth_session_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."authentication_method" AS ENUM('google_oidc', 'webauthn_passkey');--> statement-breakpoint
CREATE TYPE "public"."auth_identity_provider" AS ENUM('google_oidc', 'webauthn_passkey');--> statement-breakpoint
CREATE TYPE "public"."default_workspace_view" AS ENUM('inbox', 'meetings', 'search');--> statement-breakpoint
CREATE TYPE "public"."preferred_meeting_layout" AS ENUM('grid', 'spotlight');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility_scope" AS ENUM('contacts_only', 'everyone', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"action" text NOT NULL,
	"actor_id" text,
	"actor_type" text,
	"category" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"target_id" text,
	"target_type" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "auth_refresh_tokens" (
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issued_from_ip_address" text,
	"issued_user_agent" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"authentication_method" "authentication_method" NOT NULL,
	"browser" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_kind" "auth_device_kind" DEFAULT 'unknown' NOT NULL,
	"device_label" text,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"operating_system" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"status" "auth_session_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"blocked_user_username" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider" "auth_identity_provider" NOT NULL,
	"provider_subject" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"compact_mode_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_workspace_view" "default_workspace_view" DEFAULT 'inbox' NOT NULL,
	"keyboard_shortcuts_enabled" boolean DEFAULT true NOT NULL,
	"locale_override" text,
	"play_sound_effects" boolean DEFAULT true NOT NULL,
	"preferred_meeting_layout" "preferred_meeting_layout" DEFAULT 'grid' NOT NULL,
	"time_zone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_privacy_settings" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"direct_message_scope" "profile_visibility_scope" DEFAULT 'everyone' NOT NULL,
	"discoverable_by_email" boolean DEFAULT true NOT NULL,
	"discoverable_by_username" boolean DEFAULT true NOT NULL,
	"meeting_presence_scope" "profile_visibility_scope" DEFAULT 'everyone' NOT NULL,
	"presence_scope" "profile_visibility_scope" DEFAULT 'everyone' NOT NULL,
	"profile_scope" "profile_visibility_scope" DEFAULT 'everyone' NOT NULL,
	"read_receipts_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"account_status" "account_status" DEFAULT 'active' NOT NULL,
	"avatar_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"family_name" text,
	"given_name" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	"locale" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_category_idx" ON "audit_events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_request_idx" ON "audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_expires_at_idx" ON "auth_refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_session_idx" ON "auth_refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_uidx" ON "auth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_last_seen_at_idx" ON "auth_sessions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_status_idx" ON "auth_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "blocked_users_blocked_user_idx" ON "blocked_users" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "blocked_users_user_idx" ON "blocked_users" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_users_user_blocked_user_uidx" ON "blocked_users" USING btree ("user_id","blocked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_subject_uidx" ON "user_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "user_identities_user_idx" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_default_workspace_view_idx" ON "user_preferences" USING btree ("default_workspace_view");--> statement-breakpoint
CREATE INDEX "user_privacy_settings_profile_scope_idx" ON "user_privacy_settings" USING btree ("profile_scope");--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");