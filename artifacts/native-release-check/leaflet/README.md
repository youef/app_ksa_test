# Leaflet assets

مجلد مخصص لأصول Leaflet المحلية عند الحاجة. تم تعديل خريطة الويب لتحميل ملف CSS من CDN لتجاوز خطأ bundling الخاص بمسارات `images/*.png`.

إذا رغبت لاحقًا باستضافة ملفات Leaflet محليًا، أضف ملف CSS إلى هذا المجلد وصحّح مسارات الصور داخله لتشير إلى `./images/`، ثم عدّل رابط CSS في `components/shared/NeighborhoodWebMap.web.tsx`.
