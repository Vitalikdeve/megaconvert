-- MegaConvert chat/channel/bot schema bootstrap (PostgreSQL)
-- Idempotent migration for server components (api + socket).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users: bot flag for synthetic bot accounts
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

-- Chats: supports direct/group/channel conversation types
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  title TEXT,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS chats
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);

-- Some environments use conversations instead of chats
ALTER TABLE IF EXISTS conversations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

-- Channel profile/pro-status metadata
CREATE TABLE IF NOT EXISTS channel_metadata (
  chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  subscriber_count BIGINT NOT NULL DEFAULT 0 CHECK (subscriber_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat membership + role for channel admin checks
CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_role ON chat_members(chat_id, role);

-- Extend messages for chat (group/channel) delivery
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON messages(chat_id, created_at DESC);

-- Bots and bot auth token storage
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_verified ON bots(is_verified);
