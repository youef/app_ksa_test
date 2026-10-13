# حيّنا 🇸🇦

تطبيق مجتمع سعودي مبني بـ Expo + React Native + Supabase.

## ما تم بناؤه
- تسجيل ودخول بـ Supabase Auth
- username مع فحص التوفر
- جلسة محفوظة على الجهاز عبر AsyncStorage
- الصفحة الرئيسية
- الأسئلة + البحث + الإجابات
- طلبات جيب لي + عروض المساعدة
- قبول عرض المساعدة وإنشاء محادثة
- رسائل Realtime
- إشعارات Realtime
- دليل المحلات والتقييمات
- ملف المستخدم
- RLS على جداول المجتمع
- حماية موقع الطلب الدقيق

## التشغيل
1. انسخ .env.example إلى .env
2. ضع EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY فقط
3. npm install
4. npx expo start

Supabase Project URL: https://vkeuyompnddqfvulalkk.supabase.co

لا تضع service_role أو أي secret في التطبيق أو GitHub.


## الموقع والإشعارات
- الموقع الحالي يعمل على iOS وAndroid عبر `expo-location` بعد منح صلاحية الموقع.
- إشعارات الدفع تستخدم Expo Push Service وتُسجّل أجهزة المستخدم في Supabase.
- بناء نسخة iOS/Android النهائية يحتاج EAS Build وبيانات Apple/Google الخاصة بالتطبيق.

## البثوث المباشرة
- دليل البث: «المزيد» ← «البثوث المباشرة». أضفنا دليل البث، تجهيز البث، غرفة فيديو مباشرة، التعليقات والتفاعلات، طلبات الضيوف، الإبلاغ والحظر.
- الوسائط تستخدم LiveKit. اضبط الأسرار **في Supabase Edge Function Secrets فقط**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. لا تضفها إلى `EXPO_PUBLIC_*` أو حزمة التطبيق.
- نُشرت الدالة `livekit-token` في مشروع Supabase، وطُبقت جداول وسياسات البث. لا تعمل رموز الاتصال حتى تضبط أسرار LiveKit.
- يتطلب Android/iOS بناء Expo Development Client بعد تثبيت حزم LiveKit؛ Expo Go لا يحتوي إضافات WebRTC الأصلية. الويب يستخدم LiveKit Web SDK.
```bash
supabase secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
supabase functions deploy livekit-token
```

راجع سجل migrations البعيد قبل استخدام `supabase db push` لأن سجل المشروع البعيد لا يطابق كل migrations الموجودة في هذا المستودع.

