-- =======================================================
-- PRIVACY & SOCIAL SYSTEM — حيّنا App
-- Run AFTER setup_database.sql and setup_stories.sql
-- =======================================================

-- ============================================
-- 1. FOLLOWERS / FOLLOWING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ============================================
-- 2. PROFILE PRIVACY SETTINGS
-- ============================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS profile_privacy TEXT DEFAULT 'public',  -- public | private
    ADD COLUMN IF NOT EXISTS allow_dms TEXT DEFAULT 'everyone',      -- everyone | followers | nobody
    ADD COLUMN IF NOT EXISTS allow_story_replies TEXT DEFAULT 'everyone'; -- everyone | followers | nobody

-- ============================================
-- 3. STORY PRIVACY SETTINGS
-- ============================================
ALTER TABLE public.stories
    ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',         -- public | followers | specific
    ADD COLUMN IF NOT EXISTS allow_replies BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS allowed_user_ids UUID[] DEFAULT NULL;     -- for specific visibility

-- Update stories RLS to respect visibility
DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (
    expires_at > now() AND (
        -- Public stories: everyone sees them
        visibility = 'public'
        OR
        -- Own stories: always visible
        auth.uid() = author_id
        OR
        -- Followers-only: viewer must follow the author
        (visibility = 'followers' AND auth.uid() IN (
            SELECT follower_id FROM public.follows WHERE following_id = author_id
        ))
        OR
        -- Specific users
        (visibility = 'specific' AND auth.uid() = ANY(allowed_user_ids))
    )
);

-- ============================================
-- 4. UNREAD MESSAGES TRACKING
-- ============================================
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT ARRAY[]::UUID[];

-- Function: Mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.messages
    SET read_by = array_append(read_by, p_user_id)
    WHERE conversation_id = p_conversation_id
    AND NOT (read_by @> ARRAY[p_user_id])
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. CONVERSATION LAST MESSAGE VIEW
-- ============================================
CREATE OR REPLACE VIEW public.conversation_previews AS
SELECT
    cm.user_id,
    c.id AS conversation_id,
    c.created_at AS conv_created_at,
    m.id AS last_message_id,
    m.body AS last_message,
    m.sender_id AS last_sender_id,
    m.created_at AS last_message_at,
    m.read_by AS read_by,
    other_cm.user_id AS other_user_id
FROM public.conversation_members cm
JOIN public.conversations c ON c.id = cm.conversation_id
LEFT JOIN LATERAL (
    SELECT * FROM public.messages
    WHERE conversation_id = cm.conversation_id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
LEFT JOIN public.conversation_members other_cm
    ON other_cm.conversation_id = cm.conversation_id
    AND other_cm.user_id != cm.user_id;

-- ============================================
-- 6. NOTIFICATION TRIGGER FOR FOLLOWS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, type, target_type, target_id)
    VALUES (
        new.following_id,
        'متابع جديد! 👋',
        'شخص بدأ يتابعك في حيّنا',
        'info',
        'user',
        new.follower_id
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();

-- ============================================
-- 8. BLOCK SYSTEM (حظر المستخدمين)
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_select" ON public.blocks;
DROP POLICY IF EXISTS "blocks_insert" ON public.blocks;
DROP POLICY IF EXISTS "blocks_delete" ON public.blocks;
CREATE POLICY "blocks_select" ON public.blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert" ON public.blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete" ON public.blocks FOR DELETE USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

-- ============================================
-- 9. DO NOT DISTURB & MUTES (عدم الإزعاج وكتم المحادثات)
-- ============================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS hide_name BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS muted_conversations UUID[] DEFAULT ARRAY[]::UUID[];

