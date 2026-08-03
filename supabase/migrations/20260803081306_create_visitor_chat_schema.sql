/*
# Create visitor chat schema (conversations + messages)

1. New Tables
- `visitor_conversations`
  - `id` (uuid, primary key) - unique conversation identifier
  - `visitor_name` (text, not null) - name the visitor entered
  - `visitor_email` (text, nullable) - optional email for reply notifications
  - `slug` (text, unique, not null) - short URL-safe identifier so visitors can return to their conversation
  - `owner_user_id` (uuid, not null) - references auth.users, the business owner who receives the messages
  - `created_at` (timestamptz, default now())
  - `last_message_at` (timestamptz, default now()) - updated on each new message for sorting
- `visitor_messages`
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, not null) - references visitor_conversations(id) ON DELETE CASCADE
  - `sender` (text, not null) - 'visitor' or 'owner'
  - `body` (text, not null) - the message text
  - `read_by_owner` (boolean, default false) - whether the owner has seen this message (only relevant for visitor-sent messages)
  - `created_at` (timestamptz, default now())

2. Indexes
- `visitor_conversations_slug_idx` on slug for fast lookups
- `visitor_conversations_owner_idx` on owner_user_id for owner inbox queries
- `visitor_conversations_last_msg_idx` on last_message_at DESC for sorted inbox
- `visitor_messages_conversation_idx` on conversation_id + created_at for thread loading

3. Security (RLS)
- Enable RLS on both tables.
- visitor_conversations: anon+authenticated can INSERT (visitors create conversations without login). Only the owner (owner_user_id = auth.uid()) can SELECT, UPDATE, DELETE.
- visitor_messages: anon+authenticated can INSERT (visitors send messages). Only the owner of the parent conversation can SELECT, UPDATE, DELETE.
- A SECURITY DEFINER function `get_visitor_conversation_by_slug` allows anon to load a conversation and its messages by slug without exposing all conversations.

4. Notes
- The owner_user_id is hardcoded to the simplejobtrademanager@gmail.com account's UUID in the insert path from the edge function, but the RLS policy uses auth.uid() so only the logged-in owner sees their inbox.
- The slug is generated as a random 10-character alphanumeric string, unique across the table.
*/

CREATE TABLE IF NOT EXISTS visitor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL,
  visitor_email text,
  slug text UNIQUE NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES visitor_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('visitor', 'owner')),
  body text NOT NULL,
  read_by_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_conversations_slug_idx ON visitor_conversations(slug);
CREATE INDEX IF NOT EXISTS visitor_conversations_owner_idx ON visitor_conversations(owner_user_id);
CREATE INDEX IF NOT EXISTS visitor_conversations_last_msg_idx ON visitor_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS visitor_messages_conversation_idx ON visitor_messages(conversation_id, created_at);

ALTER TABLE visitor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_messages ENABLE ROW LEVEL SECURITY;

-- visitor_conversations policies
-- Anyone (anon) can INSERT a new conversation (visitors don't log in)
DROP POLICY IF EXISTS "anon_insert_conversations" ON visitor_conversations;
CREATE POLICY "anon_insert_conversations" ON visitor_conversations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only the owner can SELECT their conversations
DROP POLICY IF EXISTS "owner_select_conversations" ON visitor_conversations;
CREATE POLICY "owner_select_conversations" ON visitor_conversations
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);

-- Only the owner can UPDATE their conversations
DROP POLICY IF EXISTS "owner_update_conversations" ON visitor_conversations;
CREATE POLICY "owner_update_conversations" ON visitor_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- Only the owner can DELETE their conversations
DROP POLICY IF EXISTS "owner_delete_conversations" ON visitor_conversations;
CREATE POLICY "owner_delete_conversations" ON visitor_conversations
  FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- visitor_messages policies
-- Anyone (anon) can INSERT messages (visitors send messages without login)
DROP POLICY IF EXISTS "anon_insert_messages" ON visitor_messages;
CREATE POLICY "anon_insert_messages" ON visitor_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only the owner of the parent conversation can SELECT messages
DROP POLICY IF EXISTS "owner_select_messages" ON visitor_messages;
CREATE POLICY "owner_select_messages" ON visitor_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM visitor_conversations
      WHERE visitor_conversations.id = visitor_messages.conversation_id
      AND visitor_conversations.owner_user_id = auth.uid()
    )
  );

-- Only the owner of the parent conversation can UPDATE messages (e.g. mark as read)
DROP POLICY IF EXISTS "owner_update_messages" ON visitor_messages;
CREATE POLICY "owner_update_messages" ON visitor_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM visitor_conversations
      WHERE visitor_conversations.id = visitor_messages.conversation_id
      AND visitor_conversations.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM visitor_conversations
      WHERE visitor_conversations.id = visitor_messages.conversation_id
      AND visitor_conversations.owner_user_id = auth.uid()
    )
  );

-- Only the owner of the parent conversation can DELETE messages
DROP POLICY IF EXISTS "owner_delete_messages" ON visitor_messages;
CREATE POLICY "owner_delete_messages" ON visitor_messages
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM visitor_conversations
      WHERE visitor_conversations.id = visitor_messages.conversation_id
      AND visitor_conversations.owner_user_id = auth.uid()
    )
  );

-- SECURITY DEFINER function: lets anon load a conversation by slug
-- This is safe because the slug is a random unguessable identifier, and the function
-- only returns the conversation row + its messages, nothing else.
CREATE OR REPLACE FUNCTION get_visitor_conversation_by_slug(p_slug text)
RETURNS TABLE (
  conversation_id uuid,
  visitor_name text,
  visitor_email text,
  slug text,
  created_at timestamptz,
  message_id uuid,
  sender text,
  body text,
  message_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.id,
    vc.visitor_name,
    vc.visitor_email,
    vc.slug,
    vc.created_at,
    vm.id,
    vm.sender,
    vm.body,
    vm.created_at
  FROM visitor_conversations vc
  LEFT JOIN visitor_messages vm ON vm.conversation_id = vc.id
  WHERE vc.slug = p_slug
  ORDER BY vm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_visitor_conversation_by_slug(text) TO anon, authenticated;

-- Function to get unread message count for the logged-in owner
CREATE OR REPLACE FUNCTION get_unread_visitor_message_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count integer;
BEGIN
  SELECT COUNT(*) INTO count
  FROM visitor_messages vm
  INNER JOIN visitor_conversations vc ON vc.id = vm.conversation_id
  WHERE vc.owner_user_id = auth.uid()
  AND vm.sender = 'visitor'
  AND vm.read_by_owner = false;
  RETURN count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_visitor_message_count() TO authenticated;