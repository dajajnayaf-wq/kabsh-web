/* ==========================================================================
   كبش نجد — عناصر الواجهة المشتركة ومساعدات التخزين
   ========================================================================== */

import { site, product, settings } from "./config.js";

/* ------------------------------- أدوات عامة ------------------------------ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const money = (n) => `${Number(n || 0).toLocaleString("ar-SA")} ${site.currencyAr}`;
export const num = (n) => Number(n || 0).toLocaleString("ar-SA");

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function orderRef() {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KN-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
}

/* التخزين المحلي مع حماية من الأخطاء (وضع التصفح الخاص مثلاً) */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* لا شيء */ } }
};

/* -------------------------------- السلة ---------------------------------- */

export function getCart() {
  const cart = store.get(settings.cartStorageKey, null);
  if (!cart || typeof cart.qty !== "number") return { qty: product.minQty, added: false };
  return { qty: Math.min(Math.max(cart.qty, product.minQty), product.maxQty), added: Boolean(cart.added) };
}

export function setCart(cart) {
  const safe = {
    qty: Math.min(Math.max(Number(cart.qty) || product.minQty, product.minQty), product.maxQty),
    added: Boolean(cart.added)
  };
  store.set(settings.cartStorageKey, safe);
  updateCartBadge();
  return safe;
}

export function cartTotals(qty = getCart().qty) {
  const subtotal = product.price * qty;
  const delivery = product.deliveryFee > 0 ? product.deliveryFee : 0;
  return { qty, subtotal, delivery, total: subtotal + delivery };
}

export function updateCartBadge() {
  const { qty, added } = getCart();
  const show = added ? qty : 0;
  $$("[data-cart-count]").forEach((el) => {
    el.textContent = num(show);
    el.hidden = show === 0;
  });
  $$("[data-cart-label]").forEach((el) => { el.textContent = added ? `السلة (${num(qty)})` : "السلة"; });
}

/* --------------------------- تنبيهات عائمة (Toast) ------------------------ */

let toastWrap = null;
export function toast(message, type = "info", ms = 4200) {
  if (!toastWrap) {
    toastWrap = document.createElement("div");
    toastWrap.className = "toast-wrap";
    toastWrap.setAttribute("role", "status");
    toastWrap.setAttribute("aria-live", "polite");
    document.body.appendChild(toastWrap);
  }
  const el = document.createElement("div");
  el.className = `toast ${type === "warn" ? "warn" : type === "error" ? "err" : ""}`;
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/* ------------------------------- الهيدر ---------------------------------- */

const NAV_LINKS = [
  { href: "index.html", label: "الرئيسية" },
  { href: "index.html#product", label: "المنتج" },
  { href: "pages/order.html", label: "طريقة الطلب" },
  { href: "pages/policy.html", label: "سياسة الخصوصية" },
  { href: "pages/terms.html", label: "الشروط والأحكام" }
];

export function renderHeader(active = "") {
  const host = $("[data-site-header]");
  if (!host) return;
  const current = (active || "").split("#")[0].split("/").pop();
  const links = NAV_LINKS.map((l) => {
    const isActive = current && l.href.split("#")[0].split("/").pop() === current;
    return `<a href="${assetPath(l.href)}"${isActive ? ' aria-current="page" style="background:var(--green-050);color:var(--green-800)"' : ""}>${l.label}</a>`;
  }).join("");

  host.innerHTML = `
    <div class="container">
      <nav class="nav" aria-label="التنقل الرئيسي">
        <a class="brand" href="${assetPath("index.html")}" aria-label="${site.brandAr} — الصفحة الرئيسية">
          <img src="${assetPath("assets/img/logo.webp")}" alt="شعار ${site.brandAr}" width="104" height="42" loading="eager" decoding="async">
          <span class="brand-name">
            <b>${site.brandAr}</b>
            <span>${site.tagline}</span>
          </span>
        </a>

        <div class="nav-links" id="navLinks">${links}</div>

        <div class="nav-actions">
          <a class="cart-btn" href="${assetPath("pages/checkout.html")}" aria-label="عرض السلة">
            🛒 <span data-cart-label>السلة</span>
            <span class="cart-count" data-cart-count hidden>0</span>
          </a>
          <button class="menu-toggle" type="button" aria-label="فتح القائمة" aria-expanded="false" aria-controls="navLinks">☰</button>
        </div>
      </nav>
    </div>
  `;

  const toggle = $(".menu-toggle", host);
  const menu = $("#navLinks", host);
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "✕" : "☰";
  });
}

/* ------------------------------- الفوتر ---------------------------------- */

export function renderFooter() {
  const host = $("[data-site-footer]");
  if (!host) return;
  const socials = [
    ["snapchat", "سناب شات", "👻"],
    ["instagram", "إنستغرام", "📸"],
    ["tiktok", "تيك توك", "🎵"],
    ["x", "منصة X", "𝕏"]
  ].filter(([key]) => site[key]);

  const socialHtml = socials.length
    ? `<h4>تابعنا</h4>${socials.map(([key, label, icon]) => `<a href="${site[key]}" target="_blank" rel="noopener noreferrer">${icon} ${label}</a>`).join("")}`
    : `<h4>تواصل معنا</h4><a href="mailto:${site.email}">✉️ ${site.email}</a><a href="tel:${site.phoneIntl}">📞 ${site.phoneDisplay}</a>`;

  host.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <img src="${assetPath("assets/img/logo.webp")}" alt="شعار ${site.brandAr}" width="132" height="44" loading="lazy" decoding="async">
            <span><b>${site.brandAr}</b><span>${site.brandEn}</span></span>
          </div>
          <p class="footer-about">${site.tagline} — ذبح حلال وتوصيل مبرد، نلتزم بأعلى معايير الجودة وخدمة عملائنا في ${site.country}.</p>
        </div>

        <div>
          <h4>روابط سريعة</h4>
          <a href="${assetPath("index.html")}">الرئيسية</a>
          <a href="${assetPath("index.html#product")}">تفاصيل المنتج</a>
          <a href="${assetPath("pages/order.html")}">طريقة الطلب</a>
          <a href="${assetPath("pages/checkout.html")}">إتمام الطلب</a>
        </div>

        <div>
          <h4>السياسات</h4>
          <a href="${assetPath("pages/policy.html")}">سياسة الخصوصية</a>
          <a href="${assetPath("pages/terms.html")}">الشروط والأحكام</a>
          <a href="${assetPath("pages/policy.html#refund")}">سياسة الاستبدال والاسترجاع</a>
          <a href="${assetPath("pages/policy.html#shipping")}">سياسة الشحن والتوصيل</a>
        </div>

        <div>${socialHtml}</div>
      </div>

      <div class="footer-bottom">
        <span>© <span data-year>${new Date().getFullYear()}</span> ${site.brandAr} — جميع الحقوق محفوظة.</span>
        <span class="pay"><span>الدفع عند الاستلام</span><span>تحويل بنكي</span><span>واتساب</span></span>
      </div>
    </div>
  `;
}

/* --------------------------- مسارات الأصول ------------------------------- */

/* يحسب المسار الصحيح للأصول سواء كانت الصفحة في الجذر أو داخل مجلد pages */
export function assetPath(path) {
  const inPages = location.pathname.replace(/\\/g, "/").includes("/pages/");
  if (!inPages) return path;
  return path.startsWith("pages/") ? path.replace("pages/", "") : `../${path}`;
}

/* ------------------------------ تهيئة عامة ------------------------------- */

export function initShell(activePage = "") {
  renderHeader(activePage);
  renderFooter();
  updateCartBadge();
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  window.addEventListener("storage", (e) => {
    if (e.key === settings.cartStorageKey) updateCartBadge();
  });
}

/* بناء رابط واتساب جاهز */
export function whatsappLink(message) {
  return `https://wa.me/${site.whatsappIntl}?text=${encodeURIComponent(message)}`;
}

/* تحميل الصور مع بديل عند الفشل */
export function imageFallback(img, fallbackSrc) {
  img.addEventListener("error", () => { img.src = fallbackSrc; }, { once: true });
}
