/* ==========================================================================
   كبش نجد — صفحة الشكر وتأكيد الطلب
   ========================================================================== */

import { site, product } from "./config.js";
import { $, $$, initShell, money, num, store, escapeHtml, whatsappLink, setCart } from "./ui.js";

initShell("thanks.html");

const params = new URLSearchParams(location.search);
const ref = params.get("ref") || store.get("last_order_ref", "");
const pay = params.get("pay") || "";
const order = ref ? store.get(`order_${ref}`, null) : null;

/* عرض رقم الطلب */
$$("[data-order-ref]").forEach((el) => { el.textContent = ref || "—"; });

/* طريقة الدفع */
const payLabel = pay === "transfer" || order?.payment === "transfer" ? "تحويل بنكي" : "الدفع عند الاستلام";
$$("[data-pay-method]").forEach((el) => { el.textContent = payLabel; });

/* تفاصيل الطلب */
const box = $("[data-order-details]");
if (box && order) {
  const c = order.customer || {};
  box.innerHTML = `
    <div class="row"><b>رقم الطلب</b><span class="order-ref">${escapeHtml(order.ref)}</span></div>
    <div class="row"><b>المنتج</b><span>${escapeHtml(order.items?.[0]?.name || product.nameAr)}</span></div>
    <div class="row"><b>العدد</b><span>${num(order.qty)}</span></div>
    <div class="row"><b>الإجمالي</b><span>${money(order.total)}</span></div>
    <div class="row"><b>الاسم</b><span>${escapeHtml(c.name || "—")}</span></div>
    <div class="row"><b>الجوال</b><span dir="ltr">${escapeHtml(c.phone || "—")}</span></div>
    <div class="row"><b>المدينة</b><span>${escapeHtml(c.city || "—")}${c.district ? " — " + escapeHtml(c.district) : ""}</span></div>
    <div class="row"><b>العنوان</b><span>${escapeHtml(c.address || "—")}</span></div>
    <div class="row"><b>طريقة الدفع</b><span>${escapeHtml(payLabel)}</span></div>
  `;
} else if (box) {
  box.innerHTML = `<div class="row"><b>ملاحظة</b><span>لا تتوفر تفاصيل محفوظة لهذا الطلب في هذا المتصفح. تواصل معنا مع رقم الطلب أعلاه.</span></div>`;
}

/* رابط واتساب للتأكيد */
const waMsg = `مرحباً ${site.brandAr}، أؤكد طلبي رقم ${ref || ""} (${payLabel}).`;
$$("[data-whatsapp-link]").forEach((el) => { el.href = whatsappLink(waMsg); });
$$("[data-phone]").forEach((el) => { el.textContent = site.phoneDisplay; });
$$("[data-phone-link]").forEach((el) => { el.href = `tel:${site.phoneIntl}`; });
$$("[data-email]").forEach((el) => { el.textContent = site.email; });

/* تفريغ السلة بعد نجاح الطلب */
if (order) {
  setCart({ qty: product.minQty, added: false });
}

/* إخفاء قسم التحويل إذا كان الدفع نقداً */
if (payLabel === "الدفع عند الاستلام") {
  $$("[data-transfer-note]").forEach((el) => { el.hidden = true; });
}
