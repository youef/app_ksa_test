-- انسخ هذا الملف كاملاً والصقه في Supabase > SQL Editor ثم اضغط Run.
-- Sends a real push (iPhone web app, Android, Expo) whenever a row is added to public.notifications.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_tokens jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('token', token, 'platform', platform)), '[]'::jsonb)
    INTO recipient_tokens
    FROM public.push_tokens
   WHERE user_id = NEW.user_id;

  IF jsonb_array_length(recipient_tokens) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://appksatest.vercel.app/api/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', 'a99d5e061aac0f4f8c8f9d0b53f331c3809504b8a19c3b759e755bb312ead503'),
    body := jsonb_build_object('record', to_jsonb(NEW), 'tokens', recipient_tokens)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_dispatch_push ON public.notifications;
CREATE TRIGGER notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();
