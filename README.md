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
