-- =========================================================
-- Community Hub: Account Types, Favorites, Support Tickets,
-- App Reviews, Follow Statistics
-- Compatible with Supabase / PostgreSQL
-- =========================================================

-- =========================================================
-- 1. USER ACCOUNT TYPES AND MERCHANT VERIFICATION
-- =========================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS freelance_trade text,
  ADD COLUMN IF NOT EXISTS is_verified_merchant boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'profiles_account_type_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_type_check
      CHECK (
        account_type IN ('standard', 'merchant', 'freelance', 'provider', 'idea')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'profiles_merchant_verification_consistency'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_merchant_verification_consistency
      CHECK (
        NOT (
          account_type IN ('merchant', 'freelance')
          AND is_verified_merchant IS FALSE
        ) OR TRUE
      );
  END IF;
END
$$;


-- =========================================================
-- 2. VERIFICATION REQUESTS
-- =========================================================

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS verification_type text NOT NULL DEFAULT 'identity',
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS attachment_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'verification_requests_type_check'
      AND conrelid = 'public.verification_requests'::regclass
  ) THEN
    ALTER TABLE public.verification_requests
      ADD CONSTRAINT verification_requests_type_check
      CHECK (
        verification_type IN ('identity', 'freelance', 'business')
      );
  END IF;
END
$$;


-- =========================================================
-- 3. FAVORITES / WISHLIST
-- =========================================================

CREATE TABLE IF NOT EXISTS public.favorite_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN ('service', 'product', 'request', 'store', 'post')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS favorite_items_user_idx
  ON public.favorite_items (user_id, created_at DESC);

ALTER TABLE public.favorite_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE
  ON public.favorite_items TO authenticated;

DROP POLICY IF EXISTS favorites_self_all
  ON public.favorite_items;

CREATE POLICY favorites_self_all
  ON public.favorite_items
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- =========================================================
-- 4. SUPPORT TICKETS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  subject text NOT NULL
    CHECK (char_length(subject) BETWEEN 3 AND 120),
  message text NOT NULL
    CHECK (char_length(message) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON public.support_tickets (user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.support_tickets TO anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT UPDATE ON public.support_tickets TO authenticated;

-- Allow guests and signed-in users to submit support tickets.
DROP POLICY IF EXISTS tickets_create_all
  ON public.support_tickets;

CREATE POLICY tickets_create_all
  ON public.support_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can read their own tickets.
-- Administrators can read all tickets.
DROP POLICY IF EXISTS tickets_read_own
  ON public.support_tickets;

CREATE POLICY tickets_read_own
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- Only administrators can update tickets.
DROP POLICY IF EXISTS tickets_admin_update
  ON public.support_tickets;

CREATE POLICY tickets_admin_update
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );


-- =========================================================
-- 5. APP REVIEWS AND RATINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.app_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL
    CHECK (rating BETWEEN 1 AND 5),
  body text
    CHECK (body IS NULL OR char_length(body) <= 1000),
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS app_reviews_created_idx
  ON public.app_reviews (created_at DESC);

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE
  ON public.app_reviews TO authenticated;

-- Users can submit their own review.
DROP POLICY IF EXISTS reviews_create_self
  ON public.app_reviews;

CREATE POLICY reviews_create_self
  ON public.app_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update only their own review.
DROP POLICY IF EXISTS reviews_upsert_self
  ON public.app_reviews;

CREATE POLICY reviews_upsert_self
  ON public.app_reviews
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Authenticated users can read published reviews.
DROP POLICY IF EXISTS reviews_read_public
  ON public.app_reviews;

CREATE POLICY reviews_read_public
  ON public.app_reviews
  FOR SELECT
  TO authenticated
  USING (
    published = true
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );


-- =========================================================
-- 6. FOLLOWER AND FOLLOWING STATISTICS
-- =========================================================

CREATE OR REPLACE VIEW public.user_follow_stats
WITH (security_invoker = true)
AS
SELECT
  p.id,
  (
    SELECT count(*)
    FROM public.follows f
    WHERE f.follower_id = p.id
  ) AS following_count,
  (
    SELECT count(*)
    FROM public.follows f
    WHERE f.following_id = p.id
  ) AS followers_count
FROM public.profiles p;

GRANT SELECT ON public.user_follow_stats TO authenticated;


-- =========================================================
-- 7. PROFILE ROLE DEFAULT DATA CLEANUP
-- =========================================================

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;


-- =========================================================
-- END OF SCRIPT
-- =========================================================