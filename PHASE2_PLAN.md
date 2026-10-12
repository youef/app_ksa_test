# خطة التطوير الشاملة — المرحلة التالية
**الهدف:** تحويل «حيّنا» إلى منصة حي احترافية كاملة مع أتمتة، تحليلات، أمان، وميزات مجتمعية.
**الأساس الحالي:** `/admin` مجهّز بـ Realtime، RBAC، Feature Flags، بحث شامل، بث متقدم، عرض ٣٦٠°.

---

## المرحلة ١ — أتمتة النواة (أسبوع واحد)
| المهمة | الوصف | الملفات المتأثرة |
|---|---|---|
| **Edge Cron للتعاميم المجدولة** | دالة `scheduled-broadcast-dispatch` تُنفّذ كل دقيقة، تقرأ `scheduled_broadcasts` حيث `status='pending' AND scheduled_at <= now()`، ترسل عبر `deliverBroadcast`، وتحدّث الحالة إلى `sent`. | `supabase/functions/scheduled-broadcast-dispatch/index.ts`، `supabase/config.toml` (cron) |
| **تنظيف الإشعارات القديمة** | دالة `notifications-cleanup` أسبوعية تحذف `notifications` حيث `created_at < now() - interval '90 days' AND read_at IS NOT NULL`. | `supabase/functions/notifications-cleanup/index.ts` |
| **عدادات غير طبيعية (Denormalized counts)** | دالة RPC `refresh_user_counters(user_id)` تحدّث `profiles.notifications_unread_count`, `services_count`, `requests_count`، `reports_count`؛ تُستدعى عبر trigger على الجداول ذات الصلة. | `supabase/migrations/..._denormalized_counters.sql`، `lib/counters.ts` |
| **فهرسة البحث الكامل (Full-text search)** | عمود `search_vector` على `questions`/`services`/`requests` مع trigger `tsvector_update_trigger`، وسياسة RLS للقراءة. | `supabase/migrations/..._fulltext_search.sql` |

---

## المرحلة ٢ — لوحات تشغيلية جديدة (أسبوع واحد)
| اللوحة | الميزات الرئيسية |
|---|---|
| **إدارة الفئات/الوسوم** (`/admin/categories`) | CRUD للفئات (السوق، الخدمات، الطلبات) مع أيقونة، لون، ترتيب، أب/ابن، حالة نشط/مخفي. |
| **إدارة البلاغات المتقدمة** | عرض سياق البلاغ (نص المنشور/الخدمة)، إجراءات: حذف/إخفاء/تحذير/حظر المُبلَغ، تصفية حسب الحالة/النوع/المدينة، تصدير CSV. |
| **سجل تغييرات الإعدادات (Config Audit)** | طاولة `admin_config_changes` تسجّل `key, old_value, new_value, changed_by, changed_at`، مع واجهة عرض/تراجع (point-in-time restore). |
| **إدارة الصفحات الثابتة** | محرر Markdown لـ: سياسة الخصوصية، شروط الاستخدام، دليل المجتمع، الأسئلة الشائعة — مع معاينة ونشر. |

---

## المرحلة ٣ — تجربة مشرف ممتازة (٣ أيام)
| التحسين | التنفيذ |
|---|---|
| **اختصارات لوحة مفاتيح** | `Cmd+K` → بحث شامل، `Esc` يغلق أي مودال، `Alt+1..9` ينتقل للتبويبات، `?` يعرض ورقة الغش. |
| **وضع داكن/فاتح للإدارة** | CSS variables في `adminStyles.ts` + toggle في الهيدر + حفظ في `localStorage`. |
| **سحب وإفلات لترتيب البطاقات/الأعمدة** | `@dnd-kit/core` على لوحات `AdminInsights`، `AdminTaskCenter`، وقوائم الفئات. |
| **نسخة موبايل محسّنة** | أزرار عائمة (FAB) للإجراءات الأساسية، قوائم قابلة للطي، تبويبات منزلقة أفقيًا. |

---

## المرحلة ٤ — تحليلات أعمق (أسبوع واحد)
| المقياس | التنفيذ |
|---|---|
| **مسارات التحويل (Funnels)** | حدث `funnel_step` يُسجّل في `analytics_events` (page_view, service_click, request_start, request_complete)، ولوحة تعرض كل خطوة مع نسبة السقوط. |
| **خريطة حرارية للبلاغات/الطلبات** | تجميع `reports` و `requests` حسب `city`/`district` مع `count`، عرض على `Mapbox/Leaflet` في تبويب `locations`. |
| **مقاييس الاحتفاظ (Retention Cohorts)** | استعلام أسبوعي يحسب `cohort_size` و `retention_day_1/7/30` للمستخدمين الجدد، مخططات في `AdminInsights`. |
| **لوحة إيرادات متوقعة** | جمع `services.price_from * estimated_bookings` + `requests.budget`، مع فلاتر مدينة/فئة/فترة. |

---

## المرحلة ٥ — أمان وامتثال (٣ أيام)
| الميزة | التنفيذ |
|---|---|
| **مصادقة ثنائية للعاملين (Admin 2FA)** | عمود `profiles.totp_secret` + `profiles.totp_enabled`، تدفق QR في `/admin/security`، تحقق عند كل دخول `/admin` (أو كل ٣٠ دقيقة). |
| **جلسة إدارية محدودة المدة** | متغيّر `admin_session_expires_at` في `profiles`، middleware يعيد توجيه إلى `/admin/login?reauth=1` إذا انتهت. |
| **سجل وصول (Access Log)** | طاولة `admin_access_logs` تسجّل `user_id, ip, user_agent, path, timestamp, success`، مع لوحة عرض/تصفية/تنبيه عند محاولات فاشلة متكررة. |
| **سياسة كلمات مرور قوية** | فرض طول ≥ ١٢، تعقيد، وتدوير كل ٩٠ يومًا للحسابات الإدارية. |

---

## المرحلة ٦ — ميزات مجتمعية آلية (أسبوع واحد)
| الميزة | المنطق |
|---|---|
| **بطاقات شكر/تقدير آلية** | Trigger على `services`/`requests` عند `status='completed'` → إذا وصل المستخدم لـ ٥/١٠/٢٥ خدمة مكتملة → إدراج `badge` في `user_badges` + إشعار `type='badge_earned'`. |
| **برنامج سفراء الحي** | دور `ambassador` في `admin_roles` بصلاحيات `verifications:read`, `reports:read`, `users:read`، ترشيح بتصويت بسيط (استطلاع في `questions` بعلامة `poll:ambassador_nomination`). |
| **تقارير أسبوعية آلية** | Edge Function `weekly-admin-report` تُنفّذ كل أحد ٠٩:٠٠، تبني ملخص JSON/Markdown (مستخدمون جدد، بلاغات، خدمات، إيرادات، أعلى الأحياء نشاطًا) وترسل عبر `sendAdminBroadcastPush` لكل `role='admin'`. |

---

## ترحيلات قاعدة البيانات المطلوبة (مرتبة)
1. `202610130001_denormalized_counters.sql` — أعمدة العدادات + triggers.
2. `202610130002_fulltext_search.sql` — `search_vector` + GIN index + triggers.
3. `202610130003_admin_security.sql` — `totp_secret`, `totp_enabled`, `admin_session_expires_at`, `admin_access_logs`, `admin_config_changes`, `user_badges`.
4. `202610130004_categories.sql` — طاولة `categories` مع شجرة ذاتية الإشارة.
5. `202610130005_analytics_events.sql` — طاولة `analytics_events` للمسارات والخرائط الحرارية.
6. `202610130006_weekly_report_log.sql` — طاولة `weekly_report_log` لتتبع الإرسال.

---

## Edge Functions المطلوبة
| الدالة | الجدولة | الوصف |
|---|---|---|
| `scheduled-broadcast-dispatch` | `* * * * *` (كل دقيقة) | إرسال التعاميم المستحقة. |
| `notifications-cleanup` | `0 3 * * 0` (أحد ٠٣:٠٠) | حذف إشعارات مقروءة > ٩٠ يومًا. |
| `refresh-counters` | `*/5 * * * *` (كل ٥ دقائق) | تحديث العدادات للمستخدمين النشطين حديثًا. |
| `weekly-admin-report` | `0 9 * * 0` (أحد ٠٩:٠٠) | بناء وإرسال التقرير الأسبوعي. |
| `ambassador-election` | `0 12 * * 1` (إثنين ١٢:٠٠) | إغلاق التصويت وإعلان السفراء الجدد. |

---

## ترتيب التنفيذ المقترح (سبرنتات)
| السبرنت | المخرجات |
|---|---|
| **سبرنت ١** | Edge Cron للجدولة + تنظيف الإشعارات + عدادات + Full-text search (ترحيلات ١-٢ + ٣ Functions). |
| **سبرنت ٢** | لوحات: فئات، بلاغات متقدمة، Config Audit، صفحات ثابتة (ترحيلات ٣-٤ + مكونات React). |
| **سبرنت ٣** | اختصارات، داكن/فاتح، Drag-drop، موبايل (مكونات فقط). |
| **سبرنت ٤** | Funnels، خريطة حرارية، Retention، إيرادات (ترحيل ٥ + مخططات SVG جديدة). |
| **سبرنت ٥** | 2FA، جلسة محدودة، Access Log، سياسة كلمات مرور (ترحيل ٣ المتبقي + تدفقات Auth). |
| **سبرنت ٦** | شارات آلية، سفراء، تقارير أسبوعية (ترحيل ٦ + Functions + triggers). |

---

## معايير الجاهزية (Definition of Done) لكل ميزة
- [ ] TypeScript نظيف (`tsc --noEmit`).
- [ ] يعمل على `localhost:8081` و `vercel` preview.
- [ ] اختبارات يدوية للسيناريو السعيد + حافة واحدة.
- [ ] لا أخطاء في Console.
- [ ] ترحيل SQL قابل للتطبيق على staging ثم production.
- [ ] توثيق مختصر في `PROJECT_PLAN.md` (قسم جديد لكل ميزة).

---

## ملاحظات تنفيذية
- **المكتبات الجديدة المسموحة:** `@dnd-kit/core`, `otplib` (2FA), `date-fns` (للحسابات الزمنية), `zod` (للتحقق من نماذج Edge).
- **لا قواعد بيانات خارجية** — كل شيء في Supabase (Postgres + Edge Functions + Realtime).
- **الأداء:** الاستعلامات الثقيلة (Funnels/Retention) تُحسب في Edge Function وتخزن في `analytics_aggregates` للقراءة السريعة.
- **الأمان:** كل Edge Functions تتطلب `Authorization: Bearer <SERVICE_ROLE>` أو `pg_net` مع سر مشترك.

---

**الخطوة التالية:** ابدأ بالسبرنت ١ — كتابة الترحيلات الثلاث الأولى + Edge Function `scheduled-broadcast-dispatch` (يكمل ميزة الجدولة فعلًا) + `notifications-cleanup` + عدادات denormalized.