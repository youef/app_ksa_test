-- ==========================================================
-- Migration: Advanced Neighborhood Intelligence & Verification
-- إضافة أعمدة الطوارئ وإعارة الأدوات والتحقق الجغرافي
-- ==========================================================

-- 1. تحديث جدول الملفات الشخصية (profiles) لدعم شارة ابن الحي الموثق والعنوان الوطني
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_geoverified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS national_address_code TEXT,
ADD COLUMN IF NOT EXISTS geoverified_at TIMESTAMPTZ;

-- 2. تحديث جدول الأسئلة (questions) لدعم الطوارئ العاجلة، التصنيفات الذكية، وإعارة الأدوات
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'normal', -- normal | warning | emergency
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS is_tool_sharing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS item_type TEXT, -- borrow | donate | inquiry
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 3. فهارس لتحسين سرعة الاستعلام والفلترة الجغرافية والطوارئ
CREATE INDEX IF NOT EXISTS idx_questions_emergency ON public.questions(is_emergency) WHERE is_emergency = true;
CREATE INDEX IF NOT EXISTS idx_questions_city_district ON public.questions(city, district);
CREATE INDEX IF NOT EXISTS idx_profiles_geoverified ON public.profiles(is_geoverified);

COMMENT ON COLUMN public.profiles.is_geoverified IS 'شارة ساكن موثق بالحي عبر الفحص الجغرافي GPS';
COMMENT ON COLUMN public.profiles.national_address_code IS 'الرمز المختصر للعنوان الوطني السعودي مثل RRRD2929';
COMMENT ON COLUMN public.questions.is_emergency IS 'تحديد الأسئلة كبلاغ طارئ عاجل لأهل الحي بواسطة الذكاء الاصطناعي';

-- 4. تفعيل سياسة حذف الإشعارات للمستخدم نفسه
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

