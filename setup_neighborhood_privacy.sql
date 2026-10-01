-- Exact-neighborhood privacy and private-message gate.
-- Run in Supabase SQL Editor after setup_database.sql and setup_privacy.sql.

CREATE OR REPLACE FUNCTION public.hayna_location_key(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT lower(regexp_replace(regexp_replace(regexp_replace(btrim(COALESCE(p_value, '')),
  '^(مدينة|حي|منطقة)\s+', '', 'i'), '[أإآ]', 'ا', 'g'), 'ة\s*$', 'ه')); $$;

CREATE OR REPLACE FUNCTION public.hayna_same_neighborhood(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles a JOIN public.profiles b ON true
    WHERE a.id = p_user_a AND b.id = p_user_b
      AND NULLIF(btrim(a.city), '') IS NOT NULL
      AND NULLIF(btrim(a.district), '') IS NOT NULL
      AND public.hayna_location_key(a.city) = public.hayna_location_key(b.city)
      AND public.hayna_location_key(a.district) = public.hayna_location_key(b.district)
  );
$$;

CREATE OR REPLACE FUNCTION public.hayna_can_dm(p_sender uuid, p_recipient uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_sender IS NOT NULL AND p_recipient IS NOT NULL AND p_sender <> p_recipient
    AND public.hayna_same_neighborhood(p_sender, p_recipient)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE
      (b.blocker_id = p_sender AND b.blocked_id = p_recipient) OR
      (b.blocker_id = p_recipient AND b.blocked_id = p_sender))
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_recipient
      AND COALESCE(p.allow_dms, 'everyone') <> 'nobody')
    AND (NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_recipient AND p.allow_dms = 'followers')
      OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = p_sender AND f.following_id = p_recipient));
$$;

CREATE OR REPLACE FUNCTION public.hayna_is_conversation_member(p_conversation uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.conversation_members cm
  WHERE cm.conversation_id = p_conversation AND cm.user_id = p_user); $$;

CREATE OR REPLACE FUNCTION public.hayna_conversation_is_empty(p_conversation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NOT EXISTS (SELECT 1 FROM public.conversation_members cm
  WHERE cm.conversation_id = p_conversation); $$;

CREATE OR REPLACE FUNCTION public.hayna_is_staff(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user AND p.role IN ('admin', 'moderator')); $$;

REVOKE ALL ON FUNCTION public.hayna_same_neighborhood(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hayna_can_dm(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hayna_is_conversation_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hayna_conversation_is_empty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hayna_is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hayna_same_neighborhood(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hayna_can_dm(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hayna_is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hayna_conversation_is_empty(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hayna_is_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR public.hayna_is_staff(auth.uid()) OR public.hayna_same_neighborhood(auth.uid(), id)
);

DROP POLICY IF EXISTS "questions_insert" ON public.questions;
CREATE POLICY "questions_insert" ON public.questions FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
  AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid()))
  AND public.hayna_same_neighborhood(auth.uid(), author_id)
);
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert" ON public.requests FOR INSERT WITH CHECK (
  auth.uid() = requester_id
  AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
  AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid()))
);
DROP POLICY IF EXISTS "services_insert" ON public.services;
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (
  auth.uid() = provider_id
  AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
  AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid()))
);
DROP POLICY IF EXISTS "answers_insert" ON public.answers;
CREATE POLICY "answers_insert" ON public.answers FOR INSERT WITH CHECK (
  auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id)
);

-- Feed policies enforce exact neighborhood at the database boundary.
DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (
  auth.uid() = author_id OR (auth.uid() IS NOT NULL AND public.hayna_same_neighborhood(auth.uid(), author_id)
    AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
    AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid())))
);

DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select" ON public.requests FOR SELECT USING (
  auth.uid() = requester_id OR (auth.uid() IS NOT NULL AND public.hayna_same_neighborhood(auth.uid(), requester_id)
    AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
    AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid())))
);

DROP POLICY IF EXISTS "services_select" ON public.services;
CREATE POLICY "services_select" ON public.services FOR SELECT USING (
  auth.uid() = provider_id OR (auth.uid() IS NOT NULL AND public.hayna_same_neighborhood(auth.uid(), provider_id)
    AND public.hayna_location_key(city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
    AND public.hayna_location_key(district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid())))
);

DROP POLICY IF EXISTS "help_matches_select" ON public.help_matches;
CREATE POLICY "help_matches_select" ON public.help_matches FOR SELECT USING (
  auth.uid() = helper_id OR EXISTS (
    SELECT 1 FROM public.requests r WHERE r.id = request_id
      AND (r.requester_id = auth.uid() OR public.hayna_same_neighborhood(auth.uid(), r.requester_id))
  )
);
DROP POLICY IF EXISTS "help_matches_insert" ON public.help_matches;
CREATE POLICY "help_matches_insert" ON public.help_matches FOR INSERT WITH CHECK (
  auth.uid() = helper_id AND EXISTS (
    SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.status = 'open'
      AND public.hayna_same_neighborhood(auth.uid(), r.requester_id)
      AND public.hayna_location_key(r.city) = public.hayna_location_key((SELECT p.city FROM public.profiles p WHERE p.id = auth.uid()))
      AND public.hayna_location_key(r.district) = public.hayna_location_key((SELECT p.district FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "answers_select" ON public.answers;
CREATE POLICY "answers_select" ON public.answers FOR SELECT USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id)
);

-- Conversation members can only be discovered by members. A second member may be
-- added only when the initiating user is allowed to contact that exact neighbor.
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ALTER COLUMN created_by SET DEFAULT auth.uid();
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (
  created_by = auth.uid() OR public.hayna_is_conversation_member(id, auth.uid())
);
DROP POLICY IF EXISTS "conv_members_select" ON public.conversation_members;
CREATE POLICY "conv_members_select" ON public.conversation_members FOR SELECT USING (
  public.hayna_is_conversation_member(conversation_id, auth.uid())
);
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "conv_members_insert" ON public.conversation_members;
CREATE POLICY "conv_members_insert" ON public.conversation_members FOR INSERT WITH CHECK (
  (auth.uid() = user_id AND public.hayna_conversation_is_empty(conversation_id))
  OR (auth.uid() IS NOT NULL AND public.hayna_can_dm(auth.uid(), user_id)
    AND public.hayna_is_conversation_member(conversation_id, auth.uid()))
);

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  public.hayna_is_conversation_member(conversation_id, auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.conversation_members other
    WHERE other.conversation_id = conversation_id AND other.user_id <> auth.uid()
      AND NOT public.hayna_same_neighborhood(auth.uid(), other.user_id))
  AND NOT EXISTS (SELECT 1 FROM public.blocks b JOIN public.conversation_members other
    ON other.conversation_id = conversation_id AND other.user_id <> auth.uid()
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = other.user_id)
       OR (b.blocker_id = other.user_id AND b.blocked_id = auth.uid()))
);
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND public.hayna_is_conversation_member(conversation_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.conversation_members other
    WHERE other.conversation_id = conversation_id AND other.user_id <> auth.uid()
      AND public.hayna_can_dm(auth.uid(), other.user_id))
);
