/*
  # Add Notes Feature

  ## Summary
  Creates a personal notes system where each user has a single continuous notepad
  with individually typed items. Notes are strictly private — no sharing between users.

  ## New Tables

  ### `note_items`
  Stores individual items in a user's notepad.

  | Column     | Type      | Description                                      |
  |------------|-----------|--------------------------------------------------|
  | id         | uuid      | Primary key                                      |
  | user_id    | uuid      | References auth.users — the note owner           |
  | type       | text      | Item type: 'text', 'numbered', or 'checkbox'     |
  | content    | text      | The text content of the item                     |
  | checked    | boolean   | For checkbox items: whether the box is ticked    |
  | position   | integer   | Display order (ascending)                        |
  | created_at | timestamptz | When the item was created                      |
  | updated_at | timestamptz | When the item was last modified                |

  ## Security
  - RLS enabled on `note_items`
  - Users can only SELECT, INSERT, UPDATE, DELETE their own rows (user_id = auth.uid())
  - No cross-user visibility at all

  ## Notes
  - `type` is constrained to the three valid values
  - `checked` defaults to false so it is safe to read for non-checkbox items
  - `position` is used for ordering; new items get the next available integer
*/

CREATE TABLE IF NOT EXISTS note_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'numbered', 'checkbox')),
  content     text NOT NULL DEFAULT '',
  checked     boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_items_user_id_position_idx ON note_items (user_id, position);

ALTER TABLE note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own note items"
  ON note_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note items"
  ON note_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note items"
  ON note_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note items"
  ON note_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
