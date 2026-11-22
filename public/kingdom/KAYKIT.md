# أصول ممالك حينا ثلاثية الأبعاد

هذه الأصول الجاهزة من **Kay Lousberg / KayKit**، وليست المجسمات الإجرائية الأولية. الرخصة **CC0-1.0** وتسمح بالاستخدام التجاري والتعديل وإعادة التوزيع. الرخص الأصلية محفوظة داخل كل حزمة.

## المصادر الرسمية

- https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0

## داخل اللعبة

`components/game/KingdomAssets.web.ts` يحمل الشخصيات والمباني المحلية عبر GLTFLoader. الشخصية المختارة تحتوي هيكلًا عظميًا، وتنتقل بين Idle وWalking_A وRunning_A وJump_Idle. تعمل الأسهم وWASD والعصا والركض والقفز الموجودة أصلًا.

تستبدل المباني المستوردة الأشكال المؤقتة عند اكتمال تحميلها. يبقى البديل متاحًا عند فشل التحميل. أضيفت حدود تمنع اختراق المباني وحماية من تسرب الذاكرة عند تبديل الشخصية أو مغادرة الشاشة.

## إضافة أصول وتطوير الخريطة

- الشخصيات: `public/kingdom/kaykit/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/`
- المباني والأراضي والطرق والأنهار: `public/kingdom/kaykit/medieval/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`
- غيّر `KINGDOM_BUILDINGS` لإضافة مبنى أو تغيير مكانه وحجمه. تُستخدم إحداثياته أيضًا للتصادم.
- ملفات glTF تحتاج ملفات `.bin` والصور المجاورة لها؛ انسخ مجلد الأصل كاملًا. ملفات GLB للشخصيات تحتوي صورها داخليًا.
- يوجد ٥ ملفات شخصيات (Rogue وRogue_Hooded يشتركان في الشخصية الأساسية). القبطان والفارس يستخدمان Knight حاليًا.
- الحزمة تحتوي قطع خريطة مجانية قابلة للتجميع؛ تضاريس جزيرة حينا ومساراتها ما زالت مولدة بالكود، وليست خريطة خارجية كاملة جاهزة.

## التحقق وإعادة التنزيل

`python scripts/import-kingdom-kaykit.py` يعيد تنزيل الحزمتين الرسميتين ويكتب نسخة المصدر وبصمات الملفات إلى manifest.json.

`python scripts/check-kingdom-kaykit.py` يفحص البصمات وتبعيات المجسمات وحركات الشخصيات. لا يتطلب Python مكتبات إضافية.

`python scripts/package-kingdom-kaykit.py` يعيد بناء حزم ZIP الداخلية عند الحاجة. مكتبة الأصول وكتالوج التنزيلات غير معروضين للاعبين؛ تبقى ملفات المجسمات متاحة لمحرك اللعبة فقط.

اختبار المتصفح يستخدم مكوّن العالم الفعلي دون حساب: ابنِ `tests/fixtures/kingdom-review.tsx` بواسطة esbuild مع `--bundle --format=esm --jsx=automatic --outfile=artifacts/qa-runtime/kingdom-bundle.js` ثم اضبط `KINGDOM_TEST_CHROME` لمسار Chromium وشغّل `node scripts/check-kingdom-browser.cjs`. يفحص تحميل العالم، تبديل الشخصيات الخمس، حركة WASD وأخطاء المتصفح، ويحفظ لقطة داخل artifacts/qa-runtime.
