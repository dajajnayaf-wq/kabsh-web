/* ==========================================================================
   كبش نجد — تكامل Firebase (تسجيل الدخول بحساب Google + قاعدة بيانات الطلبات)
   يعمل الملف عبر استيراد ديناميكي من CDN حتى لا يتأثر الموقع إذا تعذّر التحميل.
   ========================================================================== */

import { firebaseConfig, settings, firebaseEnabled } from "./config.js";

let app = null;
let authMod = null;
let dbMod = null;
let storageMod = null;
let auth = null;
let db = null;
let storage = null;
let provider = null;
let readyPromise = null;

/* تحميل مكتبات Firebase مرة واحدة فقط */
export function initFirebase() {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if (!firebaseEnabled) return null;
    const V = "10.14.1";
    const base = `https://www.gstatic.com/firebasejs/${V}`;
    try {
      const [appMod, a, d, s] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
        import(`${base}/firebase-storage.js`)
      ]);
      appMod.initializeApp(firebaseConfig);
      app = appMod.getApps()[0];
      authMod = a;
      dbMod = d;
      storageMod = s;
      auth = a.getAuth(app);
      db = d.getFirestore(app);
      storage = s.getStorage(app);
      provider = new a.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return { auth, db, storage };
    } catch (err) {
      console.error("[Firebase] تعذّر التهيئة:", err);
      return null;
    }
  })();

  return readyPromise;
}

export function isConfigured() {
  return firebaseEnabled;
}

export function getAuthInstance() { return auth; }

/* ------------------------------- المصادقة -------------------------------- */

/* تسجيل الدخول بحساب Google — يفتح نافذة منبثقة، وإن مُنعت يستخدم التحويل */
export async function signInWithGoogle() {
  const ready = await initFirebase();
  if (!ready) throw new Error("خدمة تسجيل الدخول غير متوفرة حالياً.");
  try {
    const res = await authMod.signInWithPopup(auth, provider);
    return res.user;
  } catch (err) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(err.code)) {
      await authMod.signInWithRedirect(auth, provider);
      return null; // سيتم استكمال العملية بعد عودة التحويل
    }
    throw err;
  }
}

export async function signOutUser() {
  const ready = await initFirebase();
  if (ready) await authMod.signOut(auth);
}

/* يعيد المستخدم الحالي بعد اكتمال التهيئة (مع استكمال تحويل Google إن وُجد) */
export async function currentUser() {
  const ready = await initFirebase();
  if (!ready) return null;
  try { await authMod.getRedirectResult(auth); } catch { /* لا شيء */ }
  return await new Promise((resolve) => {
    const unsub = authMod.onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

/* يراقب تغيّر حالة الدخول والخروج */
export async function watchUser(callback) {
  const ready = await initFirebase();
  if (!ready) { callback(null); return () => {}; }
  return authMod.onAuthStateChanged(auth, callback);
}

export function userProfile(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.displayName || (user.email ? user.email.split("@")[0] : "عميل"),
    email: user.email || "",
    photo: user.photoURL || ""
  };
}

/* ------------------------------ قاعدة البيانات --------------------------- */

/* حفظ بيانات العميل في مجموعة users (اختياري وغير معطّل للطلب) */
export async function saveCustomer(profile, extra = {}) {
  const ready = await initFirebase();
  if (!ready || !profile) return false;
  try {
    await dbMod.setDoc(
      dbMod.doc(db, settings.usersCollection, profile.uid),
      { name: profile.name, email: profile.email, ...extra, lastSeen: dbMod.serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn("[Firestore] لم يتم حفظ بيانات العميل:", err.code || err.message);
    return false;
  }
}

/* حفظ الطلب في Firestore — يعيد رقم الطلب أو null عند التعذّر */
export async function saveOrder(order) {
  const ready = await initFirebase();
  if (!ready) return null;
  try {
    const ref = await dbMod.addDoc(db, settings.ordersCollection, {
      ...order,
      createdAt: dbMod.serverTimestamp()
    });
    return ref.id;
  } catch (err) {
    console.warn("[Firestore] تعذّر حفظ الطلب:", err.code || err.message);
    return null;
  }
}

/* رفع صورة وصل التحويل إلى Firebase Storage — يعيد الرابط أو null */
export async function uploadReceipt(file, orderRef) {
  const ready = await initFirebase();
  if (!ready) return null;
  try {
    const safeName = (file.name || "receipt.jpg").replace(/[^\w.\-]+/g, "_");
    const ref = storageMod.ref(storage, `receipts/${orderRef || "anon"}/${Date.now()}_${safeName}`);
    await storageMod.uploadBytes(ref, file, { contentType: file.type || "image/jpeg" });
    return await storageMod.getDownloadURL(ref);
  } catch (err) {
    console.warn("[Storage] تعذّر رفع الوصل:", err.code || err.message);
    return null;
  }
}

/* تحديث الطلب بعد إرفاق وصل التحويل */
export async function markReceiptAttached(orderDocId, receipt) {
  const ready = await initFirebase();
  if (!ready || !orderDocId) return false;
  try {
    await dbMod.updateDoc(dbMod.doc(db, settings.ordersCollection, orderDocId), {
      status: "receipt_attached",
      receiptUrl: receipt.url || "",
      receiptName: receipt.name || "",
      receiptUploadedAt: dbMod.serverTimestamp()
    });
    return true;
  } catch (err) {
    console.warn("[Firestore] تعذّر تحديث الطلب:", err.code || err.message);
    return false;
  }
}

/* ترجمة أخطاء Firebase إلى رسائل عربية واضحة */
export function friendlyError(err) {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/unauthorized-domain": "النطاق الحالي غير مصرّح به في إعدادات Firebase. أضف النطاق من Authentication ← Settings ← Authorized domains.",
    "auth/operation-not-allowed": "تسجيل الدخول بحساب Google غير مُفعّل. فعّله من Firebase ← Authentication ← Sign-in method.",
    "auth/network-request-failed": "تعذّر الاتصال بالشبكة. تأكد من الإنترنت وأعد المحاولة.",
    "auth/internal-error": "حدث خطأ غير متوقع من خدمة الدخول. أعد المحاولة.",
    "auth/popup-closed-by-user": "أُغلقت نافذة تسجيل الدخول قبل الإكمال.",
    "permission-denied": "قاعدة بيانات الطلبات ترفض الحفظ. راجع قواعد Firestore.",
    "unavailable": "قاعدة البيانات غير متاحة مؤقتاً. أعد المحاولة بعد قليل."
  };
  return map[code] || (err && err.message) || "حدث خطأ غير متوقع. أعد المحاولة.";
}
