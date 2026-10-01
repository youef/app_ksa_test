-- ====================================================
-- Saved Questions Table
-- يُستخدم لحفظ الاستفسارات التي يضغط عليها المستخدم 🔖
-- ====================================================

CREATE TABLE IF NOT EXISTS public.saved_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, question_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS saved_questions_user_idx ON public.saved_questions(user_id);
CREATE INDEX IF NOT EXISTS saved_questions_question_idx ON public.saved_questions(question_id);

-- Enable Row Level Security
ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved questions"
  ON public.saved_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save questions"
  ON public.saved_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove saved questions"
  ON public.saved_questions FOR DELETE
  USING (auth.uid() = user_id);
