-- Sends a real push (iPhone web app, Android, Expo) whenever a row is added to public.notifications.
-- Before running: replace YOUR_PUSH_WEBHOOK_SECRET with the same value set in Vercel as PUSH_WEBHOOK_SECRET.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://appksatest.vercel.app/api/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', 'YOUR_PUSH_WEBHOOK_SECRET'),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_dispatch_push ON public.notifications;
CREATE TRIGGER notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();
