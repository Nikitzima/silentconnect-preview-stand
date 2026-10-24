/* =========================================================================
   SilentConnect Redesign v2 — Полная экосистема (1:1 с боевым сайтом):
   - Liquid Glass Segmented Controls с пружинной физикой перетаскивания (lift/drag/squash)
   - Анимированный пересчёт цифр (requestAnimationFrame) + Spotlight (.spot)
   - Интуитивная зона финальной цены (Итого к оплате + Старая цена + % скидки + ₽/мес + Выгода)
   - Автоскрытие мобильной панели .mbar при видимости #checkout
   - Полный блок FAQ + Все 5 экранов + Все модалки + Command Palette (⌘K)
   ========================================================================= */

(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));

const SUB_ID = 'sc_live_88f29a1d';
const SUB_IMPORT_URL = `https://sub.silentconnect.net/my-secret-sub/import/${SUB_ID}`;
const IMPORT_BASE = 'https://sub.silentconnect.net/my-secret-sub/import';
const importUrlFor = app => `${IMPORT_BASE}/${app}/${SUB_ID}`;

/* ---------- Всплывающие уведомления (Toast) ---------- */
let toastTimer = null;
function toast(msg, duration = 3000) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}
window.toast = toast;

/* ---------- Копирование в буфер обмена ---------- */
function copyToClipboard(text, successMsg = 'Скопировано в буфер обмена') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => toast(successMsg))
      .catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}
window.copyToClipboard = copyToClipboard;

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    toast(successMsg);
  } catch (err) {
    toast('Не удалось скопировать. Скопируйте вручную.');
  }
  document.body.removeChild(ta);
}

/* Обработка глобальных кликов по [data-copy-url], [data-toast], .cf-widget */
document.addEventListener('click', e => {
  const copyBtn = e.target.closest('[data-copy-url]');
  if (copyBtn) {
    e.preventDefault();
    copyToClipboard(copyBtn.dataset.copyUrl, 'Ссылка подписки скопирована!');
    return;
  }
  const toastBtn = e.target.closest('[data-toast]');
  if (toastBtn) {
    const row = toastBtn.closest('.copy-row');
    const inp = row ? $('input', row) : null;
    if (inp && inp.value) copyToClipboard(inp.value, toastBtn.dataset.toast);
    else toast(toastBtn.dataset.toast);
  }
  const cf = e.target.closest('.cf-widget');
  if (cf) {
    const cur = cf.getAttribute('data-checked') === 'true';
    cf.setAttribute('data-checked', String(!cur));
    cf.setAttribute('aria-checked', String(!cur));
  }
});

/* ---------- Spotlight (.spot) курсорное свечение на ПК ---------- */
if (window.matchMedia('(pointer: fine)').matches) {
  document.addEventListener('pointermove', e => {
    const card = e.target.closest && e.target.closest('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}

/* ---------- Генератор SVG QR-кода ---------- */
function renderSvgQr(text, containerEl, size = 164) {
  if (!containerEl) return;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
  const dim = 25;
  const cellSize = size / dim;
  let paths = '';

  function drawFinder(ox, oy) {
    paths += `<rect x="${ox * cellSize}" y="${oy * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#fff" rx="3"/>`;
    paths += `<rect x="${(ox + 1) * cellSize}" y="${(oy + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#080e0c"/>`;
    paths += `<rect x="${(ox + 2) * cellSize}" y="${(oy + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#34e3a4" rx="2"/>`;
  }
  drawFinder(1, 1);
  drawFinder(dim - 8, 1);
  drawFinder(1, dim - 8);

  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if ((r < 9 && c < 9) || (r < 9 && c >= dim - 9) || (r >= dim - 9 && c < 9)) continue;
      const bit = ((hash ^ (r * 31 + c * 17)) & (1 << ((r + c) % 8))) !== 0;
      if (bit) {
        paths += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize * 0.9}" height="${cellSize * 0.9}" fill="#34e3a4" rx="1.5" opacity="0.9"/>`;
      }
    }
  }

  containerEl.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto">${paths}</svg>`;
}

/* ---------- Навигация & Автоскрытие нижней панели .mbar у чекаута ---------- */
const navEl = $('#nav');
function syncNavScroll() {
  if (navEl) navEl.classList.toggle('solid', window.scrollY > 16);
}
window.addEventListener('scroll', syncNavScroll, { passive: true });
syncNavScroll();

const mbarEl = $('#mbar');
const checkoutEl = $('#checkout');
if (mbarEl && checkoutEl && 'IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    mbarEl.classList.toggle('hide-bar', entries[0].isIntersecting);
  }, { threshold: 0.12 }).observe(checkoutEl);
}

/* ---------- Drag-to-scroll для горизонтальных вкладок ---------- */
function setupDraggableTrack(track) {
  if (!track || track._dragInit) return;
  track._dragInit = true;
  let isDown = false, startX = 0, scrollLeft = 0, moved = false;
  track.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
    moved = false;
  });
  window.addEventListener('mouseup', () => { isDown = false; });
  track.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 4) moved = true;
    track.scrollLeft = scrollLeft - walk;
  });
  track.addEventListener('click', e => {
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

function centerActiveTab(track) {
  if (!track) return;
  const act = track.querySelector('.active') || track.querySelector('.on');
  if (act && track.scrollWidth > track.clientWidth) {
    track.scrollTo({ left: act.offsetLeft - (track.clientWidth - act.offsetWidth) / 2, behavior: 'smooth' });
  }
}

/* =========================================================================
   1. ПЛАТФОРМЫ И АВТООПРЕДЕЛЕНИЕ (subjson-service/app.py)
   ========================================================================= */
const OS_META = (window.SC_OS && window.SC_OS.length) ? window.SC_OS : [
  { id: 'ios', label: 'iOS', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.36-.57.65-1.07 1.72-.94 2.74 1.01.08 2.04-.5 2.66-1.25z"/></svg>' },
  { id: 'android', label: 'Android', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.52 15.34c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m-11.04 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m11.4-6.02l2-3.46c.12-.2.05-.47-.15-.57-.2-.12-.47-.05-.57.15l-2.02 3.5C15.59 8.41 13.85 8.08 12 8.08s-3.59.33-5.14.87L4.84 5.45c-.1-.2-.37-.27-.57-.15-.2.1-.27.37-.15.57l2 3.46C2.69 11.19.34 14.66 0 18.76h24c-.34-4.1-2.69-7.57-6.12-9.44"/></svg>' },
  { id: 'windows', label: 'Windows', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M0 3.45L9.75 2.1v9.45H0m10.95-9.6L24 0v11.4H10.95M0 12.6h9.75v9.45L0 20.7M10.95 12.6H24V24l-13.05-1.8"/></svg>' },
  { id: 'macos', label: 'macOS', svg: '<svg viewBox="0 0 512 512" width="18" height="18"><rect width="512" height="512" fill="#dbe9f4" rx="85"/><path fill="#1e73f2" d="m0 0h262q-65 162-64 286c0 7 6 13 13 13h64q-6 113 28 213H0z"/></svg>' },
  { id: 'linux', label: 'Linux', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>' },
  { id: 'androidtv', label: 'Android TV', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 3H2c-.6 0-1 .4-1 1v13c0 .6.4 1 1 1h8v1.5H7c-.3 0-.5.2-.5.5s.2.5.5.5h10c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-3V18h8c.6 0 1-.4 1-1V4c0-.6-.4-1-1-1zm-.2 13.8H2.2V4.2h19.6v12.6z"/></svg>' },
  { id: 'appletv', label: 'Apple TV', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 3H2c-.6 0-1 .4-1 1v13c0 .6.4 1 1 1h8v1.5H7c-.3 0-.5.2-.5.5s.2.5.5.5h10c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-3V18h8c.6 0 1-.4 1-1V4c0-.6-.4-1-1-1zm-.2 13.8H2.2V4.2h19.6v12.6z"/></svg>' }
];
const OS_LABEL = {};
OS_META.forEach(o => { OS_LABEL[o.id] = o.label; });

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const pf = navigator.platform || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return /TV|AFT|BRAVIA|SMART-TV/i.test(ua) ? 'androidtv' : 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(pf)) return 'macos';
  if (/Linux/i.test(pf)) return 'linux';
  return 'windows';
}
const detectedOs = detectPlatform();
['detectedOsMain', 'detectedOsAwg', 'detectedOsOf'].forEach(id => {
  const el = $('#' + id);
  if (el) el.textContent = OS_LABEL[detectedOs] || detectedOs;
});

/* =========================================================================
   2. ТАРИФНЫЙ КАЛЬКУЛЯТОР И ОФОРМЛЕНИЕ ЗАКАЗА (vpn_shop/catalog.py)
   ========================================================================= */
const CFG = {
  names:  { 3: 'Личный', 6: 'Домашний', 9: 'Расширенный' },
  awg:    { 3: 250, 6: 500, 9: 1000 },
  prices: { 3: { 1: 149, 3: 399, 6: 719, 12: 1249 },
            6: { 1: 199, 3: 539, 6: 959, 12: 1669 },
            9: { 1: 239, 3: 629, 6: 1129, 12: 1969 } },
  label:  { 1: '1 мес', 3: '3 мес', 6: '6 мес', 12: '12 мес' },
  full:   { 1: '1 месяц', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев' },
  days:   { 1: 30, 3: 90, 6: 180, 12: 360 }
};

const refParam = new URLSearchParams(location.search).get('ref') || '';
const S = {
  dev: 3, months: 6, promo: '', promoType: null, promoPct: 0,
  refPct: refParam.startsWith('ref_') ? 10 : 0,
  renDev: 6, renMonths: 6, emailBound: true, bindOnly: false,
  subMode: 'main',
  osMain: detectedOs, appMain: 'happ',
  osAwg: (detectedOs === 'appletv' || detectedOs === 'androidtv') ? 'windows' : detectedOs, appAwg: 'amneziavpn',
  osOf: (detectedOs === 'androidtv' || detectedOs === 'appletv') ? 'ios' : detectedOs,
  ofState: 'active', ofCountry: 'nl', ofTargetCountry: 'pl',
  awgTargetSlot: 1
};

if (S.refPct > 0 && $('#refBanner')) $('#refBanner').hidden = false;
if ($('#refClear')) {
  $('#refClear').addEventListener('click', () => {
    S.refPct = 0;
    if ($('#refBanner')) $('#refBanner').hidden = true;
    renderCatalog();
    toast('Реферальная скидка сброшена');
  });
}

/* Плавный анимированный счётчик цифр */
const numReg = new WeakMap();
function num(el, target, suffix = '', dur = 380) {
  if (!el) return;
  let r = numReg.get(el);
  if (!r) {
    numReg.set(el, { v: target, raf: 0 });
    el.textContent = fmt(target) + suffix;
    return;
  }
  cancelAnimationFrame(r.raf);
  const from = r.v;
  if (Math.round(from) === Math.round(target)) {
    r.v = target;
    el.textContent = fmt(target) + suffix;
    return;
  }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    r.v = from + (target - from) * e;
    el.textContent = fmt(r.v) + suffix;
    if (k < 1) r.raf = requestAnimationFrame(step);
  };
  r.raf = requestAnimationFrame(step);
}

function calc(dev, m) {
  const base = CFG.prices[dev][1] * m;
  const cat  = CFG.prices[dev][m];
  const extra = Math.max(S.promoPct, S.refPct);
  const total = S.promoType === 'gift' ? 0 : Math.floor(cat * (100 - extra) / 100);
  return {
    base,
    total,
    per: Math.round(total / m),
    saved: Math.max(base - total, 0),
    pct: base ? Math.round((1 - total / base) * 100) : 0,
    catPct: Math.round((1 - cat / base) * 100)
  };
}

/* Генерация плиток сроков в #tiles */
const tilesEl = $('#tiles');
if (tilesEl) {
  tilesEl.innerHTML = '';
  [1, 3, 6, 12].forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('role', 'radio');
    b.dataset.m = String(m);
    b.innerHTML = `
      <div class="tile-top"><span class="tile-name">${CFG.label[m]}</span><span class="save" hidden></span></div>
      <div class="tile-price"><b class="tab t-per">0</b><span>₽/мес</span></div>
      <div class="tile-total"><b class="tab t-tot">0</b> ₽ всего</div>`;
    b.addEventListener('click', () => {
      S.months = m;
      renderCatalog();
    });
    tilesEl.appendChild(b);
  });
}

/* Универсальная пружинная физика перетаскивания для Liquid Glass Segmented Control */
function bindLiquidSegmented(segEl, getIndexFn, onSelectIdxFn) {
  if (!segEl) return () => {};
  const btns = $$('.seg-btn', segEl);
  let squashTimer = null;
  let down = null;

  function setVisual(index, squash = true) {
    segEl.style.setProperty('--i', index);
    btns.forEach((b, k) => b.setAttribute('aria-checked', String(k === index)));
    if (squash) {
      segEl.classList.add('squash');
      clearTimeout(squashTimer);
      squashTimer = setTimeout(() => segEl.classList.remove('squash'), 220);
    }
  }

  const slotW = () => (segEl.clientWidth - 10) / 3;

  segEl.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    down = { x: e.clientX, i: getIndexFn(), moved: false, id: e.pointerId, dx: 0 };
    segEl.classList.add('lift');
  });

  segEl.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.abs(dx) > 5) {
      down.moved = true;
      segEl.classList.add('drag');
      if (segEl.setPointerCapture) {
        try { segEl.setPointerCapture(down.id); } catch (_) {}
      }
    }
    if (!down.moved) return;
    const base = down.i * slotW();
    const target = Math.min(Math.max(base + dx, 0), 2 * slotW());
    down.dx = target - base;
    segEl.style.setProperty('--dx', down.dx + 'px');
  });

  const endDrag = e => {
    if (!down) return;
    const d = down;
    down = null;
    segEl.classList.remove('lift', 'drag');
    let idx = d.i;
    if (d.moved) {
      idx = Math.round((d.i * slotW() + d.dx) / slotW());
    } else if (e && e.target && e.target.closest) {
      const b = e.target.closest('.seg-btn');
      if (b) idx = btns.indexOf(b);
    }
    idx = Math.min(2, Math.max(0, idx));
    segEl.style.setProperty('--dx', '0px');
    onSelectIdxFn(idx);
  };

  segEl.addEventListener('pointerup', endDrag);
  segEl.addEventListener('pointercancel', () => {
    down = null;
    segEl.classList.remove('lift', 'drag');
    segEl.style.setProperty('--dx', '0px');
  });

  btns.forEach((b, k) => b.addEventListener('click', () => onSelectIdxFn(k)));
  return setVisual;
}

const DEVS = [3, 6, 9];
const setDevSeg = bindLiquidSegmented(
  $('#devSeg'),
  () => DEVS.indexOf(S.dev),
  idx => {
    const next = DEVS[idx];
    const changed = next !== S.dev;
    S.dev = next;
    setDevSeg(idx, changed);
    renderCatalog();
  }
);

/* Отрисовка витрины и понятной зоны финальной цены */
function renderCatalog() {
  const plan = CFG.names[S.dev];
  const cur = calc(S.dev, S.months);
  const devIdx = DEVS.indexOf(S.dev);
  setDevSeg(devIdx >= 0 ? devIdx : 0, false);

  if (tilesEl) {
    $$('.tile', tilesEl).forEach(t => {
      const m = Number(t.dataset.m);
      const c = calc(S.dev, m);
      t.setAttribute('aria-checked', String(m === S.months));
      num($('.t-per', t), c.per);
      num($('.t-tot', t), c.total);
      const sv = $('.save', t);
      if (sv) {
        if (c.catPct > 0) { sv.hidden = false; sv.textContent = `−${c.catPct}%`; }
        else { sv.hidden = true; }
      }
    });
  }

  num($('#awgQ'), CFG.awg[S.dev], ' ГБ');

  const coPlan = $('#coPlan');
  if (coPlan) coPlan.textContent = `Тариф «${plan}» · ${CFG.full[S.months]}`;

  const coPctBadge = $('#coPctBadge');
  if (coPctBadge) {
    coPctBadge.hidden = cur.pct <= 0;
    coPctBadge.textContent = S.promoType === 'gift' ? 'ПОДАРОК −100%' : `−${cur.pct}%`;
  }

  num($('#coPrice'), cur.total);

  const coOld = $('#coOld');
  if (coOld) {
    coOld.textContent = cur.saved > 0 ? `${fmt(cur.base)} ₽` : '';
    coOld.hidden = cur.saved <= 0;
  }

  const coMonth = $('#coMonth');
  if (coMonth) {
    coMonth.textContent = S.promoType === 'gift' ? '0 ₽ / мес (сертификат)' : `${fmt(cur.per)} ₽ / мес`;
  }

  const coSaveRow = $('#coSaveRow');
  const coSave = $('#coSave');
  if (coSave) {
    let note = '';
    if (S.promoType === 'gift') note = `бесплатно по коду (${fmt(cur.base)} ₽)`;
    else if (S.promoPct > 0) note = `экономия ${fmt(cur.saved)} ₽ (промокод −${S.promoPct}%)`;
    else if (S.refPct > 0) note = `экономия ${fmt(cur.saved)} ₽ (приглашение −${S.refPct}%)`;
    else if (cur.saved > 0) note = `экономия ${fmt(cur.saved)} ₽`;
    coSave.textContent = note;
    if (coSaveRow) coSaveRow.hidden = !note;
  }

  const fOffer = $('#fOffer');
  if (fOffer) fOffer.value = `tcp_${S.dev}_${CFG.days[S.months]}`;

  const mbPlan = $('#mbPlan');
  if (mbPlan) mbPlan.textContent = `${plan} · ${CFG.label[S.months]}`;
  const mbPrice = $('#mbPrice');
  if (mbPrice) mbPrice.textContent = `${fmt(cur.total)} ₽`;
}
window.renderCatalog = renderCatalog;

/* Промокоды */
const promoToggle = $('#promoToggle');
const promoBox = $('#promoBox');
const promoCaret = $('#promoCaret');
if (promoToggle && promoBox) {
  promoToggle.addEventListener('click', () => {
    const isHidden = promoBox.hidden;
    promoBox.hidden = !isHidden;
    promoToggle.setAttribute('aria-expanded', String(isHidden));
    if (promoCaret) promoCaret.style.transform = isHidden ? 'rotate(180deg)' : '';
    if (isHidden) {
      const pInput = $('#promo');
      if (pInput) setTimeout(() => pInput.focus(), 60);
    }
  });
}

const promoInput = $('#promo');
const promoApplyBtn = $('#promoApply');
const promoMsg = $('#promoMsg');

function applyPromo() {
  if (!promoInput) return;
  const code = promoInput.value.trim().toUpperCase();
  if (!code) {
    S.promo = ''; S.promoPct = 0; S.promoType = null;
    if (promoMsg) { promoMsg.className = 'promo-msg'; promoMsg.textContent = 'Примеры для теста: WELCOME10, SALE20 или подарочный GIFT30.'; }
    renderCatalog();
    return;
  }
  if (code === 'WELCOME10' || code === 'TEST10') {
    S.promo = code; S.promoPct = 10; S.promoType = 'pct';
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = `✓ Промокод ${code} применён (−10%)`; }
    toast(`Промокод ${code} применён!`);
  } else if (code === 'SALE20' || code === 'START') {
    S.promo = code; S.promoPct = 20; S.promoType = 'pct';
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = `✓ Промокод ${code} применён (−20%)`; }
    toast(`Промокод ${code} применён!`);
  } else if (code === 'GIFT30' || code === 'FREE') {
    S.promo = code; S.promoPct = 100; S.promoType = 'gift';
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = '✓ Подарочный сертификат активирован (100% скидка)'; }
    toast('Подарочный сертификат применён!');
  } else {
    S.promo = ''; S.promoPct = 0; S.promoType = null;
    if (promoMsg) { promoMsg.className = 'promo-msg err'; promoMsg.textContent = '✕ Промокод не найден или устарел'; }
    toast('Промокод не найден');
  }
  renderCatalog();
}
if (promoApplyBtn) promoApplyBtn.addEventListener('click', applyPromo);
if (promoInput) promoInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });

renderCatalog();

/* =========================================================================
   3. FAQ (Заполнение и интерактивный аккордеон)
   ========================================================================= */
const FAQ_DATA = [
  {
    q: 'Как быстро я получу доступ после оплаты?',
    a: 'Сразу после подтверждения платежа (обычно 5–15 секунд) откроется мастер настройки с вашей персональной ссылкой, а копия ссылки и чек придут на указанный Email.'
  },
  {
    q: 'Есть ли ограничения по трафику и скорости?',
    a: 'В основном профиле трафик и скорость полностью безлимитны. Для дополнительного игрового контура AmneziaWG (прямой UDP) выделяется пакет 250, 500 или 1 000 ГБ в месяц в зависимости от тарифа (обновляется каждого 1-го числа).'
  },
  {
    q: 'На каких устройствах это работает?',
    a: 'На телефонах и планшетах iOS и Android, компьютерах Windows, macOS и Linux, а также на телевизорах и приставках Android TV и Apple TV. Страница подписки сама определит ваше устройство и предложит проверенный клиент.'
  },
  {
    q: 'Нужно ли перенастраивать устройства при продлении?',
    a: 'Нет. Ваша ссылка подписки постоянная: при продлении срока или переходе на другой тариф все добавленные устройства продолжают работать автоматически.'
  },
  {
    q: 'Что делать, если мобильный оператор ограничивает связь?',
    a: 'В мастере настройки вашей подписки предусмотрен специальный резервный контур для работы в условиях жёстких ограничений мобильного интернета.'
  },
  {
    q: 'Как работает возврат средств в течение 14 дней?',
    a: 'Если на вашем устройстве или провайдере сервис не подошёл и поддержка не смогла решить вопрос, напишите в @SilentConnectSupport в течение 14 дней после первого заказа — мы вернём средства.'
  }
];

const faqListEl = $('#faqList');
if (faqListEl) {
  faqListEl.innerHTML = FAQ_DATA.map((item, idx) => `
    <div class="faq" data-open="${idx === 0 ? 'true' : 'false'}">
      <button type="button" class="faq-q" aria-expanded="${idx === 0 ? 'true' : 'false'}">
        <span>${item.q}</span>
        <i aria-hidden="true">+</i>
      </button>
      <div class="faq-a"><div><p>${item.a}</p></div></div>
    </div>
  `).join('');

  faqListEl.addEventListener('click', e => {
    const btn = e.target.closest('.faq-q');
    if (!btn) return;
    const faq = btn.closest('.faq');
    if (!faq) return;
    const isOpen = faq.getAttribute('data-open') === 'true';
    $$('.faq', faqListEl).forEach(f => {
      f.setAttribute('data-open', 'false');
      const q = $('.faq-q', f);
      if (q) q.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      faq.setAttribute('data-open', 'true');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}

/* =========================================================================
   4. РОУТИНГ СТРАНИЦ / ЭКРАНОВ И СТРАНИЦА ЗАКАЗА
   ========================================================================= */
const VIEWS = ['landing', 'order', 'sub', 'cabinet', 'legal'];
function view(name, hash) {
  if (!VIEWS.includes(name)) name = 'landing';
  VIEWS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.hidden = v !== name;
  });
  $$('[data-page-tab]').forEach(b => b.classList.toggle('on', b.dataset.pageTab === name));
  if (mbarEl) mbarEl.style.display = name === 'landing' ? '' : 'none';

  const target = hash && hash.length > 1 ? $(hash) : null;
  if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 30);
  else window.scrollTo({ top: 0, behavior: 'auto' });
  syncNavScroll();
}
window.view = view;

$$('[data-page-tab]').forEach(b => b.addEventListener('click', () => view(b.dataset.pageTab)));
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (a.dataset.go === 'landing' && !$('#view-landing').hidden && href.startsWith('#')) {
    return;
  }
  e.preventDefault();
  closeAllModals();
  const doc = a.dataset.docLink;
  if (doc) showLegalDoc(doc);
  view(a.dataset.go, href.startsWith('#') ? href : '');
});

function setOrderState(state) {
  if (!['waiting', 'delivered', 'cancelled'].includes(state)) state = 'waiting';
  if ($('#ordWait')) $('#ordWait').hidden = state !== 'waiting';
  if ($('#ordDone')) $('#ordDone').hidden = state !== 'delivered';
  if ($('#ordCancelled')) $('#ordCancelled').hidden = state !== 'cancelled';

  $$('[data-order-state]').forEach(b => b.classList.toggle('on', b.dataset.orderState === state));

  const badge = $('#ordBadge');
  if (badge) {
    if (state === 'waiting') { badge.className = 'status wait'; badge.innerHTML = '<i></i>Ожидает оплаты'; }
    else if (state === 'delivered') { badge.className = 'status ok'; badge.innerHTML = '<i></i>Оплачен ✓'; }
    else { badge.className = 'status cancel'; badge.innerHTML = '<i></i>Отменён'; }
  }
}

$$('[data-order-state]').forEach(b => {
  b.addEventListener('click', () => {
    setOrderState(b.dataset.orderState);
    if (b.dataset.orderState === 'delivered') toast('✓ Оплата успешно подтверждена!');
  });
});

if ($('#payBtn')) {
  $('#payBtn').addEventListener('click', e => {
    e.preventDefault();
    toast('Подтверждение оплаты…');
    setTimeout(() => {
      setOrderState('delivered');
      toast('✓ Подписка активирована!');
    }, 450);
  });
}
if ($('#cancelOrdBtn')) {
  $('#cancelOrdBtn').addEventListener('click', () => {
    setOrderState('cancelled');
    toast('Заказ отменён');
  });
}

const orderForm = $('#orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', e => {
    e.preventDefault();
    const emailField = $('#email');
    const email = (emailField ? emailField.value : '').trim();
    if (!email || !email.includes('@')) {
      if (emailField) emailField.classList.add('err');
      const err = $('#emailErr');
      if (err) err.hidden = false;
      toast('Укажите корректный Email для получения ключа');
      return;
    }
    const cur = calc(S.dev, S.months);
    if ($('#ordPlanName')) $('#ordPlanName').textContent = `${CFG.names[S.dev]} · до ${S.dev} устройств`;
    if ($('#ordDuration')) $('#ordDuration').textContent = `${CFG.days[S.months]} дней (${CFG.full[S.months]})`;
    if ($('#ordAwg')) $('#ordAwg').textContent = `${CFG.awg[S.dev]} ГБ в месяц`;
    if ($('#ordEmail')) $('#ordEmail').textContent = email;
    if ($('#ordTotal')) $('#ordTotal').textContent = `${fmt(cur.total)} ₽`;
    if ($('#payBtnSum')) $('#payBtnSum').textContent = `${fmt(cur.total)} ₽`;

    toast('Создание защищённого заказа…');
    setTimeout(() => {
      setOrderState(cur.total === 0 ? 'delivered' : 'waiting');
      view('order');
    }, 300);
  });
}
const emailInputEl = $('#email');
if (emailInputEl) {
  emailInputEl.addEventListener('input', () => {
    emailInputEl.classList.remove('err');
    const err = $('#emailErr');
    if (err) err.hidden = true;
  });
}

/* =========================================================================
   5. МАСТЕР ПОДКЛЮЧЕНИЯ: ОСНОВНОЙ РЕЖИМ (subjson-service/app.py)
   ========================================================================= */
const U = {
  HAPP_DOWNLOAD: 'https://www.happ.su/main',
  HAPP_IOS: 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215',
  HAPP_ANDROID: 'https://play.google.com/store/apps/details?id=com.happproxy',
  HAPP_APK: 'https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk',
  STREISAND_IOS: 'https://apps.apple.com/us/app/streisand/id6450534064',
  STREISAND_MACOS: 'https://apps.apple.com/us/app/streisand/id6450534064',
  CLASH_MI_IOS: 'https://apps.apple.com/app/clash-mi/id6744321968',
  CLASH_DL: 'https://github.com/clash-verge-rev/clash-verge-rev/releases',
  CLASH_ANDROID: 'https://github.com/MetaCubeX/ClashMetaForAndroid/releases',
  V2RAYN_DL: 'https://github.com/2dust/v2rayN/releases',
  NEKOBOX_DL: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases',
  V2RAYNG_DL: 'https://github.com/2dust/v2rayNG/releases',
  SINGBOX_IOS: 'https://apps.apple.com/app/sing-box-mt/id6785326793',
  SINGBOX_DL: 'https://github.com/SagerNet/sing-box/releases'
};
const dl = (label, url, icon) => ({ label, url, icon });

const MAIN_APPS = [
  { id: 'happ', name: 'Happ', badge: 'рекомендуем', icon: 'assets/apps/happ.webp',
    platforms: ['ios', 'android', 'windows', 'macos', 'linux', 'androidtv', 'appletv'],
    description: 'Флагманский клиент с поддержкой протоколов REALITY и XHTTP. Обеспечивает максимальную скорость и незаметность подключения на любых устройствах.',
    downloads: {
      ios: [dl('App Store', U.HAPP_IOS, 'appstore')],
      android: [dl('Google Play', U.HAPP_ANDROID, 'googleplay'), dl('GitHub Релизы (.apk)', U.HAPP_APK, 'github')],
      windows: [dl('Официальный сайт (.exe)', U.HAPP_DOWNLOAD, 'globe')],
      macos: [dl('Официальный сайт (.dmg)', U.HAPP_DOWNLOAD, 'globe')],
      linux: [dl('Официальный сайт (.deb / AppImage)', U.HAPP_DOWNLOAD, 'globe')],
      androidtv: [dl('Google Play', U.HAPP_ANDROID, 'googleplay'), dl('GitHub Релизы (.apk)', U.HAPP_APK, 'github')],
      appletv: [dl('App Store', U.HAPP_IOS, 'appstore')]
    } },
  { id: 'clash', name: 'Clash Mi / Mihomo', badge: 'авто-выбор', icon: 'assets/apps/clash.webp', iosIcon: 'assets/apps/clashmi.webp',
    platforms: ['windows', 'macos', 'android', 'linux', 'ios'],
    description: 'Мощный клиент с поддержкой умного авто-тестирования узлов и мгновенным переключением при сбоях.',
    downloads: {
      windows: [dl('GitHub Релизы (.exe)', U.CLASH_DL, 'github')],
      macos: [dl('GitHub Релизы (.dmg)', U.CLASH_DL, 'github')],
      android: [dl('GitHub Релизы (.apk)', U.CLASH_ANDROID, 'github')],
      linux: [dl('GitHub Релизы (.deb / AppImage)', U.CLASH_DL, 'github')],
      ios: [dl('App Store', U.CLASH_MI_IOS, 'appstore')]
    } },
  { id: 'v2rayn', name: 'v2rayN', badge: 'windows xray', icon: 'assets/apps/v2rayn.webp',
    platforms: ['windows'],
    description: 'Популярный клиент для Windows с поддержкой Xray-ядра, автоматическим обновлением подписок и гибкой маршрутизацией.',
    downloads: { windows: [dl('GitHub Релизы (.zip)', U.V2RAYN_DL, 'github')] } },
  { id: 'nekobox', name: 'NekoBox', badge: 'android json', icon: 'assets/apps/nekobox.webp',
    platforms: ['android'],
    description: 'Мощный и функциональный клиент для Android с поддержкой прямых JSON и Sing-box конфигураций.',
    downloads: { android: [dl('GitHub Релизы (.apk)', U.NEKOBOX_DL, 'github')] } },
  { id: 'v2rayng', name: 'v2rayNG', badge: 'android vless', icon: 'assets/apps/v2rayng.webp',
    platforms: ['android'],
    description: 'Классический проверенный клиент для Android для прямого импорта VLESS-конфигураций.',
    downloads: { android: [dl('GitHub Релизы (.apk)', U.V2RAYNG_DL, 'github')] } },
  { id: 'streisand', name: 'Streisand', badge: 'ios / macos', icon: 'assets/apps/streisand.webp',
    platforms: ['ios', 'macos'],
    description: 'Лёгкий и быстрый клиент, идеально оптимизированный под экосистемы iOS и macOS без расхода аккумулятора.',
    downloads: {
      ios: [dl('App Store', U.STREISAND_IOS, 'appstore')],
      macos: [dl('Mac App Store', U.STREISAND_MACOS, 'appstore')]
    } },
  { id: 'singbox', name: 'Sing-box', badge: 'sing-box', icon: 'assets/apps/singbox.webp',
    platforms: ['ios', 'android', 'windows', 'macos', 'linux'],
    description: 'Универсальный сетевой клиент нового поколения с максимальной производительностью и нативной поддержкой Sing-box JSON.',
    downloads: {
      ios: [dl('App Store', U.SINGBOX_IOS, 'appstore')],
      android: [dl('GitHub Релизы (.apk)', U.SINGBOX_DL, 'github')],
      windows: [dl('GitHub Релизы (.zip)', U.SINGBOX_DL, 'github')],
      macos: [dl('GitHub Релизы (.dmg / .zip)', U.SINGBOX_DL, 'github')],
      linux: [dl('GitHub Релизы (.tar.gz)', U.SINGBOX_DL, 'github')]
    } }
];

function usageText(appId, os) {
  const map = {
    happ: 'Запустите Happ и нажмите большую центральную кнопку включения. При первом запуске разрешите системе добавление сетевого профиля в появившемся запросе.',
    streisand: 'Откройте Streisand, подтвердите добавление профиля SilentConnect и переключите верхний тумблер в активное состояние.',
    clash: os === 'ios'
      ? 'Откройте Clash Mi, импортируйте профиль SilentConnect (кнопка выше сделает это автоматически), выберите профиль и включите тумблер подключения.'
      : 'Откройте Clash / Mihomo, импортируйте профиль SilentConnect, выберите профиль и включите системный прокси (System Proxy) или TUN-режим.',
    v2rayn: 'Откройте v2rayN, вставьте ссылку подписки через «Подписка» → «Настройки подписок», нажмите «Обновить подписки» и выберите узел для подключения.',
    nekobox: 'Откройте NekoBox, обновите подписку через меню и нажмите круглую кнопку запуска внизу экрана.',
    v2rayng: 'Откройте v2rayNG, обновите подписку через верхнее меню и нажмите кнопку подключения с буквой V.',
    singbox: os === 'ios'
      ? 'Откройте sing-box MT, импортируйте профиль SilentConnect и нажмите кнопку включения (Dashboard → Start).'
      : 'Откройте Sing-box, импортируйте профиль SilentConnect и нажмите кнопку включения (Dashboard → Start).'
  };
  return map[appId] || 'Откройте приложение, добавьте подписку SilentConnect и нажмите кнопку подключения.';
}

function badgeClassOf(badge) {
  const b = (badge || '').toLowerCase();
  if (b.includes('ios') || b.includes('macos')) return 'badge-ios';
  if (b.includes('авто')) return 'badge-auto';
  if (b.includes('windows')) return 'badge-windows';
  if (b.includes('android')) return 'badge-android';
  if (b.includes('sing')) return 'badge-singbox';
  return 'badge-recommended';
}

function renderPlatformTrack(track, list, activeId, onPick, suffix) {
  if (!track) return;
  track.innerHTML = '';
  list.forEach(p => {
    const b = document.createElement('button');
    const on = p.id === activeId;
    b.type = 'button';
    b.className = 'platform-tab' + (on ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(on));
    b.innerHTML = p.svg.replace(/finder-(blue|silver)/g, 'finder-$1-' + suffix) + `<span>${p.label}</span>`;
    b.addEventListener('click', () => {
      onPick(p.id);
      centerActiveTab(track);
    });
    track.appendChild(b);
  });
  setupDraggableTrack(track);
  centerActiveTab(track);
}

function dlButtonsHtml(items) {
  return (items || []).map(d => `
    <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
      ${d.icon === 'globe' ? '<span class="btn-globe" aria-hidden="true">🌐</span>' : `<img src="assets/stores/${d.icon}.webp" alt="" class="btn-store-icon" onerror="this.style.display='none'">`}
      <span>${d.label}</span>
    </a>`).join('');
}

function preferredMainApp(os) {
  const cur = MAIN_APPS.find(a => a.id === S.appMain);
  if (cur && cur.platforms.includes(os)) return cur.id;
  const happ = MAIN_APPS.find(a => a.id === 'happ' && a.platforms.includes(os));
  if (happ) return 'happ';
  const first = MAIN_APPS.find(a => a.platforms.includes(os));
  return first ? first.id : 'happ';
}

function renderMainSetup() {
  renderPlatformTrack($('#osTabsMain'), OS_META, S.osMain, id => {
    S.osMain = id;
    S.appMain = preferredMainApp(id);
    renderMainSetup();
  }, 'main');

  S.appMain = preferredMainApp(S.osMain);
  const os = S.osMain;
  const curOsEl = $('#curOsNameMain');
  if (curOsEl) curOsEl.textContent = OS_LABEL[os] || os;

  const avail = MAIN_APPS.filter(a => a.platforms.includes(os));
  const cur = avail.find(a => a.id === S.appMain) || avail[0];

  const grid = $('#appsGridMain');
  if (grid) {
    grid.innerHTML = '';
    avail.forEach(a => {
      let name = a.name, icon = a.icon;
      if (os === 'ios') {
        if (a.id === 'singbox') name = 'sing-box MT';
        else if (a.id === 'clash') { name = 'Clash Mi'; if (a.iosIcon) icon = a.iosIcon; }
      }
      const on = a.id === cur.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'app-card' + (on ? ' active' : '');
      card.innerHTML = `
        <img src="${icon}" alt="${name}" class="app-icon-img" onerror="this.style.display='none'">
        <div class="app-info"><div class="app-name-row">
          <span class="app-name">${name}</span>
          <span class="app-badge ${badgeClassOf(a.badge)}">${a.badge}</span>
        </div></div>
        <span class="app-check" aria-hidden="true">${on ? '✓' : ''}</span>`;
      card.addEventListener('click', () => {
        S.appMain = a.id;
        renderMainSetup();
      });
      grid.appendChild(card);
    });
  }

  const title = cur.id === 'singbox' && os === 'ios' ? 'sing-box MT' : (cur.id === 'clash' && os === 'ios' ? 'Clash Mi' : cur.name);
  const stepsGrid = $('#stepsGridMain');
  if (stepsGrid) {
    stepsGrid.innerHTML = `
      <div class="s-step">
        <div>
          <div class="s-step-head"><span class="s-step-num">1</span><h4>Установка клиента</h4></div>
          <p>${cur.description} Операционная система: ${OS_LABEL[os]}.</p>
        </div>
        <div class="step-btns">${dlButtonsHtml(cur.downloads[os] || [])}</div>
      </div>
      <div class="s-step">
        <div>
          <div class="s-step-head"><span class="s-step-num">2</span><h4>Автоматический импорт ключа</h4></div>
          <p>Нажмите «Добавить подписку». Приложение откроется автоматически и применит зашифрованный профиль SilentConnect.</p>
        </div>
        <div class="step-btns"><a href="${importUrlFor(cur.id)}" class="btn btn-primary btn-sm" onclick="event.preventDefault();toast('Открываем ${title} и передаём профиль…')">Добавить подписку ⚡</a></div>
      </div>
      <div class="s-step done">
        <div>
          <div class="s-step-head"><span class="s-step-num">3</span><h4>Активация соединения</h4></div>
          <p>${usageText(cur.id, os)}</p>
        </div>
      </div>
      <div class="s-step">
        <div>
          <div class="s-step-head"><span class="s-step-num">4</span><h4>Резервный способ (ручной импорт)</h4></div>
          <p>Если бесшовный переход не сработал: скопируйте ссылку ниже в буфер обмена и выберите «Импорт из буфера обмена» в настройках приложения.</p>
        </div>
        <div class="step-btns"><button type="button" class="btn btn-ghost btn-sm" onclick="copyToClipboard('${SUB_IMPORT_URL}', 'Ссылка подписки скопирована!')">Скопировать ссылку 🔗</button></div>
        <input class="field mono-field" readonly value="${SUB_IMPORT_URL}" aria-label="Ссылка подписки" onclick="this.select()">
      </div>`;
  }
}
renderMainSetup();

/* =========================================================================
   6. ПЕРЕКЛЮЧАТЕЛЬ 3 РЕЖИМОВ ПОДКЛЮЧЕНИЯ (Liquid Glass с физикой перетаскивания)
   ========================================================================= */
const MODES = ['main', 'awg', 'openflux'];
const setModeSegVisual = bindLiquidSegmented(
  $('#modeSeg'),
  () => MODES.indexOf(S.subMode),
  idx => {
    const mode = MODES[idx] || 'main';
    setSubMode(mode);
  }
);

function setSubMode(mode) {
  if (!MODES.includes(mode)) mode = 'main';
  const changed = mode !== S.subMode;
  S.subMode = mode;
  setModeSegVisual(MODES.indexOf(mode), changed);

  MODES.forEach(m => {
    const sec = $('#subMode-' + m);
    if (sec) sec.hidden = m !== mode;
  });

  if (mode === 'main') renderMainSetup();
  else if (mode === 'awg') renderAwgSetup();
  else if (mode === 'openflux') renderOfSetup();
}
window.setSubMode = setSubMode;

/* =========================================================================
   7. РЕЖИМ 2: AMNEZIAWG (vpn_shop/web.py render_awg_slots_widget)
   ========================================================================= */
const AWG_OS_LIST = OS_META.filter(o => ['ios', 'android', 'windows', 'macos', 'linux'].includes(o.id));
const AWG_APPS = [
  { id: 'amneziavpn', name: 'AmneziaVPN', badge: 'официальный', icon: 'assets/apps/amneziavpn.webp',
    platforms: ['ios', 'android', 'windows', 'macos', 'linux'],
    description: 'Официальный полнофункциональный клиент с автоматической поддержкой профилей AmneziaWG и встроенной защитой от DPI.',
    downloads: {
      ios: [dl('App Store', 'https://apps.apple.com/app/amneziavpn/id1600529900', 'appstore')],
      android: [dl('Google Play', 'https://play.google.com/store/apps/details?id=org.amnezia.vpn', 'googleplay'), dl('GitHub Релизы (.apk)', 'https://github.com/amnezia-vpn/amnezia-client/releases', 'github')],
      windows: [dl('GitHub Релизы (.exe)', 'https://github.com/amnezia-vpn/amnezia-client/releases', 'github')],
      macos: [dl('GitHub Релизы (.dmg)', 'https://github.com/amnezia-vpn/amnezia-client/releases', 'github')],
      linux: [dl('GitHub Релизы (.deb / AppImage)', 'https://github.com/amnezia-vpn/amnezia-client/releases', 'github')]
    } },
  { id: 'amneziawg', name: 'AmneziaWG Client', badge: 'легкий wireguard', icon: 'assets/apps/amneziawg.webp',
    platforms: ['windows', 'android', 'macos', 'ios'],
    description: 'Специализированная облегчённая сборка на базе нативного клиента WireGuard с поддержкой заголовков обфускации Jc/Jmin/Jmax.',
    downloads: {
      ios: [dl('App Store', 'https://apps.apple.com/app/amneziawg/id6478942364', 'appstore')],
      android: [dl('Google Play', 'https://play.google.com/store/apps/details?id=org.amnezia.awg', 'googleplay')],
      windows: [dl('GitHub Релизы (.msi)', 'https://github.com/amnezia-vpn/amneziawg-windows-client/releases', 'github')],
      macos: [dl('App Store', 'https://apps.apple.com/app/amneziawg/id6478942364', 'appstore')]
    } }
];

const AWG_SERVERS = {
  nl: { code: 'nl', name: 'Нидерланды', city: 'Амстердам', flag: '🇳🇱', ping: 32 },
  pl: { code: 'pl', name: 'Польша', city: 'Варшава', flag: '🇵🇱', ping: 24 },
  fi: { code: 'fi', name: 'Финляндия', city: 'Хельсинки', flag: '🇫🇮', ping: 19 }
};

const AWG_SLOTS = [
  { id: 1, name: 'Рабочий MacBook', server: 'nl', ip: '10.8.0.2', active: true },
  { id: 2, name: 'iPhone 16 Pro', server: 'pl', ip: '10.8.0.3', active: true },
  { id: 3, name: 'Домашний роутер', server: 'fi', ip: '10.8.0.4', active: false }
];

function mockAwgConfig(slot) {
  return `[Interface]
PrivateKey = aB8f...DEMO_KEY...=
Address = ${slot.ip}/32
DNS = 1.1.1.1, 8.8.8.8
Jc = 4
Jmin = 40
Jmax = 70
S1 = 15
S2 = 30
H1 = 1
H2 = 2
H3 = 3
H4 = 4

[Peer]
PublicKey = xT9q...SERVER_PUB_KEY...=
Endpoint = ${slot.server}.edge.silentconnect.net:38421
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;
}

function renderAwgSetup() {
  renderPlatformTrack($('#osTabsAwg'), AWG_OS_LIST, S.osAwg, id => {
    S.osAwg = id;
    renderAwgSetup();
  }, 'awg');

  const curOsEl = $('#curOsNameAwg');
  if (curOsEl) curOsEl.textContent = OS_LABEL[S.osAwg] || S.osAwg;

  const slotsCont = $('#awgSlotsGrid');
  if (slotsCont) {
    slotsCont.innerHTML = '';
    AWG_SLOTS.forEach(slot => {
      const srv = AWG_SERVERS[slot.server] || AWG_SERVERS.nl;
      const card = document.createElement('div');
      card.className = 'slot';
      card.innerHTML = `
        <div>
          <div class="slot-top">
            <span style="font-weight:700;color:#fff;font-size:14.5px;display:inline-flex;align-items:center;gap:6px">
              <span>📱</span> <span id="slotNameText-${slot.id}">${slot.name}</span>
              <button type="button" style="font-size:12px;opacity:.75;cursor:pointer" title="Переименовать" onclick="promptRenameSlot(${slot.id})">✏️</button>
            </span>
            <span class="status ${slot.active ? 'ok' : 'wait'}"><i></i>${slot.active ? 'Активен' : 'Свободен'}</span>
          </div>
          <div style="margin-top:10px;font-size:13px;color:var(--mut);display:flex;justify-content:space-between">
            <span>Шлюз: <b style="color:#fff">${srv.flag} ${srv.name}</b></span>
            <span>IP: <code style="color:var(--em-t)">${slot.ip}</code></span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <button type="button" class="btn btn-primary btn-sm" onclick="downloadSlotConf(${slot.id})">📥 .conf</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openSlotQrModal(${slot.id})">📱 QR-код</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="copySlotConf(${slot.id})">📋 Ключ</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openAwgSwitchModal(${slot.id})">🔄 Сервер</button>
        </div>`;
      slotsCont.appendChild(card);
    });
  }

  const grid = $('#appsGridAwg');
  if (grid) {
    grid.innerHTML = '';
    const avail = AWG_APPS.filter(a => a.platforms.includes(S.osAwg));
    const cur = avail.find(a => a.id === S.appAwg) || avail[0];
    avail.forEach(a => {
      const on = a.id === cur.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'app-card' + (on ? ' active' : '');
      card.innerHTML = `
        <img src="${a.icon}" alt="${a.name}" class="app-icon-img" onerror="this.style.display='none'">
        <div class="app-info"><div class="app-name-row">
          <span class="app-name">${a.name}</span>
          <span class="app-badge ${badgeClassOf(a.badge)}">${a.badge}</span>
        </div></div>
        <span class="app-check" aria-hidden="true">${on ? '✓' : ''}</span>`;
      card.addEventListener('click', () => { S.appAwg = a.id; renderAwgSetup(); });
      grid.appendChild(card);
    });

    const stepsGrid = $('#stepsGridAwg');
    if (stepsGrid) {
      stepsGrid.innerHTML = `
        <div class="s-step">
          <div>
            <div class="s-step-head"><span class="s-step-num">1</span><h4>Установка ${cur.name}</h4></div>
            <p>${cur.description} Операционная система: ${OS_LABEL[S.osAwg]}.</p>
          </div>
          <div class="step-btns">${dlButtonsHtml(cur.downloads[S.osAwg] || [])}</div>
        </div>
        <div class="s-step done">
          <div>
            <div class="s-step-head"><span class="s-step-num">2</span><h4>Импорт конфигурации слота</h4></div>
            <p>Скачайте <code>.conf</code> файл или отсканируйте QR-код любого из ваших слотов выше и включите тумблер подключения.</p>
          </div>
          <div class="step-btns"><button type="button" class="btn btn-primary btn-sm" onclick="downloadSlotConf(1)">Скачать слот #1 (.conf) ⚡</button></div>
        </div>`;
    }
  }
}

window.downloadSlotConf = function(slotId) {
  const slot = AWG_SLOTS.find(s => s.id === slotId) || AWG_SLOTS[0];
  const conf = mockAwgConfig(slot);
  const blob = new Blob([conf], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `silentconnect-slot-${slot.id}.conf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast(`Файл silentconnect-slot-${slot.id}.conf скачан!`);
};

window.copySlotConf = function(slotId) {
  const slot = AWG_SLOTS.find(s => s.id === slotId) || AWG_SLOTS[0];
  copyToClipboard(mockAwgConfig(slot), `Конфигурация слота #${slot.id} скопирована!`);
};

window.openSlotQrModal = function(slotId) {
  const slot = AWG_SLOTS.find(s => s.id === slotId) || AWG_SLOTS[0];
  openQrModal(`QR-код: ${slot.name}`, mockAwgConfig(slot));
};

window.promptRenameSlot = function(slotId) {
  const slot = AWG_SLOTS.find(s => s.id === slotId);
  if (!slot) return;
  const newName = window.prompt('Введите новое название для устройства:', slot.name);
  if (newName && newName.trim()) {
    slot.name = newName.trim();
    renderAwgSetup();
    toast(`Устройство переименовано в «${slot.name}»`);
  }
};

window.openAwgSwitchModal = function(slotId) {
  S.awgTargetSlot = slotId || 1;
  const slot = AWG_SLOTS.find(s => s.id === S.awgTargetSlot) || AWG_SLOTS[0];
  const title = $('#awgModalSlotTitle');
  if (title) title.textContent = `#${slot.id} (${slot.name})`;
  const radio = $(`input[name="awg_country"][value="${slot.server}"]`);
  if (radio) radio.checked = true;
  openModal('awgSwitchModal');
};

const awgApplyBtn = $('#awgConfirmSwitchBtn');
if (awgApplyBtn) {
  awgApplyBtn.addEventListener('click', () => {
    const checked = $('input[name="awg_country"]:checked');
    if (checked) {
      const code = checked.value;
      const slot = AWG_SLOTS.find(s => s.id === S.awgTargetSlot);
      if (slot) {
        slot.server = code;
        renderAwgSetup();
        const srv = AWG_SERVERS[code];
        toast(`Слот переключён на ${srv.flag} ${srv.name}! Скачайте новый .conf`);
      }
    }
    closeAllModals();
  });
}

const pingBtn = $('#pingBtn');
if (pingBtn) {
  pingBtn.addEventListener('click', () => {
    toast('Измеряем сетевую задержку до узлов Европы…');
    ['pNl', 'pPl', 'pFi'].forEach(id => {
      const el = $('#' + id);
      if (el) el.textContent = '…';
    });
    setTimeout(() => {
      const pNl = $('#pNl'); if (pNl) pNl.textContent = (28 + Math.floor(Math.random() * 8)) + ' мс';
      const pPl = $('#pPl'); if (pPl) pPl.textContent = (22 + Math.floor(Math.random() * 6)) + ' мс';
      const pFi = $('#pFi'); if (pFi) pFi.textContent = (18 + Math.floor(Math.random() * 5)) + ' мс';
      toast('✓ Задержка обновлена');
    }, 420);
  });
}

/* =========================================================================
   8. РЕЖИМ 3: OPENFLUX (subjson-service/app.py whitelist-mode-container)
   ========================================================================= */
const OF_OS_LIST = OS_META.filter(o => ['ios', 'android', 'windows', 'macos', 'linux'].includes(o.id));
let ofTimerInterval = null;
let ofTimeRemaining = 288;

function setOfState(state) {
  S.ofState = state;
  const inact = $('#ofInactive');
  const act = $('#ofActive');
  const mig = $('#ofMigrating');
  if (inact) inact.hidden = state !== 'inactive';
  if (act) act.hidden = state !== 'active';
  if (mig) mig.hidden = state !== 'migrating';

  $$('[data-of-state]').forEach(b => b.classList.toggle('on', b.dataset.ofState === state));

  const srv = AWG_SERVERS[S.ofCountry] || AWG_SERVERS.nl;
  const targetSrv = AWG_SERVERS[S.ofTargetCountry] || AWG_SERVERS.pl;

  const actCountryEl = $('#ofActiveCountry');
  if (actCountryEl) actCountryEl.textContent = `${srv.flag} ${srv.name} (${srv.city})`;

  const targetCountryEl = $('#ofTargetCountry');
  if (targetCountryEl) targetCountryEl.textContent = `${targetSrv.flag} ${targetSrv.name} (${targetSrv.city})`;

  const keyInput = $('#ofKeyInput');
  if (keyInput) keyInput.value = `vless://of_${SUB_ID}-${srv.code}@edge.silentconnect.net:443?security=reality&sni=cloud.mail.ru#SilentConnect-OpenFlux-${srv.code.toUpperCase()}`;

  const newKeyInput = $('#ofNewKeyInput');
  if (newKeyInput) newKeyInput.value = `vless://of_mig_${SUB_ID}-${targetSrv.code}@edge.silentconnect.net:443?security=reality&sni=cloud.mail.ru#SilentConnect-OpenFlux-${targetSrv.code.toUpperCase()}`;

  if (state === 'migrating') startOfHandoverTimer();
  else clearInterval(ofTimerInterval);
}
window.setOfState = setOfState;

function startOfHandoverTimer() {
  clearInterval(ofTimerInterval);
  const timerBox = $('#ofTimer');
  function tick() {
    if (ofTimeRemaining <= 0) {
      clearInterval(ofTimerInterval);
      S.ofCountry = S.ofTargetCountry;
      setOfState('active');
      toast('Миграция автоматически завершена!');
      return;
    }
    const m = Math.floor(ofTimeRemaining / 60);
    const s = ofTimeRemaining % 60;
    if (timerBox) timerBox.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    ofTimeRemaining--;
  }
  tick();
  ofTimerInterval = setInterval(tick, 1000);
}

function renderOfSetup() {
  renderPlatformTrack($('#osTabsOf'), OF_OS_LIST, S.osOf, id => {
    S.osOf = id;
    renderOfSetup();
  }, 'of');

  const curOsEl = $('#curOsNameOf');
  if (curOsEl) curOsEl.textContent = OS_LABEL[S.osOf] || S.osOf;

  const stepsGrid = $('#stepsGridOf');
  if (stepsGrid) {
    stepsGrid.innerHTML = `
      <div class="s-step">
        <div>
          <div class="s-step-head"><span class="s-step-num">1</span><h4>Клиент для ${OS_LABEL[S.osOf]}</h4></div>
          <p>Для подключения ключа OpenFlux используйте Happ, Streisand, v2rayNG или v2rayN, установленный на вашем устройстве.</p>
        </div>
      </div>
      <div class="s-step done">
        <div>
          <div class="s-step-head"><span class="s-step-num">2</span><h4>Импорт защищённого ключа</h4></div>
          <p>Скопируйте персональный ключ OpenFlux выше и нажмите «Импорт из буфера обмена» в приложении.</p>
        </div>
      </div>`;
  }
}

$$('[data-of-state]').forEach(b => b.addEventListener('click', () => setOfState(b.dataset.ofState)));
$$('[data-set-of]').forEach(b => b.addEventListener('click', () => setOfState(b.dataset.setOf)));

$$('[data-open-wl-picker]').forEach(b => {
  b.addEventListener('click', () => {
    const mode = b.dataset.openWlPicker;
    const title = $('#wlPickerTitle');
    if (title) {
      title.textContent = mode === 'activate'
        ? '🌍 Выберите страну для активации OpenFlux'
        : '🌍 Смена локации OpenFlux (с безопасным окном миграции)';
    }
    openModal('wlPickerModal');
  });
});

const wlConfirmPickBtn = $('#wlConfirmPickBtn');
if (wlConfirmPickBtn) {
  wlConfirmPickBtn.addEventListener('click', () => {
    const checked = $('input[name="wl_country"]:checked');
    const targetCode = checked ? checked.value : 'pl';
    closeAllModals();

    if (S.ofState === 'inactive') {
      S.ofCountry = targetCode;
      setOfState('active');
      toast(`✓ Слот OpenFlux активирован на ${AWG_SERVERS[targetCode].flag} ${AWG_SERVERS[targetCode].name}!`);
    } else {
      S.ofTargetCountry = targetCode;
      ofTimeRemaining = 300;
      setOfState('migrating');
      toast(`Подготовлен новый сервер: ${AWG_SERVERS[targetCode].flag} ${AWG_SERVERS[targetCode].name}. Скопируйте новый ключ!`);
    }
  });
}

const ofConfirmBtn = $('#ofConfirmBtn');
if (ofConfirmBtn) ofConfirmBtn.addEventListener('click', () => openModal('ofConfirmModal'));

const ofFinalizeBtn = $('#ofFinalizeBtn');
if (ofFinalizeBtn) {
  ofFinalizeBtn.addEventListener('click', () => {
    S.ofCountry = S.ofTargetCountry;
    closeAllModals();
    setOfState('active');
    toast('✓ Переход на новый сервер успешно завершён! Старый сервер отключён.');
  });
}

setOfState('active');

/* =========================================================================
   9. АККОРДЕОН ПРОДЛЕНИЯ И ПРИВЯЗКИ ПОЧТЫ
   ========================================================================= */
const renewAcc = $('#renewAcc');
const renewToggle = $('#renewToggle');
const bindEmailOnlyChk = $('#bindEmailOnly');

function setRenewOpen(open) {
  if (!renewAcc) return;
  renewAcc.setAttribute('data-open', String(open));
  if (renewToggle) renewToggle.setAttribute('aria-expanded', String(open));
}

if (renewToggle) {
  renewToggle.addEventListener('click', () => {
    const isOpen = renewAcc.getAttribute('data-open') === 'true';
    setRenewOpen(!isOpen);
  });
}

function syncRenewEmailState() {
  if (!renewAcc) return;
  $$('[data-email-state]').forEach(b => {
    b.classList.toggle('on', (b.dataset.emailState === 'bound') === S.emailBound);
  });
  const subBoundEmail = $('#subBoundEmail');
  if (!S.emailBound) {
    setRenewOpen(true);
    renewAcc.classList.add('warn-unbound');
    if (subBoundEmail) { subBoundEmail.textContent = 'не привязана'; subBoundEmail.style.color = 'var(--warn)'; }
    const badge = $('#renewEmailBadge');
    if (badge) { badge.className = 'status wait'; badge.innerHTML = '<i></i>Почта не привязана'; }
    if ($('#emailUnboundAlert')) $('#emailUnboundAlert').hidden = false;
    if ($('#emailBoundPill')) $('#emailBoundPill').hidden = true;
  } else {
    renewAcc.classList.remove('warn-unbound');
    if (subBoundEmail) { subBoundEmail.textContent = 'c***t@example.com'; subBoundEmail.style.color = 'var(--em-t)'; }
    const badge = $('#renewEmailBadge');
    if (badge) { badge.className = 'status ok'; badge.innerHTML = '<i></i>Почта привязана'; }
    if ($('#emailUnboundAlert')) $('#emailUnboundAlert').hidden = true;
    if ($('#emailBoundPill')) $('#emailBoundPill').hidden = false;
  }
}

$$('[data-email-state]').forEach(b => {
  b.addEventListener('click', () => {
    S.emailBound = b.dataset.emailState === 'bound';
    syncRenewEmailState();
  });
});

function renderRenewCalculations() {
  $$('[data-r-dev]').forEach(b => b.classList.toggle('active', Number(b.dataset.rDev) === S.renDev));
  $$('[data-r-m]').forEach(b => b.classList.toggle('active', Number(b.dataset.rM) === S.renMonths));

  const price = CFG.prices[S.renDev][S.renMonths];
  const totalEl = $('#renPrice');
  const sumEl = $('#renSummary');
  const submitBtn = $('#renSubmitBtn');
  const selectors = $('#renewPlanSelectors');
  const bindCard = $('#bindOnlyCard');

  if (S.bindOnly) {
    if (sumEl) sumEl.textContent = 'Привязка / смена почты без оплаты';
    if (totalEl) totalEl.textContent = '0 ₽';
    if (submitBtn) submitBtn.textContent = 'Привязать почту ✓';
    if (selectors) selectors.classList.add('dimmed-block');
    if (bindCard) bindCard.classList.add('active');
  } else {
    if (sumEl) sumEl.textContent = `${CFG.names[S.renDev]} (${S.renDev} устр.) · +${CFG.days[S.renMonths]} дней`;
    if (totalEl) totalEl.textContent = `${fmt(price)} ₽`;
    if (submitBtn) submitBtn.textContent = `Оплатить ${fmt(price)} ₽ →`;
    if (selectors) selectors.classList.remove('dimmed-block');
    if (bindCard) bindCard.classList.remove('active');
  }
}

$$('[data-r-dev]').forEach(b => {
  b.addEventListener('click', () => {
    S.renDev = Number(b.dataset.rDev);
    renderRenewCalculations();
  });
});
$$('[data-r-m]').forEach(b => {
  b.addEventListener('click', () => {
    S.renMonths = Number(b.dataset.rM);
    renderRenewCalculations();
  });
});

if (bindEmailOnlyChk) {
  bindEmailOnlyChk.addEventListener('change', e => {
    S.bindOnly = e.target.checked;
    renderRenewCalculations();
  });
}

const renForm = $('#renewForm');
if (renForm) {
  renForm.addEventListener('submit', e => {
    e.preventDefault();
    const mailInput = $('#renewEmailInput');
    const mail = (mailInput ? mailInput.value : '').trim();
    if (!mail || !mail.includes('@')) {
      toast('Укажите корректный адрес электронной почты');
      if (mailInput) mailInput.focus();
      return;
    }
    if (S.bindOnly) {
      S.emailBound = true;
      S.bindOnly = false;
      if (bindEmailOnlyChk) bindEmailOnlyChk.checked = false;
      syncRenewEmailState();
      renderRenewCalculations();
      toast(`✓ Почта ${mail} успешно привязана к подписке!`);
      const boundLbl = $('#boundEmailLabel');
      if (boundLbl) boundLbl.textContent = mail;
    } else {
      toast('Создание счёта на продление…');
      setTimeout(() => {
        setOrderState('waiting');
        view('order');
      }, 300);
    }
  });
}

const changeBoundEmailBtn = $('#changeBoundEmailBtn');
if (changeBoundEmailBtn) {
  changeBoundEmailBtn.addEventListener('click', () => {
    if (bindEmailOnlyChk) {
      bindEmailOnlyChk.checked = true;
      S.bindOnly = true;
      renderRenewCalculations();
    }
    const mailInput = $('#renewEmailInput');
    if (mailInput) {
      mailInput.value = '';
      mailInput.focus();
    }
  });
}

syncRenewEmailState();
renderRenewCalculations();

/* =========================================================================
   10. МОДАЛЬНЫЕ ОКНА И COMMAND PALETTE (⌘K)
   ========================================================================= */
function openModal(modalId) {
  const m = $('#' + modalId);
  if (!m) return;
  m.classList.add('open');
  m.removeAttribute('hidden');
}
window.openModal = openModal;

function closeAllModals() {
  $$('.modal').forEach(m => {
    m.classList.remove('open');
    m.setAttribute('hidden', '');
  });
}
window.closeAllModals = closeAllModals;

$$('[data-close]').forEach(b => b.addEventListener('click', closeAllModals));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAllModals(); }));

function openQrModal(title, text) {
  const titleEl = $('#qrTitle');
  if (titleEl) titleEl.textContent = title;
  const subEl = $('#qrSub');
  if (subEl) subEl.textContent = text;
  const qrBox = $('#qrModal .qr');
  if (qrBox) renderSvgQr(text, qrBox, 164);
  openModal('qrModal');
}
window.openQrModal = openQrModal;

$$('[data-qr]').forEach(b => {
  b.addEventListener('click', () => openQrModal(b.dataset.qr || 'QR-код', SUB_IMPORT_URL));
});

$$('[data-open-cabinet]').forEach(b => {
  b.addEventListener('click', () => openModal('cabinetModal'));
});

const cabinetForm = $('#cabinetForm');
if (cabinetForm) {
  cabinetForm.addEventListener('submit', e => {
    e.preventDefault();
    closeAllModals();
    toast('Вход в личный кабинет выполнен!');
    view('cabinet');
  });
}

/* Command Palette (⌘K / Ctrl+K) */
const CMD_LIST = [
  { label: 'Выбрать тариф и оформить подписку', hint: 'Витрина (/)', act: () => view('landing', '#tariffs') },
  { label: 'Мастер настройки: Основной профиль', hint: '/sub/setup/…', act: () => { setSubMode('main'); view('sub'); } },
  { label: 'Мастер настройки: Игровой AmneziaWG', hint: '/sub/setup/…', act: () => { setSubMode('awg'); view('sub'); } },
  { label: 'Мастер настройки: Белые списки (OpenFlux)', hint: '/sub/setup/…', act: () => { setSubMode('openflux'); view('sub'); } },
  { label: 'Страница заказа и статуса оплаты', hint: '/order/…', act: () => view('order') },
  { label: 'Личный кабинет подписок', hint: '/cabinet/…', act: () => view('cabinet') },
  { label: 'Политика возвратов (Гарантия 14 дней)', hint: 'Документы', act: () => { showLegalDoc('refund'); view('legal'); } },
  { label: 'Политика конфиденциальности (No-Logs)', hint: 'Документы', act: () => { showLegalDoc('privacy'); view('legal'); } },
  { label: 'Контакты и поддержка 24/7', hint: 'Документы', act: () => { showLegalDoc('contact'); view('legal'); } }
];

function renderCmdPalette(q = '') {
  const box = $('#cmdList');
  if (!box) return;
  const query = q.trim().toLowerCase();
  const items = CMD_LIST.filter(i => !query || i.label.toLowerCase().includes(query) || i.hint.toLowerCase().includes(query));
  box.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cmd-item';
    b.innerHTML = `<span>${item.label}</span><small>${item.hint}</small>`;
    b.addEventListener('click', () => { closeAllModals(); item.act(); });
    box.appendChild(b);
  });
}

$$('[data-open-cmd]').forEach(b => {
  b.addEventListener('click', () => {
    renderCmdPalette('');
    openModal('cmdModal');
    const input = $('#cmdInput');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
  });
});

const cmdInput = $('#cmdInput');
if (cmdInput) cmdInput.addEventListener('input', e => renderCmdPalette(e.target.value));

window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    renderCmdPalette('');
    openModal('cmdModal');
    if (cmdInput) { cmdInput.value = ''; setTimeout(() => cmdInput.focus(), 50); }
  } else if (e.key === 'Escape') {
    closeAllModals();
  }
});

/* =========================================================================
   11. РАЗДЕЛ ЮРИДИЧЕСКОЙ ИНФОРМАЦИИ (Все 5 документов: about, contact, terms, privacy, refund)
   ========================================================================= */
const LEGAL_DOCS = {
  about: {
    title: 'О сервисе SilentConnect',
    date: 'Инфраструктура приватного доступа',
    html: `
      <p><b>SilentConnect</b> — сервис защищённого сетевого доступа с европейскими узлами (Нидерланды, Польша, Финляндия) и каналами связи до 10 Гбит/с.</p>
      <h3>Три режима в одной подписке</h3>
      <ul>
        <li><b>Основной контур:</b> безлимитный трафик и скорость на каждый день для всех ваших устройств.</li>
        <li><b>Игровой контур (AmneziaWG):</b> выделенные слоты с прямым UDP-соединением и минимальной задержкой для онлайн-игр, звонков и роутеров.</li>
        <li><b>Режим Белых списков (OpenFlux):</b> резервный канал связи на случай жёстких ограничений мобильного интернета оператором.</li>
      </ul>`
  },
  contact: {
    title: 'Контакты и поддержка 24/7',
    date: 'Среднее время ответа оператора: 2–5 минут',
    html: `
      <p>Поддержка SilentConnect работает круглосуточно без выходных. Мы помогаем с подключением любых устройств, настройкой роутеров и вопросами оплаты.</p>
      <h3>Связаться с нами</h3>
      <ul>
        <li><b>Поддержка в Telegram:</b> <a href="https://t.me/SilentConnectSupport" target="_blank" rel="noopener" class="link">@SilentConnectSupport</a></li>
        <li><b>Telegram-бот сервиса:</b> <a href="https://t.me/SilentConnectBot" target="_blank" rel="noopener" class="link">@SilentConnectBot</a></li>
        <li><b>Электронная почта:</b> support@silentconnect.net</li>
      </ul>`
  },
  terms: {
    title: 'Пользовательское соглашение (Публичная оферта)',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Настоящий документ является публичной безотзывной офертой сервиса <b>SilentConnect</b> на заключение договора об оказании возмездных услуг по предоставлению защищённого сетевого доступа.</p>
      <h3>1. Предмет соглашения</h3>
      <p>Исполнитель обязуется предоставить Заказчику доступ к персональным конфигурациям маршрутизации трафика в рамках выбранного тарифного плана на условиях настоящей оферты.</p>
      <h3>2. Условия возврата денежных средств</h3>
      <p>Заказчик имеет право на полный возврат уплаченных средств в течение <b>14 календарных дней</b> с момента первичной оплаты при обращении в службу поддержки.</p>
      <h3>3. Ограничения использования</h3>
      <p>Запрещается использование сервиса для распространения вредоносного ПО, проведения сетевых атак (DDoS), рассылки спама и любых действий, нарушающих законодательство.</p>`
  },
  privacy: {
    title: 'Политика конфиденциальности (No-Logs)',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Мы придерживаемся строгой архитектуры конфиденциальности <b>Zero-Knowledge & No-Logs</b>. Ваша сетевая активность принадлежит исключительно вам.</p>
      <h3>1. Что мы не собираем</h3>
      <p>Мы <b>никогда не записываем и не храним</b>: посещённые вами сайты, DNS-запросы, передаваемый контент, IP-адреса назначения и метаданные сессий.</p>
      <h3>2. Что хранится в учётной записи</h3>
      <p>Для функционирования подписки хранится исключительно: указанный вами адрес электронной почты (для отправки чеков и напоминаний), дата окончания оплаченного периода и общий объём использованного скоростного трафика AmneziaWG.</p>`
  },
  refund: {
    title: 'Политика возвратов (Гарантия 14 дней)',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Мы уверены в надёжности нашего сервиса и гарантируем прозрачные условия возврата средств.</p>
      <h3>1. Гарантия 14 дней на первый заказ</h3>
      <p>Если сервис не подошёл вам по скорости, совместимости или любой другой причине — напишите в нашу круглосуточную поддержку <a href="https://t.me/SilentConnectSupport" target="_blank" rel="noopener" class="link">@SilentConnectSupport</a> в течение 14 дней с момента первой оплаты. Возврат осуществляется в полном объёме тем же способом оплаты.</p>`
  }
};

function showLegalDoc(docId) {
  if (!LEGAL_DOCS[docId]) docId = 'refund';
  const doc = LEGAL_DOCS[docId];
  $$('#legalNav button').forEach(b => b.classList.toggle('on', b.dataset.doc === docId));
  const container = $('#legalDoc');
  if (container) {
    container.innerHTML = `<h2>${doc.title}</h2><div class="date">${doc.date}</div>${doc.html}`;
  }
  const nav = $('#legalNav');
  if (nav) centerActiveTab(nav);
}
window.showLegalDoc = showLegalDoc;

const legalNav = $('#legalNav');
if (legalNav) {
  setupDraggableTrack(legalNav);
  $$('#legalNav button').forEach(b => {
    b.addEventListener('click', () => showLegalDoc(b.dataset.doc));
  });
}
showLegalDoc('refund');

})();