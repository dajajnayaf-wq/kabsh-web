# دليل المشروع للوكلاء (AGENTS.md)

## نظرة عامة
موقع ثابت (Static) لمتجر «كبش نجد» لطلب خروف استرالي. لا يوجد build step ولا package manager،
ولا أي أطر عمل — HTML + CSS + JavaScript خالص عبر ES Modules.

## بنية الملفات
- `index.html` الصفحة الرئيسية، و`pages/*.html` بقية الصفحات.
- `js/config.js` **المصدر الوحيد للحقيقة** لكل الإعدادات (مفاتيح Firebase، السعر، الجوال، الآيبان، `maxQty`).
- `js/ui.js` الهيدر/الفوتر المشتركان (`renderHeader`/`renderFooter`) + السلة + التنبيهات.
- `js/firebase.js` تكامل Firebase عبر استيراد ديناميكي من CDN (Auth, Firestore, Storage).
- `js/{app,checkout,waiting,thanks}.js` منطق كل صفحة.
- `css/style.css` كل التنسيقات (متغيرات CSS في `:root`).

## قواعد مهمة يجب الالتزام بها
1. **المسارات النسبية:** صفحات `pages/` تستخدم `../` للأصول، والجذر يستخدم المسار المباشر.
   استخدم دائماً الدالة `assetPath()` من `js/ui.js` لبناء الروابط داخل JS.
2. **`[hidden]`:** يوجد قاعدة عامة `[hidden]{display:none!important}` في `style.css` — لا تحذفها،
   لأن المكونات تستخدم `display:flex/grid` وهذا يتغلب على سلوك `hidden` الافتراضي.
3. **السلة:** تُحفظ في `localStorage` بمفتاح `settings.cartStorageKey`، والحد الأقصى `product.maxQty`
   مطبّق في `ui.js` و`app.js` و`checkout.js` معاً. أي تغيير يجب أن يحترم الحد.
4. **تسجيل الدخول:** `settings.requireLoginToOrder` يُخفي نموذج الطلب ويُظهر بوابة Google.
   في `checkout.js` تُستدعى `currentUser()` قبل `watchUser()` لإكمال نتيجة تحويل Google.
5. **لا تستخدم `alert()`** — استخدم `toast()` من `ui.js`.

## الاختبار
- شغّل سيرفر محلي: `python3 -m http.server 8080` (الموقع لا يعمل بفتح الملف مباشرة).
- اختبار الدفع الكامل بدون Firebase: عطّل مؤقتاً `settings.requireLoginToOrder`.
- Playwright مثبّت: `pip install playwright && python3 -m playwright install chromium`.
- تحقق من التخطيط: لا تجاوز أفقي في `document.documentElement.scrollWidth`.
