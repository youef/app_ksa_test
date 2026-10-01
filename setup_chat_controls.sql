-- =======================================================
-- CHAT CONTROLS v2 — الحظر / الكتم / عدم الإزعاج / مسح المحادثة
-- Hayna App
-- Run AFTER: setup_database.sql, setup_privacy.sql, setup_stories.sql
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- هذا الملف هو ما يفعّل الميزات فعلياً. بدونه تبقى الأزرار
-- في الواجهة بلا مفعول على مستوى قاعدة البيانات.
-- =======================================================


-- ============================================
-- 0. SAFETY NETS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS muted_conversations UUID[] DEFAULT ARRAY[]::UUID[];

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    target_type TEXT,
    target_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);


-- ============================================
-- 1. HELPER FUNCTIONS
--    SECURITY DEFINER + fixed search_path so they can be
--    safely called from inside other RLS policies.
-- ============================================

-- Is the user a member of the conversation?
CREATE OR REPLACE FUNCTION public.is_conv_member(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is there a block record in EITHER direction between the two users?
CREATE OR REPLACE FUNCTION public.has_block_between(p_a UUID, p_b UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = p_a AND blocked_id = p_b)
           OR (blocker_id = p_b AND blocked_id = p_a)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Does the conversation contain anyone blocked with this user (either direction)?
CREATE OR REPLACE FUNCTION public.has_block_with_any_member(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversation_members cm
        WHERE cm.conversation_id = p_conversation_id
          AND cm.user_id <> p_user_id
          AND public.has_block_between(cm.user_id, p_user_id)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- When did this user clear the conversation? (NULL = never cleared)
-- defined in section 2, after the table exists


-- ============================================
-- 2. SCHEMA — per-conversation settings + DND schedule
-- ============================================

-- One row per (conversation, member): mute / archive / clear-for-me.
-- Replaces the old profiles.muted_conversations UUID[] which
-- required a read-modify-write (and silently lost updates).
CREATE TABLE IF NOT EXISTS public.conversation_member_settings (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    muted BOOLEAN NOT NULL DEFAULT false,
    archived BOOLEAN NOT NULL DEFAULT false,
    cleared_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_user ON public.conversation_member_settings(user_id);

-- Do-Not-Disturb with a schedule.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS dnd_schedule TEXT DEFAULT 'off',   -- off | nightly | custom
    ADD COLUMN IF NOT EXISTS dnd_start TIME,                    -- for 'custom'
    ADD COLUMN IF NOT EXISTS dnd_end TIME;                      -- for 'custom'

-- Backfill: seed a settings row for every existing membership.
INSERT INTO public.conversation_member_settings (conversation_id, user_id)
SELECT conversation_id, user_id FROM public.conversation_members
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Backfill: migrate any existing mutes from the old UUID[] column.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT cm.conversation_id, cm.user_id
          FROM public.conversation_members cm
          JOIN public.profiles p ON p.id = cm.user_id
         WHERE COALESCE(p.muted_conversations, ARRAY[]::UUID[]) @> ARRAY[cm.conversation_id]
    LOOP
        UPDATE public.conversation_member_settings
           SET muted = true, updated_at = now()
         WHERE conversation_id = r.conversation_id AND user_id = r.user_id;
    END LOOP;
END;
$$;


-- When did this user clear the conversation? (NULL = never cleared)
CREATE OR REPLACE FUNCTION public.conv_cleared_at(p_conversation_id UUID, p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
    SELECT cleared_at FROM public.conversation_member_settings
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is this conversation muted for this user?
CREATE OR REPLACE FUNCTION public.is_conv_muted(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT muted FROM public.conversation_member_settings
         WHERE conversation_id = p_conversation_id AND user_id = p_user_id),
        false
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is Do-Not-Disturb currently ACTIVE for this user (respects the schedule)?
CREATE OR REPLACE FUNCTION public.is_dnd_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled   BOOLEAN;
    v_schedule  TEXT;
    v_start     TIME;
    v_end       TIME;
    v_now       TIME := (now() AT TIME ZONE 'Asia/Riyadh')::TIME;
BEGIN
    SELECT dnd_enabled, dnd_schedule, dnd_start, dnd_end
      INTO v_enabled, v_schedule, v_start, v_end
      FROM public.profiles WHERE id = p_user_id;

    IF NOT COALESCE(v_enabled, false) THEN RETURN false; END IF;
    IF v_schedule IS NULL OR v_schedule = 'off' THEN RETURN true; END IF;
    IF v_start IS NULL OR v_end IS NULL THEN RETURN true; END IF;

    -- Overnight window (e.g. 22:00 → 07:00)
    IF v_start > v_end THEN
        RETURN v_now >= v_start OR v_now < v_end;
    END IF;

    -- Same-day window
    RETURN v_now >= v_start AND v_now < v_end;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- ============================================
-- 3. RULES (RLS) — this is what actually enforces Block
-- ============================================

-- ---- blocks: BOTH sides may read the record.
-- Without this, a user can never tell that someone blocked THEM,
-- because the old policy only allowed reading rows where you were the blocker.
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_select" ON public.blocks;
CREATE POLICY "blocks_select" ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocks_insert" ON public.blocks;
CREATE POLICY "blocks_insert" ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete" ON public.blocks;
CREATE POLICY "blocks_delete" ON public.blocks FOR DELETE
  USING (auth.uid() = blocker_id);

ALTER TABLE public.conversation_member_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_select" ON public.conversation_member_settings;
DROP POLICY IF EXISTS "cms_insert" ON public.conversation_member_settings;
DROP POLICY IF EXISTS "cms_update" ON public.conversation_member_settings;
DROP POLICY IF EXISTS "cms_delete" ON public.conversation_member_settings;

CREATE POLICY "cms_select" ON public.conversation_member_settings FOR SELECT
  USING (auth.uid() = user_id OR public.is_conv_member(conversation_id, auth.uid()));

CREATE POLICY "cms_insert" ON public.conversation_member_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cms_update" ON public.conversation_member_settings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cms_delete" ON public.conversation_member_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ---- conversations: members may delete the whole conversation ----
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE
  USING (public.is_conv_member(id, auth.uid()));

-- ---- conversation_members: members may leave ----
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_members_delete" ON public.conversation_members;
CREATE POLICY "conv_members_delete" ON public.conversation_members FOR DELETE
  USING (auth.uid() = user_id);

-- ---- messages: the important part ----
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

-- Read: only conversation members.
-- Blocked party cannot read the blocker's messages (they keep their own history).
-- "Clear for me" hides everything before cleared_at.
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
    public.is_conv_member(conversation_id, auth.uid())
    AND (
        sender_id = auth.uid()
        OR NOT public.has_block_with_any_member(conversation_id, auth.uid())
    )
    AND created_at >= COALESCE(
        public.conv_cleared_at(conversation_id, auth.uid()),
        '-infinity'::timestamptz
    )
);

-- Send: must be a member, and no block in either direction.
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conv_member(conversation_id, auth.uid())
    AND NOT public.has_block_with_any_member(conversation_id, auth.uid())
);

-- Update: members only (read receipts). Column tampering is blocked by the
-- guard trigger below — you can only ever change read_by on someone else's message.
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (public.is_conv_member(conversation_id, auth.uid()))
  WITH CHECK (public.is_conv_member(conversation_id, auth.uid()));

-- Delete: your own messages. Deleting a whole conversation cascades
-- (referential actions bypass RLS), so "delete for everyone" works too.
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (
    auth.uid() = sender_id
);

CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger AS $$
BEGIN
    IF auth.uid() IS DISTINCT FROM OLD.sender_id THEN
        NEW.id             := OLD.id;
        NEW.conversation_id := OLD.conversation_id;
        NEW.sender_id      := OLD.sender_id;
        NEW.body           := OLD.body;
        NEW.created_at     := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
CREATE TRIGGER guard_message_update
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE PROCEDURE public.guard_message_update();


-- ============================================
-- 4. RPCs — atomic actions called from the app
-- ============================================

CREATE OR REPLACE FUNCTION public.set_conversation_mute(
    p_conversation_id UUID,
    p_muted BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
    IF NOT public.is_conv_member(p_conversation_id, v_uid) THEN
        RAISE EXCEPTION 'not_a_member';
    END IF;

    INSERT INTO public.conversation_member_settings (conversation_id, user_id, muted, updated_at)
    VALUES (p_conversation_id, v_uid, p_muted, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET muted = EXCLUDED.muted, updated_at = now();

    RETURN p_muted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "مسح عندي": hide everything for me. The other person keeps their copy.
CREATE OR REPLACE FUNCTION public.clear_conversation_for_me(
    p_conversation_id UUID
) RETURNS TIMESTAMPTZ AS $$
DECLARE v_uid UUID := auth.uid(); v_ts TIMESTAMPTZ := now();
BEGIN
    IF NOT public.is_conv_member(p_conversation_id, v_uid) THEN
        RAISE EXCEPTION 'not_a_member';
    END IF;

    INSERT INTO public.conversation_member_settings (conversation_id, user_id, cleared_at, updated_at)
    VALUES (p_conversation_id, v_uid, v_ts, v_ts)
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET cleared_at = EXCLUDED.cleared_at, updated_at = EXCLUDED.updated_at;

    RETURN v_ts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "حذف المحادثة للجميع": removes the conversation and every message in it.
CREATE OR REPLACE FUNCTION public.delete_conversation(
    p_conversation_id UUID
) RETURNS BOOLEAN AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
    IF NOT public.is_conv_member(p_conversation_id, v_uid) THEN
        RAISE EXCEPTION 'not_a_member';
    END IF;

    DELETE FROM public.conversation_members WHERE conversation_id = p_conversation_id;
    DELETE FROM public.conversations WHERE id = p_conversation_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Block: also unfollows both ways so the block is complete.
CREATE OR REPLACE FUNCTION public.set_block(
    p_user_id UUID,
    p_blocked BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF p_user_id IS NULL OR p_user_id = v_uid THEN RAISE EXCEPTION 'invalid_user'; END IF;

    IF p_blocked THEN
        INSERT INTO public.blocks (blocker_id, blocked_id)
        VALUES (v_uid, p_user_id)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

        DELETE FROM public.follows
        WHERE (follower_id = v_uid AND following_id = p_user_id)
           OR (follower_id = p_user_id AND following_id = v_uid);
    ELSE
        DELETE FROM public.blocks
        WHERE blocker_id = v_uid AND blocked_id = p_user_id;
    END IF;

    RETURN p_blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_dnd(
    p_enabled BOOLEAN,
    p_schedule TEXT DEFAULT 'off',
    p_start TIME DEFAULT NULL,
    p_end TIME DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

    UPDATE public.profiles
       SET dnd_enabled  = COALESCE(p_enabled, false),
           dnd_schedule = COALESCE(p_schedule, 'off'),
           dnd_start    = p_start,
           dnd_end      = p_end,
           updated_at   = now()
     WHERE id = v_uid;

    RETURN COALESCE(p_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Read receipts in a single round-trip.
CREATE OR REPLACE FUNCTION public.mark_messages_read(
    p_conversation_id UUID,
    p_user_id UUID
) RETURNS void AS $$
BEGIN
    UPDATE public.messages
       SET read_by = array_append(read_by, p_user_id)
     WHERE conversation_id = p_conversation_id
       AND NOT (COALESCE(read_by, ARRAY[]::UUID[]) @> ARRAY[p_user_id])
       AND sender_id <> p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================
-- 5. NOTIFICATIONS — respects Block, Mute and DND
--    A message from a blocked/muted/DND user creates no notification.
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger AS $$
DECLARE
    v_receiver UUID;
    v_name TEXT;
BEGIN
    SELECT COALESCE(NULLIF(display_name, ''), username, 'جار')
      INTO v_name
      FROM public.profiles WHERE id = new.sender_id;

    FOR v_receiver IN
        SELECT cm.user_id
          FROM public.conversation_members cm
         WHERE cm.conversation_id = new.conversation_id
           AND cm.user_id <> new.sender_id
    LOOP
        CONTINUE WHEN public.has_block_between(new.sender_id, v_receiver);
        CONTINUE WHEN public.is_conv_muted(new.conversation_id, v_receiver);
        CONTINUE WHEN public.is_dnd_active(v_receiver);

        INSERT INTO public.notifications (user_id, title, body, type, target_type, target_id)
        VALUES (
            v_receiver,
            'رسالة جديدة من ' || COALESCE(v_name, 'جار'),
            LEFT(NEW.body, 140),
            'message',
            'conversation',
            NEW.conversation_id
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message();


-- ============================================
-- 6. DONE
-- =======================================================
-- Now working:
--   • الحظر  — enforced by the database, not just the UI
--   • الكتم  — per conversation, atomic, no lost updates
--   • عدم الإزعاج — global switch + schedule (off / nightly / custom)
--   • مسح المحادثة — "مسح عندي" (private) or "حذف للجميع" (permanent)
-- =======================================================
