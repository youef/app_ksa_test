-- Add the profile region field used by profile editing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text;
