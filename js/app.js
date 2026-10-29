/* ==========================================================================
   كبش نجد — منطق الصفحة الرئيسية
   ========================================================================== */

import { product, site } from "./config.js";
import {
  $, $$, initShell, money, num, toast, getCart, setCart, updateCartBadge,
  imageFallback, assetPath
} from "./ui.js";

initShell("index.html");

/* --------------------------- تعبئة بيانات المنتج ------------------------- */

function fillProduct() {
  $$("[data-product-name]").forEach((el) => { el.textContent = product.nameAr; });
  $$("[data-product-short]").forEach((el) => { el.textContent = product.shortAr; });
  $$("[data-price]").forEach((el) => { el.textContent = money(product.price); });
  $$("[data-price-raw]").forEach((el) => { el.textContent = product.price.toLocaleString("ar-SA"); });
  $$("[data-currency]").forEach((el) => { el.textContent = site.currencyAr; });
  $$("[data-weight]").forEach((el) => { el.textContent = product.weightLabel; });
  $$("[data-delivery-time]").forEach((el) => { el.textContent = product.deliveryTimeAr; });
  $$("[data-max-qty]").forEach((el) => { el.textContent = num(product.maxQty); });
  $$("[data-phone]").forEach((el) => { el.textContent = site.phoneDisplay; });
  $$("[data-phone-link]").forEach((el) => { el.href = `tel:${site.phoneIntl}`; });
  $$("[data-whatsapp-link]").forEach((el) => { el.href = `https://wa.me/${site.whatsappIntl}`; });

  const oldEl = $("[data-price-old]");
  if (oldEl) {
    if (product.oldPrice > product.price) {
      oldEl.textContent = money(product.oldPrice);
      oldEl.hidden = false;
      const save = $("[data-save-badge]");
      if (save) {
        save.textContent = `وفّر ${money(product.oldPrice - product.price)}`;
        save.hidden = false;
      }
    } else {
      oldEl.hidden = true;
      const save = $("[data-save-badge]");
      if (save) save.hidden = true;
    }
  }

  const deliveryRow = $("[data-delivery-row]");
  if (deliveryRow) {
    deliveryRow.querySelector(".val").textContent = product.deliveryFee > 0 ? money(product.deliveryFee) : "مجاني";
  }

  const productImgs = $$("[data-product-img]");
  productImgs.forEach((img) => imageFallback(img, assetPath("assets/img/product.png")));
  $$("[data-logo-img]").forEach((img) => imageFallback(img, assetPath("assets/img/logo.png")));
}

/* ----------------------------- اختيار العدد ------------------------------ */

let selectedQty = getCart().qty;

function renderQty() {
  const valEl = $("[data-qty-value]");
  if (valEl) valEl.textContent = num(selectedQty);

  const minus = $("[data-qty-minus]");
  const plus = $("[data-qty-plus]");
  if (minus) minus.disabled = selectedQty <= product.minQty;
  if (plus) plus.disabled = selectedQty >= product.maxQty;

  const limitMsg = $("[data-qty-limit]");
  if (limitMsg) limitMsg.hidden = selectedQty < product.maxQty;

  const totalEl = $("[data-line-total]");
  if (totalEl) totalEl.textContent = money(product.price * selectedQty);
}

function changeQty(delta) {
  const next = selectedQty + delta;
  if (next > product.maxQty) {
    toast(`الحد الأقصى للطلب ${num(product.maxQty)} رؤوس لكل عميل.`, "warn");
    return;
  }
  if (next < product.minQty) return;
  selectedQty = next;
  renderQty();
}

$("[data-qty-minus]")?.addEventListener("click", () => changeQty(-1));
$("[data-qty-plus]")?.addEventListener("click", () => changeQty(1));
renderQty();

/* ------------------------------ طلب الآن -------------------------------- */

function startOrder() {
  setCart({ qty: selectedQty, added: true });
  updateCartBadge();
  location.href = assetPath("pages/checkout.html");
}

$("[data-order-now]")?.addEventListener("click", startOrder);

/* زر "أضف للسلة" — يحفظ العدد ويعرض رسالة دون الانتقال */
$("[data-add-cart]")?.addEventListener("click", () => {
  setCart({ qty: selectedQty, added: true });
  toast(`تمت إضافة ${num(selectedQty)} إلى السلة.`);
  const cartBtn = $(".cart-btn");
  if (cartBtn) cartBtn.scrollIntoView({ behavior: "smooth", block: "center" });
});

/* ---------------------------- معرض الصور -------------------------------- */

$$("[data-thumb]").forEach((thumb) => {
  thumb.addEventListener("click", () => {
    const src = thumb.getAttribute("data-thumb");
    const main = $("[data-main-image]");
    if (main && src) {
      main.src = src;
      $$("[data-thumb]").forEach((t) => t.classList.toggle("active", t === thumb));
    }
  });
});

/* ------------------------------- FAQ ------------------------------------ */

fillProduct();
