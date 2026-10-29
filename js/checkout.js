/* ==========================================================================
   كبش نجد — منطق السلة وإتمام الطلب
   ========================================================================== */

import { product, site, settings } from "./config.js";
import {
  $, $$, initShell, money, num, toast, getCart, setCart, cartTotals,
  updateCartBadge, orderRef, store, escapeHtml, assetPath
} from "./ui.js";
import {
  initFirebase, isConfigured, signInWithGoogle, signOutUser, watchUser,
  currentUser, userProfile, saveCustomer, saveOrder, friendlyError
} from "./firebase.js";

initShell("checkout.html");

let currentUserProfile = null;
let submitting = false;

/* ------------------------------ عناصر الصفحة ----------------------------- */

const els = {
  summary: $("[data-summary]"),
  empty: $("[data-empty-cart]"),
  gate: $("[data-auth-gate]"),
  content: $("[data-checkout-content]"),
  userChip: $("[data-user-chip]"),
  form: $("[data-checkout-form]"),
  payInfo: $("[data-pay-info]"),
  submit: $("[data-submit-order]"),
  maxQty: $("[data-max-qty]")
};

/* ------------------------------ ملخص الطلب ------------------------------- */

function renderSummary() {
  const cart = getCart();
  if (!cart.added || cart.qty < product.minQty) {
    if (els.empty) els.empty.hidden = false;
    if (els.content) els.content.hidden = true;
    if (els.gate) els.gate.hidden = true;
    return;
  }
  if (els.empty) els.empty.hidden = true;
  if (els.content) els.content.hidden = false;

  const t = cartTotals(cart.qty);
  const row = $("[data-summary-body]");
  if (row) {
    row.innerHTML = `
      <div class="line-item">
        <div class="thumb-box"><img src="${assetPath("assets/img/product.webp")}" alt="${escapeHtml(product.nameAr)}" width="96" height="58" loading="lazy" decoding="async"></div>
        <div>
          <h3>${escapeHtml(product.nameAr)}</h3>
          <div class="unit">${money(product.price)} × ${num(cart.qty)}</div>
          <div class="unit muted">الوزن التقريبي: ${escapeHtml(product.weightLabel)}</div>
        </div>
        <div class="line-total"><b>${money(t.subtotal)}</b></div>
      </div>
    `;
  }

  const lines = $("[data-summary-lines]");
  if (lines) {
    lines.innerHTML = `
      <div class="summary-row"><span>الإجمالي الفرعي (${num(t.qty)} × ${money(product.price)})</span><span class="val">${money(t.subtotal)}</span></div>
      <div class="summary-row ${t.delivery === 0 ? "free" : ""}"><span>التوصيل</span><span class="val">${t.delivery === 0 ? "مجاني" : money(t.delivery)}</span></div>
      <div class="summary-row total"><span>الإجمالي المستحق</span><span class="val">${money(t.total)}</span></div>
    `;
  }

  const qtyText = $("[data-summary-qty]");
  if (qtyText) qtyText.textContent = num(t.qty);
}

/* ------------------------------ تعديل العدد ------------------------------ */

function renderQty() {
  const cart = getCart();
  const valEl = $("[data-cart-qty]");
  if (valEl) valEl.textContent = num(cart.qty);
  const minus = $("[data-cart-minus]");
  const plus = $("[data-cart-plus]");
  if (minus) minus.disabled = cart.qty <= product.minQty;
  if (plus) plus.disabled = cart.qty >= product.maxQty;
  const limit = $("[data-cart-limit]");
  if (limit) limit.hidden = cart.qty < product.maxQty;
}

function changeQty(delta) {
  const cart = getCart();
  const next = cart.qty + delta;
  if (next > product.maxQty) { toast(`الحد الأقصى ${num(product.maxQty)} رؤوس لكل عميل.`, "warn"); return; }
  if (next < product.minQty) { return; }
  setCart({ qty: next, added: true });
  renderQty();
  renderSummary();
}

$("[data-cart-minus]")?.addEventListener("click", () => changeQty(-1));
$("[data-cart-plus]")?.addEventListener("click", () => changeQty(1));

/* ------------------------------- الحذف ---------------------------------- */

$("[data-remove-item]")?.addEventListener("click", () => {
  setCart({ qty: product.minQty, added: false });
  updateCartBadge();
  renderQty();
  renderSummary();
  toast("تمت إزالة المنتج من السلة.", "warn");
});

/* ------------------------------ تسجيل الدخول ----------------------------- */

function renderUserChip(profile) {
  if (!els.userChip) return;
  if (!profile) { els.userChip.innerHTML = ""; els.userChip.hidden = true; return; }
  els.userChip.hidden = false;
  els.userChip.innerHTML = `
    <span class="user-chip">
      ${profile.photo ? `<img src="${escapeHtml(profile.photo)}" alt="" width="28" height="28" referrerpolicy="no-referrer">` : `<span aria-hidden="true">👤</span>`}
      <span title="${escapeHtml(profile.email)}">${escapeHtml(profile.name)}</span>
    </span>
    <button type="button" class="btn btn--ghost btn--sm" data-signout>خروج</button>
  `;
  $("[data-signout]", els.userChip)?.addEventListener("click", async () => {
    await signOutUser();
    toast("تم تسجيل الخروج.");
  });
}

function setGate(show, reason = "") {
  if (!els.gate) return;
  els.gate.hidden = !show;
  // لا نُظهر نموذج الطلب قبل تسجيل الدخول لتجنّب أي إرسال غير موثّق
  if (els.content) els.content.hidden = show;
  if (show) {
    const msg = $("[data-gate-reason]", els.gate);
    if (msg && reason) msg.textContent = reason;
  }
}

/* منع إرسال النموذج قبل تسجيل الدخول */
function guardForm() {
  if (settings.requireLoginToOrder && !currentUserProfile) {
    setGate(true, "يجب تسجيل الدخول بحساب Google لإتمام الطلب.");
    els.gate?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("سجّل الدخول بحساب Google أولاً لإتمام الطلب.", "warn");
    return false;
  }
  return true;
}

$("[data-google-signin]")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ تسجيل الدخول...`;
  try {
    const user = await signInWithGoogle();
    if (user) {
      toast(`مرحباً ${user.displayName || user.email}!`);
    }
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), "error", 7000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

async function initAuth() {
  const configured = isConfigured();

  // إغلاق النموذج فوراً عند الحاجة لتسجيل الدخول، قبل انتظار تحميل مكتبات Firebase
  if (settings.requireLoginToOrder) {
    setGate(true, configured
      ? "يجب تسجيل الدخول بحساب Google لإتمام الطلب."
      : "خدمة تسجيل الدخول غير مُفعّلة حالياً. تواصل معنا لإتمام طلبك.");
  }

  if (!configured) {
    if (!settings.requireLoginToOrder) setGate(false);
    return;
  }

  await initFirebase();

  // إكمال نتيجة تحويل Google إن كان العميل عائداً من نافذة/صفحة تسجيل الدخول
  const redirectedUser = await currentUser();
  if (redirectedUser) {
    currentUserProfile = userProfile(redirectedUser);
    renderUserChip(currentUserProfile);
    setGate(false);
    prefillForm(currentUserProfile);
    saveCustomer(currentUserProfile);
  }

  // مراقبة حالة الدخول والخروج بعد ذلك
  watchUser((u) => {
    currentUserProfile = userProfile(u);
    renderUserChip(currentUserProfile);
    if (currentUserProfile) {
      setGate(false);
      prefillForm(currentUserProfile);
      saveCustomer(currentUserProfile);
    } else if (settings.requireLoginToOrder) {
      setGate(true, "يجب تسجيل الدخول بحساب Google لإتمام الطلب.");
    }
  });
  return currentUserProfile;
}

/* ------------------------------ تعبئة النموذج ---------------------------- */

function prefillForm(profile) {
  const nameField = $("[data-field-name]");
  const emailField = $("[data-field-email]");
  if (nameField && !nameField.value) nameField.value = profile.name || "";
  if (emailField && !emailField.value) emailField.value = profile.email || "";
}

/* ------------------------------ التحقق ----------------------------------- */

function setFieldError(input, message) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.toggle("error", Boolean(message));
  const msg = $(".error-msg", field);
  if (msg) msg.textContent = message || "";
}

function validateForm() {
  const form = els.form;
  let firstInvalid = null;

  const checks = [
    { name: "name", test: (v) => v.trim().length >= 3, msg: "الرجاء كتابة الاسم الكامل (3 أحرف على الأقل)." },
    { name: "phone", test: (v) => /^(?:\+?966|0)?5\d{8}$/.test(v.replace(/[\s-]/g, "")), msg: "رقم جوال سعودي غير صحيح. مثال: 0551234567" },
    { name: "city", test: (v) => v.trim().length >= 2, msg: "الرجاء كتابة المدينة." },
    { name: "address", test: (v) => v.trim().length >= 8, msg: "الرجاء كتابة العنوان بالتفصيل (الحي، الشارع، رقم المبنى)." }
  ];

  checks.forEach((c) => {
    const input = form.elements[c.name];
    if (!input) return;
    const ok = c.test(input.value || "");
    setFieldError(input, ok ? "" : c.msg);
    if (!ok && !firstInvalid) firstInvalid = input;
  });

  const payment = form.querySelector('input[name="payment"]:checked');
  const payWrap = $("[data-payment-error]");
  if (payWrap) payWrap.hidden = Boolean(payment);
  if (!payment && !firstInvalid) firstInvalid = form.querySelector('input[name="payment"]');

  const terms = form.elements.terms;
  if (terms && !terms.checked) {
    toast("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.", "warn");
    if (!firstInvalid) firstInvalid = terms;
  }

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    if (firstInvalid.focus) firstInvalid.focus({ preventScroll: true });
    return null;
  }

  return {
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(),
    city: form.elements.city.value.trim(),
    district: (form.elements.district?.value || "").trim(),
    address: form.elements.address.value.trim(),
    notes: (form.elements.notes?.value || "").trim(),
    payment: payment.value
  };
}

/* إزالة رسالة الخطأ عند التصحيح */
$$("[data-checkout-form] input, [data-checkout-form] select, [data-checkout-form] textarea").forEach((input) => {
  input.addEventListener("input", () => {
    if (input.closest(".field")?.classList.contains("error")) setFieldError(input, "");
  });
});

/* ---------------------------- طرق الدفع ---------------------------------- */

$$('input[name="payment"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    $$(".pay-option").forEach((o) => o.classList.toggle("selected", o.contains(radio) && radio.checked));
    $$(".pay-option").forEach((o) => {
      const r = o.querySelector("input");
      o.classList.toggle("selected", r && r.checked);
    });
    const payWrap = $("[data-payment-error]");
    if (payWrap) payWrap.hidden = true;

    const isNow = radio.value === "transfer" && radio.checked;
    if (els.payInfo) {
      els.payInfo.hidden = !isNow;
    }
    const submitLabel = $("[data-submit-label]");
    if (submitLabel && radio.checked) {
      submitLabel.textContent = radio.value === "cash" ? "تأكيد الطلب — الدفع عند الاستلام" : "تأكيد الطلب — سأحوّل الآن";
    }
  });
});

/* --------------------------- إرسال الطلب --------------------------------- */

els.form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return;
  if (!guardForm()) return;

  const data = validateForm();
  if (!data) { toast("راجع الحقول المطلوبة.", "warn"); return; }

  submitting = true;
  const btn = els.submit;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ تأكيد الطلب...`;

  const cart = getCart();
  const t = cartTotals(cart.qty);
  const ref = orderRef();
  const createdAtISO = new Date().toISOString();

  const order = {
    ref,
    uid: currentUserProfile?.uid || null,
    customer: {
      name: data.name,
      email: currentUserProfile?.email || "",
      phone: data.phone,
      city: data.city,
      district: data.district,
      address: data.address,
      notes: data.notes
    },
    items: [{
      id: product.id,
      name: product.nameAr,
      qty: t.qty,
      unitPrice: product.price,
      lineTotal: t.subtotal
    }],
    qty: t.qty,
    unitPrice: product.price,
    subtotal: t.subtotal,
    delivery: t.delivery,
    total: t.total,
    currency: site.currencyCode,
    payment: data.payment,                 // cash | transfer
    status: "pending",
    source: "website"
  };

  const localOrder = { ...order, createdAtISO };

  try {
    let docId = null;
    if (isConfigured()) {
      docId = await saveOrder(order);
      if (!docId && settings.strictDatabase) {
        throw new Error("permission-denied");
      }
    }

    localOrder.docId = docId;
    store.set(`order_${ref}`, localOrder);
    store.set("last_order_ref", ref);
    setCart({ qty: t.qty, added: true });

    if (data.payment === "cash") {
      location.href = `${assetPath("pages/thanks.html")}?ref=${encodeURIComponent(ref)}&pay=cash`;
    } else {
      location.href = `${assetPath("pages/waiting.html")}?ref=${encodeURIComponent(ref)}&pay=transfer`;
    }
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), "error", 8000);
  } finally {
    submitting = false;
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

/* ------------------------------ التشغيل --------------------------------- */

renderQty();
renderSummary();
initAuth();
