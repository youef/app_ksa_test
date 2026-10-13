-- ============================================================
-- Comprehensive fixes for all reported issues
-- ============================================================

-- ============================================================
-- 1. Fix requests table - request_type check constraint
-- ============================================================

-- First, check current constraint and drop if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'requests_request_type_check'
    ) THEN
        ALTER TABLE public.requests DROP CONSTRAINT requests_request_type_check;
    END IF;
END $$;

-- Add proper request_type check constraint with all valid types
ALTER TABLE public.requests
ADD CONSTRAINT requests_request_type_check 
CHECK (request_type IN (
    'help',           -- فزعة حارة / مساعدة عامة
    'service',        -- طلب خدمة
    'carpooling',     -- ركوب مشترك
    'delivery',       -- توصيل
    'moving',         -- نقل أثاث
    'maintenance',    -- صيانة
    'repair',         -- إصلاح
    'other'           -- أخرى
));

-- Ensure request_type has default value
ALTER TABLE public.requests 
ALTER COLUMN request_type SET DEFAULT 'help';

-- ============================================================
-- 2. Add missing columns to requests table
-- ============================================================

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS activity_type TEXT,  -- 'request', 'service', 'question', 'carpool'
ADD COLUMN IF NOT EXISTS related_entity_id UUID, -- reference to service/question/carpool
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_participants INT,
ADD COLUMN IF NOT EXISTS current_participants INT NOT NULL DEFAULT 0;

-- Index for better query performance
CREATE INDEX IF NOT EXISTS requests_type_status_idx ON public.requests (request_type, status);
CREATE INDEX IF NOT EXISTS requests_city_district_idx ON public.requests (city, district);
CREATE INDEX IF NOT EXISTS requests_expires_at_idx ON public.requests (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS requests_is_anonymous_idx ON public.requests (is_anonymous);

-- ============================================================
-- 3. Fix profiles - add activity visibility and location filtering
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_in_search BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_city_district_search_idx ON public.profiles (city, district, show_in_search) WHERE show_in_search = TRUE;

-- ============================================================
-- 4. Carpooling enhancements
-- ============================================================

-- Add carpool-specific columns to requests
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS available_seats INT,
ADD COLUMN IF NOT EXISTS price_per_seat NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
ADD COLUMN IF NOT EXISTS route_waypoints JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recurring_days TEXT[], -- e.g., ['monday', 'wednesday', 'friday']
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;

-- Carpool participants table
CREATE TABLE IF NOT EXISTS public.carpool_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carpool_request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'completed'
    seats_booked INT NOT NULL DEFAULT 1,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE(carpool_request_id, user_id)
);

ALTER TABLE public.carpool_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carpool_participants_read ON public.carpool_participants;
CREATE POLICY carpool_participants_read ON public.carpool_participants
    FOR SELECT USING (
        user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.requests WHERE id = carpool_request_id AND requester_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS carpool_participants_insert ON public.carpool_participants;
CREATE POLICY carpool_participants_insert ON public.carpool_participants
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS carpool_participants_update ON public.carpool_participants;
CREATE POLICY carpool_participants_update ON public.carpool_participants
    FOR UPDATE USING (
        user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.requests WHERE id = carpool_request_id AND requester_id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS carpool_participants_request_idx ON public.carpool_participants (carpool_request_id);
CREATE INDEX IF NOT EXISTS carpool_participants_user_idx ON public.carpool_participants (user_id);

-- ============================================================
-- 5. Business/Service activities - ensure they show in map/search
-- ============================================================

-- Add activity tracking for services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS activity_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'hidden'
ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS inquiries_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS services_activity_idx ON public.services (activity_status, last_activity_at) WHERE activity_status = 'active';

-- Add activity tracking for questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS activity_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'resolved', 'closed', 'hidden'
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS questions_activity_idx ON public.questions (activity_status, last_activity_at) WHERE activity_status = 'active';

-- ============================================================
-- 6. Map activities - filter by actual data existence
-- ============================================================

-- Create a view for map activities that only shows entities with actual data
CREATE OR REPLACE VIEW public.map_activities AS
SELECT 
    'service' AS activity_type,
    s.id,
    s.provider_id AS user_id,
    s.name AS title,
    s.description,
    s.city,
    s.district,
    s.lat,
    s.lng,
    s.category,
    s.created_at,
    s.last_activity_at,
    'service' AS entity_type
FROM public.services s
WHERE s.activity_status = 'active' 
  AND s.lat IS NOT NULL 
  AND s.lng IS NOT NULL

UNION ALL

SELECT 
    'request' AS activity_type,
    r.id,
    r.requester_id AS user_id,
    r.title,
    r.description,
    r.city,
    r.district,
    r.lat,
    r.lng,
    r.request_type AS category,
    r.created_at,
    r.last_activity_at,
    'request' AS entity_type
FROM public.requests r
WHERE r.status IN ('open', 'in_progress')
  AND r.lat IS NOT NULL 
  AND r.lng IS NOT NULL

UNION ALL

SELECT 
    'question' AS activity_type,
    q.id,
    q.author_id AS user_id,
    q.title,
    q.body AS description,
    q.city,
    q.district,
    q.lat,
    q.lng,
    'community' AS category,
    q.created_at,
    q.last_activity_at,
    'question' AS entity_type
FROM public.questions q
WHERE q.activity_status = 'active'
  AND q.lat IS NOT NULL 
  AND q.lng IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.map_activities TO anon, authenticated, service_role;

-- ============================================================
-- 7. Search improvements - filter anonymous users and same city
-- ============================================================

-- Create a secure search function that respects privacy
CREATE OR REPLACE FUNCTION public.search_users_safe(
    p_query TEXT DEFAULT '',
    p_city TEXT DEFAULT NULL,
    p_district TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_requester_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    city TEXT,
    district TEXT,
    is_verified BOOLEAN,
    distance_km NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requester_city TEXT;
    v_requester_district TEXT;
BEGIN
    -- Get requester's location if not provided
    IF p_city IS NULL AND p_requester_id IS NOT NULL THEN
        SELECT city, district INTO v_requester_city, v_requester_district
        FROM public.profiles WHERE id = p_requester_id;
    ELSE
        v_requester_city := p_city;
        v_requester_district := p_district;
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.city,
        p.district,
        p.is_verified,
        CASE 
            WHEN p.lat IS NOT NULL AND p.lng IS NOT NULL 
                 AND (SELECT lat FROM public.profiles WHERE id = p_requester_id) IS NOT NULL
            THEN round(
                6371 * acos(
                    cos(radians((SELECT lat FROM public.profiles WHERE id = p_requester_id))) 
                    * cos(radians(p.lat)) 
                    * cos(radians(p.lng) - radians((SELECT lng FROM public.profiles WHERE id = p_requester_id))) 
                    + sin(radians((SELECT lat FROM public.profiles WHERE id = p_requester_id))) 
                    * sin(radians(p.lat))
                )::numeric, 2
            )
        END AS distance_km
    FROM public.profiles p
    WHERE p.show_in_search = TRUE
      AND (p.is_anonymous IS NOT TRUE OR p.id = p_requester_id)
      AND (v_requester_city IS NULL OR p.city = v_requester_city)
      AND (v_requester_district IS NULL OR p.district = v_requester_district)
      AND (p_query = '' OR p.display_name ILIKE '%' || p_query || '%' OR p.username ILIKE '%' || p_query || '%')
      AND p.id != p_requester_id
    ORDER BY 
        CASE WHEN p.city = v_requester_city THEN 0 ELSE 1 END,
        CASE WHEN p.district = v_requester_district THEN 0 ELSE 1 END,
        p.is_verified DESC,
        p.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users_safe(TEXT, TEXT, TEXT, INT, UUID) TO anon, authenticated, service_role;

-- ============================================================
-- 8. Search function for all content types (safe, filtered)
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_all_content(
    p_query TEXT,
    p_user_id UUID,
    p_city TEXT DEFAULT NULL,
    p_district TEXT DEFAULT NULL,
    p_types TEXT[] DEFAULT ARRAY['services', 'requests', 'questions', 'carpools'],
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    type TEXT,
    id UUID,
    title TEXT,
    subtitle TEXT,
    city TEXT,
    district TEXT,
    created_at TIMESTAMPTZ,
    rank REAL,
    user_id UUID,
    is_own BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tsquery TEXT;
    v_city_filter TEXT := p_city;
    v_district_filter TEXT := p_district;
BEGIN
    -- Use user's city/district if not provided
    IF v_city_filter IS NULL THEN
        SELECT city, district INTO v_city_filter, v_district_filter
        FROM public.profiles WHERE id = p_user_id;
    END IF;

    -- Build tsquery
    v_tsquery := regexp_replace(p_query, '[^\p{L}\p{N}\s]', '', 'g');
    v_tsquery := regexp_replace(v_tsquery, '\s+', ' & ', 'g');
    IF v_tsquery = '' THEN
        RETURN;
    END IF;

    -- Services
    IF 'services' = ANY(p_types) THEN
        RETURN QUERY
        SELECT 
            'service'::TEXT AS type,
            s.id,
            s.name AS title,
            s.description AS subtitle,
            s.city,
            s.district,
            s.created_at,
            ts_rank_cd(s.search_vector, to_tsquery('arabic', v_tsquery)) AS rank,
            s.provider_id AS user_id,
            (s.provider_id = p_user_id) AS is_own
        FROM public.services s
        WHERE s.activity_status = 'active'
          AND s.search_vector @@ to_tsquery('arabic', v_tsquery)
          AND (v_city_filter IS NULL OR s.city = v_city_filter)
          AND (v_district_filter IS NULL OR s.district = v_district_filter);
    END IF;

    -- Requests
    IF 'requests' = ANY(p_types) THEN
        RETURN QUERY
        SELECT 
            'request'::TEXT AS type,
            r.id,
            r.title,
            r.description AS subtitle,
            r.city,
            r.district,
            r.created_at,
            ts_rank_cd(r.search_vector, to_tsquery('arabic', v_tsquery)) AS rank,
            r.requester_id AS user_id,
            (r.requester_id = p_user_id) AS is_own
        FROM public.requests r
        WHERE r.status IN ('open', 'in_progress')
          AND r.search_vector @@ to_tsquery('arabic', v_tsquery)
          AND (v_city_filter IS NULL OR r.city = v_city_filter)
          AND (v_district_filter IS NULL OR r.district = v_district_filter);
    END IF;

    -- Questions
    IF 'questions' = ANY(p_types) THEN
        RETURN QUERY
        SELECT 
            'question'::TEXT AS type,
            q.id,
            q.title,
            q.body AS subtitle,
            q.city,
            q.district,
            q.created_at,
            ts_rank_cd(q.search_vector, to_tsquery('arabic', v_tsquery)) AS rank,
            q.author_id AS user_id,
            (q.author_id = p_user_id) AS is_own
        FROM public.questions q
        WHERE q.activity_status = 'active'
          AND q.search_vector @@ to_tsquery('arabic', v_tsquery)
          AND (v_city_filter IS NULL OR q.city = v_city_filter)
          AND (v_district_filter IS NULL OR q.district = v_district_filter);
    END IF;

    -- Carpools (requests with carpooling type)
    IF 'carpools' = ANY(p_types) THEN
        RETURN QUERY
        SELECT 
            'carpool'::TEXT AS type,
            r.id,
            r.title,
            r.description AS subtitle,
            r.city,
            r.district,
            r.created_at,
            ts_rank_cd(r.search_vector, to_tsquery('arabic', v_tsquery)) AS rank,
            r.requester_id AS user_id,
            (r.requester_id = p_user_id) AS is_own
        FROM public.requests r
        WHERE r.request_type = 'carpooling'
          AND r.status IN ('open', 'in_progress')
          AND r.search_vector @@ to_tsquery('arabic', v_tsquery)
          AND (v_city_filter IS NULL OR r.city = v_city_filter)
          AND (v_district_filter IS NULL OR r.district = v_district_filter);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_all_content(TEXT, UUID, TEXT, TEXT, TEXT[], INT) TO anon, authenticated, service_role;

-- ============================================================
-- 9. Fix search_vector for requests (ensure it includes request_type)
-- ============================================================

-- Update requests search_vector to include request_type
ALTER TABLE public.requests
DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.requests
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('arabic', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(request_type, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(city, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(district, '')), 'C')
) STORED;

DROP INDEX IF EXISTS requests_search_vector_idx;
CREATE INDEX IF NOT EXISTS requests_search_vector_idx ON public.requests USING GIN (search_vector);

-- ============================================================
-- 10. Update existing data
-- ============================================================

-- Set default request_type for existing rows
UPDATE public.requests SET request_type = 'help' WHERE request_type IS NULL;

-- Set activity_status for existing services
UPDATE public.services SET activity_status = 'active', last_activity_at = created_at WHERE activity_status IS NULL;

-- Set activity_status for existing questions
UPDATE public.questions SET activity_status = 'active', last_activity_at = created_at WHERE activity_status IS NULL;

-- Set show_in_search for existing profiles
UPDATE public.profiles SET show_in_search = TRUE WHERE show_in_search IS NULL;

-- ============================================================
-- 11. RLS Policies for new tables
-- ============================================================

-- Carpool participants policies already added above

-- Enable RLS on map_activities view (already granted)

-- ============================================================
-- 11. Notifications for carpool events
-- ============================================================

-- Add carpool notification types
-- (handled by existing notifications table, just ensure types are valid)

-- ============================================================
-- 12. Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_requests_carpooling ON public.requests (request_type) WHERE request_type = 'carpooling';
CREATE INDEX IF NOT EXISTS idx_carpool_participants_status ON public.carpool_participants (status);
CREATE INDEX IF NOT EXISTS idx_services_activity_status ON public.services (activity_status) WHERE activity_status = 'active';
CREATE INDEX IF NOT EXISTS idx_questions_activity_status ON public.questions (activity_status) WHERE activity_status = 'active';

-- ============================================================
-- 12. Refresh materialized views / stats
-- ============================================================

-- Refresh any cached data
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- End of comprehensive fixes
-- ============================================================