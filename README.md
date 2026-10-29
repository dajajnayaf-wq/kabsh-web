# كبش نجد — موقع طلب خروف استرالي

موقع ثابت (HTML + CSS + JavaScript) لعرض المنتج وإتمام الطلب، مع تسجيل دخول بحساب Google
وحفظ الطلبات في Firebase، وسلة بحد أقصى 5 رؤوس، وخيارَي دفع (نقداً عند الاستلام / تحويل بنكي مع إرفاق وصل).

## هيكل المشروع

```
index.html            الصفحة الرئيسية (المنتج + التفاصيل + اطلب الآن)
pages/
  checkout.html       السلة + بيانات التوصيل + طريقة الدفع + بوابة تسجيل الدخول
  waiting.html        صفحة انتظار التحويل + إرفاق وصل التحويل
  thanks.html         صفحة الشكر (جارٍ التجهيز)
  order.html          طريقة الطلب بالتفصيل
  policy.html         سياسة الخصوصية وحماية البيانات
  terms.html          الشروط والأحكام
css/style.css         كل التنسيقات
js/
  config.js           ⚙️ كل الإعدادات (المفاتيح، السعر، الجوال، الآيبان، الحد الأقصى)
  firebase.js         تكامل Firebase (Auth + Firestore + Storage)
  ui.js               الهيدر/الفوتر/التنبيهات/السلة/مساعدات عامة
  app.js              منطق الصفحة الرئيسية
  checkout.js         منطق السلة والدفع
  waiting.js          منطق رفع وصل التحويل
  thanks.js           منطق صفحة الشكر
assets/img/           صور المنتج والشعار (مضغوطة محلياً بصيغة WebP)
```

### ملفات الصور

| الملف | الاستخدام | ملاحظة |
|---|---|---|
| `logo.png` / `logo.webp` | شعار الموقع (الهيدر + الفوتر) | خلفية شفافة — استبدل الملف بنفس الاسم لتحديث الشعار |
| `favicon.png` | أيقونة تبويب المتصفح | الشعار داخل مربع 512×512 |
| `apple-touch-icon.png` | أيقونة الجوال (iOS) | الشعار على خلفية بيضاء 180×180 |
| `product.png` / `product.webp` | صورة المنتج (الهيرو + صفحة المنتج + السلة) | **مربعة 800×800** — استبدلها بنفس الاسم |

> **لتغيير صورة المنتج يدوياً:** ضع صورتك في `assets/img/` باسم `product.png` (وبنفس الأبعاد المربعة
> إن أمكن)، وسيظهر التحديث مباشرة في كل المواضع دون أي تعديل في الكود.
> **لتغيير الشعار:** ضع الشعار في `assets/img/logo.png` و`logo.webp`، وأعد توليد `favicon.png`
> و`apple-touch-icon.png` منه.

## التعديل السريع

كل ما تحتاج تغييره موجود في `js/config.js` فقط:

| الحقل | الوصف |
|---|---|
| `site.phoneDisplay` / `phoneIntl` | رقم الجوال المعروض ورقم الاتصال |
| `site.whatsappIntl` | رقم واتساب المتجر (بدون + وبدون مسافات) |
| `site.iban` / `bankName` | الآيبان واسم البنك للتحويل |
| `site.email` / `city` | بيانات التواصل |
| `product.price` / `oldPrice` | السعر الحالي والسعر قبل الخصم |
| `product.maxQty` | الحد الأقصى للطلب (افتراضياً 5) |
| `settings.requireLoginToOrder` | إلزام تسجيل الدخول قبل الطلب |
| `settings.strictDatabase` | إيقاف الطلب إذا فشل الحفظ في قاعدة البيانات |

مفاتيح Firebase مكتوبة مباشرة داخل `js/config.js` كما هو مطلوب (بدون ملفات `.env`).

## خطوات تفعيل Firebase (مطلوبة مرة واحدة)

1. **تفعيل تسجيل الدخول بحساب Google**
   Firebase Console ← Authentication ← Sign-in method ← فعّل **Google**.

2. **إضافة النطاقات المصرّح بها**
   Authentication ← Settings ← Authorized domains ← أضف نطاق الموقع الفعلي
   (مثال: `kabshnajd.com` و`www.kabshnajd.com`). بدون ذلك يظهر خطأ
   «النطاق الحالي غير مصرّح به» عند الضغط على زر Google.

3. **إنشاء قاعدة البيانات**
   Firestore Database ← Create database. ثم استخدم قواعد تسمح بإنشاء الطلبات
   مع منع القراءة العامة:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /orders/{orderId} {
         allow create: if true;      // إنشاء طلب من الواجهة
         allow read, update: if false;
       }
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

4. **تفعيل Storage** (لرفع صور وصولات التحويل)
   Storage ← Get started. ثم قواعد الرفع:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /receipts/{allPaths=**} {
         allow write: if request.resource.size < 8 * 1024 * 1024;
         allow read: if false;
       }
     }
   }
   ```

> ملاحظة: إن لم يُفعّل Storage، يظل الموقع يعمل ويحفظ الوصل محلياً ويطلب من العميل
> إرساله عبر واتساب (انظر `settings.strictDatabase`).

## التشغيل محلياً

الموقع يستخدم ES Modules، لذا يجب تشغيله عبر سيرفر محلي (لا يعمل بفتح الملف مباشرة):

```bash
python3 -m http.server 8080
# ثم افتح http://localhost:8080
```

## النشر

ارفع محتويات المجلد كما هي إلى أي استضافة ثابتة (Netlify, Vercel, GitHub Pages,
استضافة عادية). لا يحتاج الموقع أي خطوة بناء (build).

## ملاحظات التوافق مع سياسات الإعلانات

- توجد صفحة سياسة خصوصية وصفحة شروط وأحكام وصفحة طريقة طلب واضحة.
- تُذكر صراحةً البيانات المجمّعة والغرض منها (التواصل وتنفيذ الطلب فقط).
- لا تُجمع بيانات حساسة، ولا تُشارك مع أطراف ثالثة، ولا طرق دفع غير رسمية.
- بيانات التواصل (جوال، واتساب، بريد) ظاهرة في الفوتر وصفحات السياسة.
