# دليل إعداد قاعدة البيانات — حيّنا App

## الخطوات (3 دقائق فقط)

### 1. افتح Supabase SQL Editor
اذهب لـ: https://supabase.com/dashboard/project/vkeuyompnddqfvulalkk/sql/new

### 2. انسخ والصق كامل محتوى الملف
`c:\Users\ph\Desktop\app_ksa-main\setup_database.sql`

### 3. اضغط RUN

## ماذا سيُنشئ هذا الملف؟

| الجدول | الوصف |
|---|---|
| `profiles` | بيانات المستخدمين |
| `questions` | الأسئلة والنقاشات |
| `answers` | الردود على الأسئلة |
| `requests` | طلبات الفزعة |
| `help_matches` | عروض المساعدة |
| `services` | الخدمات والأعمال |
| `conversations` | المحادثات |
| `messages` | الرسائل |
| `notifications` | الإشعارات |
| `reports` | البلاغات |
| `verification_requests` | طلبات التوثيق |

## الـ Triggers التلقائية

| Trigger | الوظيفة |
|---|---|
| `on_auth_user_created` | إنشاء profile تلقائياً عند التسجيل |
| `on_new_answer` | إشعار صاحب السؤال عند وصول رد |
| `on_new_help_match` | إشعار صاحب الطلب عند وصول عرض مساعدة |

## بعد تشغيل SQL

ستجد 5 أسئلة و4 طلبات تجريبية جاهزة في التطبيق تلقائياً.

## تعيين مستخدم كـ Admin

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = '14e4309b-05f1-40b1-8564-27e0243874d5';
```
