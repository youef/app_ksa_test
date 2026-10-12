# خطة تطوير لوحة الأدمن — مشروع «حيّنا»

> الهدف: تحويل لوحة الإدارة من لوحة «تقارير وقراءة» إلى **مركز عمليات احترافي** بمخططات، صندوق مهام موحّد، رؤية 360° للمستخدم، تحديثات فورية، حوكمة (أدوار/صلاحيات)، وتشغيل ميزات دون نشر جديد.

- **الملف الأساسي:** `app/admin.tsx` (شاشة واحدة كبيرة) + `components/admin/*`.
- **الأنواع:** `components/admin/adminTypes.ts`
- **الأنماط:** `components/admin/adminStyles.ts` (`ADMIN_COLORS` / `adminStyles`)
- **الخط الخلفي:** Supabase (PostgreSQL + RLS) + Vercel API.

---

## 1) التشخيص (الوضع الحالي)

**الموجود:** 10 تبويبات — النظرة العامة/KPI، المستخدمون، مكتب التوثيق، مركز البلاغات، موارد المنصة، مراقبة المحتوى، بث تعميم، سجل العمليات، إدارة المواقع، الهوية والشعار. إضافة إلى تصدير، تحديث، فحص مستخدم (مبدئي)، إشعار مباشر، `admin_update_user` RPC، تسجيل تدقيق.

**الفجوات:**
- لا مخططات زمنية (نمو/اتجاهات) — أرقام ثابتة فقط.
- لا صندوق مهام موحّد؛ المعلّقات موزّعة على تبويبات بلا أولوية/SLA.
- لا رؤية 360° حقيقية للمستخدم.
- لا تحديث فوري (Realtime).
- لا بحث شامل، لا إجراءات جماعية، لا تصدير متقدّم.
- الأدوار ثابتة (`admin`/`user`) بلا صلاحيات دقيقة (RBAC).
- لا Feature Flags ولا وضع صيانة.
- البث بسيط: بلا قوالب/جدولة/شرائح/تقرير تسليم.

---

## 2) البنية المقترحة (Modular)

نقل المنطق المتزايد إلى مكوّنات مستقلة لتقليل خطر كسر `admin.tsx`:

```
components/admin/
  adminTypes.ts            # (موجود) أنواع البيانات
  adminStyles.ts           # (موجود) الأنماط والألوان
  AdminInsights.tsx        # (جديد) مخططات SVG: خطي/عمودي + مؤشرات
  AdminTaskCenter.tsx      # (جديد) صندوق المهام الموحّد + SLA
  AdminUserDrawer.tsx      # (جديد) ملف المستخدم 360° + الإجراءات
  AdminGlobalSearch.tsx    # (جديد) بحث شامل موحّد
  AdminRbacPanel.tsx       # (جديد - م3) الأدوار والصلاحيات
  AdminFeatureFlags.tsx    # (جديد - م3) مفاتيح الميزات ووضع الصيانة

hooks/
  useAdminRealtime.ts      # (جديد) اشتراكات Realtime + عدّادات
  useAdminAnalytics.ts     # (جديد) تجميع سلاسل زمنية (30 يوم)
```

---

## 3) المراحل

### المرحلة 1 — أساس احترافي (بدون تغييرات قاعدة بيانات) ✅ أولوية
1. **مخططات بيانية:** سلسلة 30 يومًا لنمو المستخدمين/المنشورات/البلاغات + مؤشرات اتجاه (△/▽).
   - مصدر البيانات: استعلام `created_at` خلال 30 يومًا ثم تجميع محلي يوميًا.
   - الرسم: `react-native-svg` (منطقة/خط + أعمدة) — بدون مكتبات خارجية.
2. **مركز المهام الموحّد:** تبويب يجمع (بلاغات معلقة + توثيق معلق + محتوى بانتظار مراجعة + طوارئ نشطة) مع ترتيب بالأولوية ومؤقّت عمر الطلب (SLA) وأزرار انتقال سريع.
3. **رؤية المستخدم 360°:** ملف موسّع (نشاط، آخر منشورات، أجهزة الإشعارات، مدينة/حي، شارات) + إجراءات فورية (توثيق/ابن حي/ترقية/حظر/إشعار) وسجل.
4. **التحديث الفوري (Realtime):** الاشتراك في `reports`, `verification_requests`, `urgent_alerts`, `questions` وإظهار شارة/إشعار + صوت اختياري.
5. **تلميع التصميم:** مكوّنات Skeleton للتحميل، توحيد الشرائح، تحسين الحالات الفارغة.

### المرحلة 2 — قوة تشغيلية
6. **بحث شامل موحّد** عبر المستخدمين/المحتوى/البلاغات/الخدمات + حفظ الفلاتر.
7. **إجراءات جماعية:** تحديد متعدد (تأكيد/رفض/حذف/تحذير) مع شريط إجراءات عائم.
8. **تصدير متقدّم CSV/Excel** لكل قسم مع فلترة بالتاريخ.
9. **مركز تنبيهات الأدمن:** قائمة موحّدة للتنبيهات + إدارة الإشعارات.
10. **سجل تدقيق محسّن:** بحث/فلترة/تفاصيل قبل–بعد.

### المرحلة 3 — حوكمة ومراقبة
11. **RBAC:** جدول `admin_roles`/`role_permissions`، أدوار مخصصة، دعوة مدراء، صلاحيات دقيقة لكل تبويب/إجراء (يتطلب migration).
12. **Feature Flags ووضع الصيانة:** جدول `app_config` يقرأه التطبيق (DB-driven).
13. **مراقبة البنية:** زمن استجابة API، معدل الأخطاء، حجم القاعدة، إحصاءات تسليم الإشعارات.
14. **بث متقدّم:** قوالب، جدولة، استهداف شرائح (مدينة/دور/موثّق)، معاينة، تقرير تسليم.
15. **الأمان:** 2FA للأدمن، إدارة الجلسات، تأكيد العمليات الحساسة، تحديد المعدّل.

---

## 4) مخطط قاعدة البيانات (للمراحل 2–3)

```sql
-- أدوار وصلاحيات دقيقة (RBAC)
create table if not exists admin_roles (
  key text primary key,            -- owner, moderator, verifier, support
  label text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists admin_role_assignments (
  user_id uuid references profiles(id) on delete cascade,
  role_key text references admin_roles(key) on delete cascade,
  assigned_by uuid,
  created_at timestamptz default now(),
  primary key (user_id, role_key)
);

-- مفاتيح الميزات / وضع الصيانة
create table if not exists app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz default now()
);

-- قوالب وجدولة البث
create table if not exists broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  body text not null,
  type text not null default 'official',
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists scheduled_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null,
  broadcast_type text not null default 'official',
  target jsonb not null default '{"scope":"all"}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending',   -- pending | sent | canceled
  created_by uuid,
  created_at timestamptz default now()
);
```

> جميع الاستعلامات الجديدة تُصمَّم لتُخفِق بأمان (graceful) إذا لم تكن الجداول موجودة بعد.

---

## 5) معايير الإنجاز (Definition of Done)

- `npm run typecheck` نظيف (لا أخطاء جديدة).
- كل ميزة تعمل على `/admin` في الويب بلا أخطاء كونسول.
- لا كسر للتبويبات الحالية، ولا الاعتماد على بيانات وهمية عند غياب الجداول.
- تسجيل كل إجراء رقابي في `admin_activity_logs`.
- الإبقاء على RLS؛ لا يُرسَل أي مفتاح سري إلى الواجهة.

---

## 6) المخاطر

| الخطر | التخفيف |
|---|---|
| حجم `admin.tsx` الكبير | نقل المنطق لمكوّنات `components/admin/*` |
| جداول غير موجودة | قراءة متسامحة + قيم افتراضية |
| Realtime يحتاج تفعيل بالجدول | fallback: تحديث دوري/يدوي |
| تزامن مع عمل وكيل آخر | تعديل ملفاتي فقط + فحص دائم قبل الالتزام |
