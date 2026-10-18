
-- =========================================================
-- Threaded answer management, ownership policies, realtime
-- =========================================================

-- 1. Enable RLS
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- 2. Authors can update their own answers
DROP POLICY IF EXISTS "Authors can update own answers"
ON public.answers;

CREATE POLICY "Authors can update own answers"
ON public.answers
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- 3. Authors can delete their own answers
DROP POLICY IF EXISTS "Authors can delete own answers"
ON public.answers;

CREATE POLICY "Authors can delete own answers"
ON public.answers
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- 4. Grant required table privileges
GRANT UPDATE, DELETE ON public.answers TO authenticated;

-- 5. Enforce answer ownership and immutable authorship
CREATE OR REPLACE FUNCTION public.hayna_enforce_answer_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF auth.uid() IS DISTINCT FROM OLD.author_id THEN
            RAISE EXCEPTION 'ANSWER_OWNER_REQUIRED';
        END IF;

        RETURN OLD;
    END IF;

    IF (
        NEW.body IS DISTINCT FROM OLD.body
        OR NEW.author_id IS DISTINCT FROM OLD.author_id
    ) AND auth.uid() IS DISTINCT FROM OLD.author_id THEN
        RAISE EXCEPTION 'ANSWER_OWNER_REQUIRED';
    END IF;

    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
        RAISE EXCEPTION 'ANSWER_OWNER_IMMUTABLE';
    END IF;

    RETURN NEW;
END;
$function$;

-- 6. Attach ownership triggers
DROP TRIGGER IF EXISTS answers_enforce_owner_update
ON public.answers;

CREATE TRIGGER answers_enforce_owner_update
BEFORE UPDATE ON public.answers
FOR EACH ROW
EXECUTE FUNCTION public.hayna_enforce_answer_owner();

DROP TRIGGER IF EXISTS answers_enforce_owner_delete
ON public.answers;

CREATE TRIGGER answers_enforce_owner_delete
BEFORE DELETE ON public.answers
FOR EACH ROW
EXECUTE FUNCTION public.hayna_enforce_answer_owner();

-- 7. Detach child answers before deleting a parent answer
CREATE OR REPLACE FUNCTION public.hayna_detach_child_answers_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    UPDATE public.answers
       SET parent_answer_id = NULL
     WHERE parent_answer_id = OLD.id;

    RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS answers_detach_children_before_delete
ON public.answers;

CREATE TRIGGER answers_detach_children_before_delete
BEFORE DELETE ON public.answers
FOR EACH ROW
EXECUTE FUNCTION public.hayna_detach_child_answers_before_delete();

-- 8. Enable Supabase Realtime publication for answers
--    and notifications when the table exists.
DO $function$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'answers'
        ) THEN
            ALTER PUBLICATION supabase_realtime
            ADD TABLE public.answers;
        END IF;

        IF to_regclass('public.notifications') IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime'
                 AND schemaname = 'public'
                 AND tablename = 'notifications'
           ) THEN
            ALTER PUBLICATION supabase_realtime
            ADD TABLE public.notifications;
        END IF;

    END IF;
END;
$function$;
