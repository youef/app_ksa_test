-- =======================================================
-- FULL DATABASE SETUP — حيّنا App
-- Run this entire file in Supabase SQL Editor
-- =======================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- TABLES
-- =======================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    region TEXT,
    city TEXT,
    district TEXT,
    bio TEXT,
    phone TEXT,
    hide_name BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'user',        -- user | moderator | admin
    is_verified BOOLEAN DEFAULT false,
    verification_status TEXT DEFAULT 'unverified', -- unverified | pending | verified
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- questions
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    city TEXT,
    district TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- answers
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    is_accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- requests (طلبات الفزعة)
CREATE TABLE IF NOT EXISTS public.requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    city TEXT,
    district TEXT,
    status TEXT DEFAULT 'open',     -- open | accepted | closed
    request_type TEXT DEFAULT 'help',
    budget NUMERIC,
    is_urgent BOOLEAN DEFAULT false,
    accepted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- help_matches
CREATE TABLE IF NOT EXISTS public.help_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE NOT NULL,
    helper_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'proposed',  -- proposed | accepted | rejected
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- services
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    city TEXT,
    district TEXT,
    price_from NUMERIC,
    price_to NUMERIC,
    available_now BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- conversation_members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(conversation_id, user_id)
);

-- messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'info',       -- info | answer | request | message | system
    target_type TEXT,               -- question | request | conversation
    target_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- reports
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    target_type TEXT NOT NULL,      -- user | question | answer | request | service
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending | resolved | dismissed
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- verification_requests
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending',  -- pending | approved | rejected
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =======================================================
-- CREATE request_directory VIEW (for backward compatibility)
-- Drop first to avoid column conflict errors
-- =======================================================
DROP VIEW IF EXISTS public.request_directory CASCADE;
CREATE VIEW public.request_directory AS
    SELECT r.*, r.requester_id AS author_id
    FROM public.requests r;


-- =======================================================
-- ROW LEVEL SECURITY
-- =======================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- questions
DROP POLICY IF EXISTS "questions_select" ON public.questions;
DROP POLICY IF EXISTS "questions_insert" ON public.questions;
DROP POLICY IF EXISTS "questions_update" ON public.questions;
DROP POLICY IF EXISTS "questions_delete" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (true);
CREATE POLICY "questions_insert" ON public.questions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "questions_update" ON public.questions FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "questions_delete" ON public.questions FOR DELETE USING (auth.uid() = author_id);

-- answers
DROP POLICY IF EXISTS "answers_select" ON public.answers;
DROP POLICY IF EXISTS "answers_insert" ON public.answers;
DROP POLICY IF EXISTS "answers_delete" ON public.answers;
CREATE POLICY "answers_select" ON public.answers FOR SELECT USING (true);
CREATE POLICY "answers_insert" ON public.answers FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "answers_delete" ON public.answers FOR DELETE USING (auth.uid() = author_id);

-- requests
DROP POLICY IF EXISTS "requests_select" ON public.requests;
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
DROP POLICY IF EXISTS "requests_update" ON public.requests;
DROP POLICY IF EXISTS "requests_delete" ON public.requests;
CREATE POLICY "requests_select" ON public.requests FOR SELECT USING (true);
CREATE POLICY "requests_insert" ON public.requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "requests_update" ON public.requests FOR UPDATE USING (auth.uid() = requester_id);
CREATE POLICY "requests_delete" ON public.requests FOR DELETE USING (auth.uid() = requester_id);

-- help_matches
DROP POLICY IF EXISTS "help_matches_select" ON public.help_matches;
DROP POLICY IF EXISTS "help_matches_insert" ON public.help_matches;
CREATE POLICY "help_matches_select" ON public.help_matches FOR SELECT USING (true);
CREATE POLICY "help_matches_insert" ON public.help_matches FOR INSERT WITH CHECK (auth.uid() = helper_id);

-- services
DROP POLICY IF EXISTS "services_select" ON public.services;
DROP POLICY IF EXISTS "services_insert" ON public.services;
DROP POLICY IF EXISTS "services_delete" ON public.services;
CREATE POLICY "services_select" ON public.services FOR SELECT USING (true);
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (auth.uid() = provider_id);

-- conversations & members
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members_insert" ON public.conversation_members;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "conv_members_select" ON public.conversation_members FOR SELECT USING (true);
CREATE POLICY "conv_members_insert" ON public.conversation_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- messages
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- reports
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- verification_requests
DROP POLICY IF EXISTS "verif_select" ON public.verification_requests;
DROP POLICY IF EXISTS "verif_insert" ON public.verification_requests;
CREATE POLICY "verif_select" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "verif_insert" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =======================================================
-- TRIGGER: Auto-create profile on new user signup
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =======================================================
-- TRIGGER: Notify question author when answered
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_answer()
RETURNS trigger AS $$
DECLARE
  q_author UUID;
  q_title TEXT;
BEGIN
  SELECT author_id, title INTO q_author, q_title
  FROM public.questions WHERE id = new.question_id;

  IF q_author IS NOT NULL AND q_author != new.author_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, target_type, target_id)
    VALUES (q_author, 'رد جديد على سؤالك', 'شخص ما أجاب على سؤالك: ' || q_title, 'answer', 'question', new.question_id);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_answer ON public.answers;
CREATE TRIGGER on_new_answer
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_answer();

-- =======================================================
-- TRIGGER: Notify request owner when someone offers help
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_help_match()
RETURNS trigger AS $$
DECLARE
  req_owner UUID;
  req_title TEXT;
BEGIN
  SELECT requester_id, title INTO req_owner, req_title
  FROM public.requests WHERE id = new.request_id;

  IF req_owner IS NOT NULL AND req_owner != new.helper_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, target_type, target_id)
    VALUES (req_owner, 'شخص يريد مساعدتك!', 'تلقيت عرض مساعدة على طلبك: ' || req_title, 'request', 'request', new.request_id);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_help_match ON public.help_matches;
CREATE TRIGGER on_new_help_match
  AFTER INSERT ON public.help_matches
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_help_match();

-- =======================================================
-- ADMIN: allow admin/moderator to view all notifications & reports
-- =======================================================
CREATE POLICY "admin_notifications_select" ON public.notifications 
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','moderator'))
);

CREATE POLICY "admin_reports_select" ON public.reports 
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','moderator'))
);

CREATE POLICY "admin_reports_update" ON public.reports 
FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','moderator'))
);

CREATE POLICY "admin_verif_select" ON public.verification_requests 
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','moderator'))
);

CREATE POLICY "admin_verif_update" ON public.verification_requests 
FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','moderator'))
);

-- =======================================================
-- INDEXES for performance
-- =======================================================
CREATE INDEX IF NOT EXISTS idx_questions_author ON public.questions(author_id);
CREATE INDEX IF NOT EXISTS idx_questions_created ON public.questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON public.requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id);

-- =======================================================
-- SAMPLE DATA — بيانات تجريبية
-- Replace 'YOUR_USER_ID' with: 14e4309b-05f1-40b1-8564-27e0243874d5
-- =======================================================

-- Ensure profile exists for existing user
INSERT INTO public.profiles (id, username, display_name, city, district, bio, role)
VALUES (
    '14e4309b-05f1-40b1-8564-27e0243874d5',
    'admin_hayna',
    'مدير حيّنا',
    'الرياض',
    'الياسمين',
    'مؤسس تطبيق حيّنا 🏘️',
    'admin'
)
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    display_name = COALESCE(profiles.display_name, 'مدير حيّنا'),
    city = COALESCE(profiles.city, 'الرياض');

-- Sample questions
INSERT INTO public.questions (author_id, title, body, city, district)
SELECT
    '14e4309b-05f1-40b1-8564-27e0243874d5',
    q.title,
    q.body,
    'الرياض',
    'الياسمين'
FROM (VALUES
    ('وين أحصل سباك موثوق في الحي؟', 'أبحث عن سباك خبرة لإصلاح تسريب مياه، أحد عنده توصية جيدة؟'),
    ('أفضل مطعم فطور بالقرب من الياسمين؟', 'ابغى مطعم قريب وجودة عالية للفطور الصباحي مع العيلة.'),
    ('هل فيه جيم نسائي بالحي؟', 'أبحث عن ناد رياضي نسائي بأسعار معقولة ومجهز بشكل كافٍ.'),
    ('محل خضار وفواكه طازجة؟', 'أبحث عن محل متخصص في الخضار والفواكه الطازجة وبأسعار مناسبة.'),
    ('من يعرف طبيب أطفال موثوق؟', 'ابحث عن طبيب أطفال ممتاز بالرياض يفضل قريب من حي الياسمين.')
) AS q(title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.questions LIMIT 1);

-- Sample requests
INSERT INTO public.requests (requester_id, title, description, city, district, request_type, status, is_urgent)
SELECT
    '14e4309b-05f1-40b1-8564-27e0243874d5',
    r.title,
    r.description,
    'الرياض',
    'الياسمين',
    'help',
    'open',
    r.urgent
FROM (VALUES
    ('أحتاج مساعدة بنقل أثاث', 'عندي سرير وطاولة أبغى أنقلهم من البدروم للدور الثاني، يحتاج شخصين على الأقل.', true),
    ('أبغى شخص يجيب لي دواء', 'أنا مريض ومحتاج أحد يجيب الدواء من الصيدلية المجاورة، سأدفع التكاليف.', true),
    ('مطلوب مساعدة في تركيب رف', 'عندي رف جاهز للتركيب على الجدار، أحتاج شخص عنده خبرة في هذا.', false),
    ('أبحث عن كفيل لرخصة تجارية', 'أريد فتح مشروع صغير وأحتاج مساعدة في إجراءات الترخيص التجاري.', false)
) AS r(title, description, urgent)
WHERE NOT EXISTS (SELECT 1 FROM public.requests LIMIT 1);
