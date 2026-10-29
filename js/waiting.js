/* ==========================================================================
   كبش نجد — صفحة انتظار تحويل المبلغ وإرفاق وصل التحويل
   ========================================================================== */

import { site, product, settings } from "./config.js";
import {
  $, $$, initShell, money, store, toast, escapeHtml, assetPath,
  whatsappLink, setCart
} from "./ui.js";
import { isConfigured, uploadReceipt, markReceiptAttached, friendlyError } from "./firebase.js";

initShell("waiting.html");

const params = new URLSearchParams(location.search);
const ref = params.get("ref") || store.get("last_order_ref", "");
const orderKey = `order_${ref}`;
const order = ref ? store.get(orderKey, null) : null;

/* --------------------------- بيانات التحويل ------------------------------ */

$$("[data-order-ref]").forEach((el) => { el.textContent = ref || "—"; });
$$("[data-iban]").forEach((el) => { el.textContent = site.iban; });
$$("[data-bank]").forEach((el) => { el.textContent = site.bankName; });
$$("[data-amount]").forEach((el) => { el.textContent = order ? money(order.total) : money(product.price); });
$$("[data-brand]").forEach((el) => { el.textContent = site.brandAr; });

/* نسخ الآيبان */
$("[data-copy-iban]")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(site.iban);
    toast("تم نسخ رقم الآيبان.");
  } catch {
    toast("تعذّر النسخ تلقائياً، انسخ الآيبان يدوياً.", "warn");
  }
});

/* نسخ رقم الطلب */
$("[data-copy-ref]")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(ref);
    toast("تم نسخ رقم الطلب.");
  } catch {
    toast("تعذّر النسخ تلقائياً.", "warn");
  }
});

/* رابط واتساب لإرسال الوصل */
function refreshWhatsapp() {
  const msg = `مرحباً ${site.brandAr}،\nتم تحويل مبلغ الطلب رقم: ${ref}\nالمبلغ: ${order ? order.total : product.price} ${site.currencyAr}\nمرفق صورة وصل التحويل لتأكيد الطلب.`;
  $$("[data-whatsapp-link]").forEach((el) => { el.href = whatsappLink(msg); });
}
refreshWhatsapp();

/* --------------------------- ضغط صور الوصل ------------------------------- */

async function compressImage(file) {
  const maxBytes = settings.receiptMaxKB * 1024;
  if (file.size <= maxBytes || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], (file.name || "receipt").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/* ------------------------------ عناصر الرفع ------------------------------ */

const zone = $("[data-upload-zone]");
const fileInput = $("[data-receipt-input]");
const preview = $("[data-upload-preview]");
const confirmBtn = $("[data-confirm-transfer]");
let selectedFile = null;

function showPreview(file) {
  selectedFile = file;
  if (!preview) return;
  const url = URL.createObjectURL(file);
  preview.hidden = false;
  preview.innerHTML = `
    <img src="${url}" alt="معاينة وصل التحويل">
    <div>
      <b>${escapeHtml(file.name)}</b><br>
      <span class="muted">${(file.size / 1024).toFixed(0)} كيلوبايت</span>
    </div>
    <button type="button" class="btn btn--ghost btn--sm" data-remove-file>إزالة</button>
  `;
  $("[data-remove-file]", preview)?.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    preview.hidden = true;
    confirmBtn.disabled = true;
  });
  confirmBtn.disabled = false;
  toast("تم إرفاق وصل التحويل. اضغط «تأكيد التحويل».");
}

function handleFiles(files) {
  const file = files && files[0];
  if (!file) return;
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    toast("الرجاء إرفاق صورة أو ملف PDF لوصل التحويل.", "warn");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast("حجم الملف كبير جداً (الحد 8 ميجابايت).", "warn");
    return;
  }
  compressImage(file).then(showPreview);
}

zone?.addEventListener("click", () => fileInput?.click());
zone?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput?.click(); }
});
fileInput?.addEventListener("change", (e) => handleFiles(e.target.files));
["dragenter", "dragover"].forEach((ev) => zone?.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("dragover"); }));
["dragleave", "drop"].forEach((ev) => zone?.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("dragover"); }));
zone?.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

/* --------------------------- تأكيد التحويل ------------------------------- */

confirmBtn?.addEventListener("click", async () => {
  if (!selectedFile) { toast("أرفق صورة وصل التحويل أولاً.", "warn"); return; }

  const original = confirmBtn.innerHTML;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<span class="spinner"></span> جارٍ رفع الوصل...`;

  try {
    let receiptUrl = "";
    let uploaded = false;

    if (isConfigured()) {
      const url = await uploadReceipt(selectedFile, ref);
      if (url) { receiptUrl = url; uploaded = true; }
    }

    // حفظ محلي دائماً (يضمن استمرار العميل حتى لو تعذّر الرفع السحابي)
    if (order) {
      order.receipt = {
        name: selectedFile.name,
        url: receiptUrl,
        uploaded,
        attachedAt: new Date().toISOString()
      };
      order.status = "receipt_attached";
      store.set(orderKey, order);
    }
    store.set(`receipt_${ref}`, { name: selectedFile.name, url: receiptUrl, uploaded });

    if (isConfigured() && order?.docId) {
      await markReceiptAttached(order.docId, { name: selectedFile.name, url: receiptUrl });
    }

    setCart({ qty: product.minQty, added: false });

    if (!uploaded && isConfigured()) {
      toast("تم تسجيل الوصل محلياً، وسنؤكده عند وصوله عبر واتساب.", "warn", 6000);
    }

    location.href = `${assetPath("pages/thanks.html")}?ref=${encodeURIComponent(ref)}&pay=transfer&receipt=1`;
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), "error", 8000);
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = original;
  }
});

/* --------------------------- معلومات إضافية ----------------------------- */

$$("[data-phone]").forEach((el) => { el.textContent = site.phoneDisplay; });
$$("[data-phone-link]").forEach((el) => { el.href = `tel:${site.phoneIntl}`; });
