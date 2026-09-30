-- =======================================================
-- STORIES SYSTEM — حيّنا App
-- Run this in Supabase SQL Editor (after setup_database.sql)
-- =======================================================

-- Stories table
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT DEFAULT 'text',           -- text | image
    content TEXT,                        -- Text content for text stories
    image_url TEXT,                      -- URL for image stories
    bg_color TEXT DEFAULT '#0891b2',    -- Background color for text stories
    text_color TEXT DEFAULT '#ffffff',
    font_size INTEGER DEFAULT 24,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours') NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Story views (who viewed which story)
CREATE TABLE IF NOT EXISTS public.story_views (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(story_id, viewer_id)
);

-- Story replies (replies go to private DMs)
CREATE TABLE IF NOT EXISTS public.story_replies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================
-- RLS Policies for Stories
-- ==============================
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;

-- Stories: anyone can read active stories, author can insert/delete
DROP POLICY IF EXISTS "stories_select" ON public.stories;
DROP POLICY IF EXISTS "stories_insert" ON public.stories;
DROP POLICY IF EXISTS "stories_delete" ON public.stories;
DROP POLICY IF EXISTS "stories_update" ON public.stories;

CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (expires_at > now());
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "stories_update" ON public.stories FOR UPDATE USING (auth.uid() = author_id);

-- Story views
DROP POLICY IF EXISTS "story_views_select" ON public.story_views;
DROP POLICY IF EXISTS "story_views_insert" ON public.story_views;
CREATE POLICY "story_views_select" ON public.story_views FOR SELECT USING (true);
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Story replies
DROP POLICY IF EXISTS "story_replies_select" ON public.story_replies;
DROP POLICY IF EXISTS "story_replies_insert" ON public.story_replies;
CREATE POLICY "story_replies_select" ON public.story_replies FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() IN (SELECT author_id FROM public.stories WHERE id = story_id)
);
CREATE POLICY "story_replies_insert" ON public.story_replies FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ==============================
-- TRIGGER: Reply to story → creates conversation & notification
-- ==============================
CREATE OR REPLACE FUNCTION public.handle_story_reply()
RETURNS trigger AS $$
DECLARE
    story_author UUID;
    existing_conv UUID;
    new_conv UUID;
BEGIN
    -- Get story author
    SELECT author_id INTO story_author
    FROM public.stories WHERE id = new.story_id;

    IF story_author IS NULL OR story_author = new.sender_id THEN
        RETURN new;
    END IF;

    -- Find existing conversation between these two users
    SELECT cm1.conversation_id INTO existing_conv
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = new.sender_id
    AND cm2.user_id = story_author
    LIMIT 1;

    -- Create conversation if not exists
    IF existing_conv IS NULL THEN
        INSERT INTO public.conversations DEFAULT VALUES
        RETURNING id INTO new_conv;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES (new_conv, new.sender_id), (new_conv, story_author)
        ON CONFLICT DO NOTHING;
    ELSE
        new_conv := existing_conv;
    END IF;

    -- Update story_reply with conversation_id
    UPDATE public.story_replies SET conversation_id = new_conv WHERE id = new.id;

    -- Send the reply as a message in the conversation
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (new_conv, new.sender_id, '↩️ رد على قصتك: ' || new.body);

    -- Notify the story author
    INSERT INTO public.notifications (user_id, title, body, type, target_type, target_id)
    VALUES (story_author, 'رد على قصتك! 💬', new.body, 'message', 'conversation', new_conv);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_story_reply ON public.story_replies;
CREATE TRIGGER on_story_reply
    AFTER INSERT ON public.story_replies
    FOR EACH ROW EXECUTE PROCEDURE public.handle_story_reply();

-- ==============================
-- INDEXES
-- ==============================
CREATE INDEX IF NOT EXISTS idx_stories_author ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_replies_story ON public.story_replies(story_id);
