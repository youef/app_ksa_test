# إعداد النشر التلقائي إلى Vercel

ملف سير العمل موجود في:
`.github/workflows/auto-deploy.yml`

## 1. أضف أسرار GitHub

افتح المستودع `youef/app_ksa_test` ثم:
**Settings → Secrets and variables → Actions → New repository secret**

أضف هذه الأسرار الثلاثة بالأسماء نفسها:

- `VERCEL_TOKEN`: أنشئه من صفحة Tokens في حساب Vercel.
- `VERCEL_ORG_ID`: معرّف الحساب/الفريق في Vercel.
- `VERCEL_PROJECT_ID`: معرّف مشروع حيّنا في Vercel.

يمكنك معرفة المعرّفين بعد ربط المشروع محليًا بالأوامر التالية من مجلد المشروع:

```bash
npx vercel link
```

بعدها اقرأ ملف `.vercel/project.json` محليًا؛ ستجد `orgId` و`projectId`. لا ترفع مجلد `.vercel` إلى GitHub.

## 2. تأكد من متغيرات البناء في Vercel

من **Vercel → Project Settings → Environment Variables**، تأكد من إعداد المتغيرات العامة اللازمة لبناء Expo، مثل:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (إذا كان البناء يستخدمه)

استخدم مفتاح Supabase publishable فقط داخل التطبيق. لا تضع `service_role` أو مفاتيح LiveKit السرية أو أي أسرار خادمية في متغيرات `EXPO_PUBLIC_*`.

## 3. تشغيل النشر

- عند دفع تغييرات التطبيق إلى فرع `main`، يعمل النشر تلقائيًا.
- للتشغيل اليدوي: افتح **Actions → Deploy حيّنا to Vercel → Run workflow**.

تابع سجل التشغيل من تبويب Actions. إذا ظهر خطأ في البناء أو تجاوزت حصة Vercel اليومية، راجع سجل الخطوات وانتظر تجدد الحصة أو غيّر الخطة قبل إعادة المحاولة.

## ملاحظة

لم نضف جدولة يومية؛ إعادة نشر نفس الإصدار كل يوم تستهلك حصة نشر دون فائدة. النشر يعمل عند تغييرات `main` أو بطلب يدوي.
