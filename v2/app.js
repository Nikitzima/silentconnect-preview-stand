/* SilentConnect Redesign Prototype v2/v3 — Полная экосистема (1:1 с боевым сайтом)
   - 1:1 Соответствие боевому subjson-service/app.py и vpn-shop/vpn_shop/web.py
   - Точные SVG-иконки устройств из боевого кода (v2/os-icons.js)
   - Точный порядок приложений, бейджи, ссылки на скачивание и инструкции usageMap
   - Полный скоростной режим AmneziaWG: виджет квоты-батареи, слоты устройств, скачивание .conf, QR-код, пинг серверов (NL, PL, FI)
   - Режим Белых Списков OpenFlux: сессия Mail.ru Stream, состояния (inactive, active, migrating), 5-минутный таймер миграции
   - Аккордеон продления и привязки почты: автоматическое раскрытие при непривязанной почте, галочка «Только привязать почту», плавная анимация
   - Мобильная адаптивность: факты в строку, плавный свайп и drag-to-scroll вкладок устройств и инфо-блоков
*/

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

/* ---------- Генератор SVG QR-кода ---------- */
function renderSvgQr(text, containerEl, size = 180) {
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

  containerEl.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:#080e0c; border-radius:12px; padding:8px; border:1px solid rgba(52,227,164,0.3); box-shadow:0 8px 24px rgba(0,0,0,0.6); display:block; margin:0 auto;">
      ${paths}
    </svg>`;
}

/* ---------- Навигация & Liquid Glass шапка при скролле ---------- */
const navEl = $('#nav');
function syncNavScroll() {
  if (!navEl) return;
  navEl.classList.toggle('solid', window.scrollY > 16);
}
window.addEventListener('scroll', syncNavScroll, { passive: true });
syncNavScroll();

/* ---------- Drag-to-scroll & автоцентрирование для горизонтальных вкладок ---------- */
function setupDraggableTrack(track) {
  if (!track || track._dragInit) return;
  track._dragInit = true;
  let isDown = false, startX = 0, scrollLeft = 0, moved = false;
  track.addEventListener('mousedown', e => {
    isDown = true;
    track.classList.add('grabbing');
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
    moved = false;
  });
  window.addEventListener('mouseup', () => {
    if (isDown) {
      isDown = false;
      if (track) track.classList.remove('grabbing');
    }
  });
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
   1. ПЛАТФОРМЫ: ТОЧНЫЕ SVG-ИКОНКИ И АВТООПРЕДЕЛЕНИЕ (subjson-service/app.py)
   ========================================================================= */
const OS_META = (window.SC_OS && window.SC_OS.length) ? window.SC_OS : [
  { id: 'ios', label: 'iOS', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.36-.57.65-1.07 1.72-.94 2.74 1.01.08 2.04-.5 2.66-1.25z"/></svg>' },
  { id: 'android', label: 'Android', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.52 15.34c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m-11.04 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m11.4-6.02l2-3.46c.12-.2.05-.47-.15-.57-.2-.12-.47-.05-.57.15l-2.02 3.5C15.59 8.41 13.85 8.08 12 8.08s-3.59.33-5.14.87L4.84 5.45c-.1-.2-.37-.27-.57-.15-.2.1-.27.37-.15.57l2 3.46C2.69 11.19.34 14.66 0 18.76h24c-.34-4.1-2.69-7.57-6.12-9.44"/></svg>' },
  { id: 'windows', label: 'Windows', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M0 3.45L9.75 2.1v9.45H0m10.95-9.6L24 0v11.4H10.95M0 12.6h9.75v9.45L0 20.7M10.95 12.6H24V24l-13.05-1.8"/></svg>' },
  { id: 'macos', label: 'macOS', svg: '<svg viewBox="0 0 512 512" width="18" height="18"><defs><linearGradient id="finder-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e73f2"/><stop offset="100%" stop-color="#19d3fd"/></linearGradient><linearGradient id="finder-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dbe9f4"/><stop offset="100%" stop-color="#f7f6f6"/></linearGradient></defs><rect width="512" height="512" fill="url(#finder-silver)" rx="85"/><path fill="url(#finder-blue)" d="m0 0h262q-65 162-64 286c0 7 6 13 13 13h64q-6 113 28 213H0z"/><g fill="none" stroke="#1e293b" stroke-linecap="round"><path stroke-width="24" d="m133.5 157.5v34m226.5-34v34"/><path stroke-width="20" d="m394 345c-55 81-241 81-295.5 0"/></g></svg>' },
  { id: 'linux', label: 'Linux', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z"/></svg>' },
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

function syncDetectedOsLabels() {
  ['detectedOsMain', 'detectedOsAwg', 'detectedOsOf'].forEach(id => {
    const el = $('#' + id);
    if (el) el.textContent = OS_LABEL[detectedOs] || detectedOs;
  });
}
syncDetectedOsLabels();

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
  renDev: 3, renMonths: 12, emailBound: false, bindOnly: false,
  subMode: 'main',
  osMain: detectedOs, appMain: 'happ',
  osAwg: (detectedOs === 'appletv' || detectedOs === 'androidtv') ? 'windows' : detectedOs, appAwg: 'amneziavpn',
  osOf: (detectedOs === 'androidtv' || detectedOs === 'appletv') ? 'ios' : detectedOs,
  ofState: 'active', ofCountry: 'nl', ofTargetCountry: 'pl',
  awgSlot1Srv: 'nl', awgSlot2Srv: 'pl', awgSlot3Srv: 'fi',
  awgTargetSlot: 1
};

/* Анимированный счетчик цифр */
const numReg = new WeakMap();
function num(el, target, suffix = '', dur = 420) {
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

/* Liquid Glass переключатель тарифов (#devSeg: Личный / Домашний / Расширенный) */
const devSeg = $('#devSeg') || $('#planSeg');
const devSegBtns = devSeg ? $$('.seg-btn', devSeg) : [];
const DEVS = [3, 6, 9];
let squashTimer = null;

function setDevSeg(index, squash = true) {
  if (!devSeg) return;
  devSeg.style.setProperty('--i', index);
  devSegBtns.forEach((b, k) => b.setAttribute('aria-checked', String(k === index)));
  if (squash) {
    devSeg.classList.add('squash');
    clearTimeout(squashTimer);
    squashTimer = setTimeout(() => devSeg.classList.remove('squash'), 220);
  }
}

if (devSeg) {
  let down = null;
  const slotW = () => (devSeg.clientWidth - 10) / 3;

  devSeg.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    down = { x: e.clientX, i: DEVS.indexOf(S.dev), moved: false, id: e.pointerId, dx: 0 };
    devSeg.classList.add('lift');
  });

  devSeg.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.abs(dx) > 5) {
      down.moved = true;
      devSeg.classList.add('drag');
      if (devSeg.setPointerCapture) devSeg.setPointerCapture(down.id);
    }
    if (!down.moved) return;
    const base = down.i * slotW();
    const target = Math.min(Math.max(base + dx, 0), 2 * slotW());
    down.dx = target - base;
    devSeg.style.setProperty('--dx', down.dx + 'px');
  });

  const endDrag = e => {
    if (!down) return;
    const d = down;
    down = null;
    devSeg.classList.remove('lift', 'drag');
    let idx = d.i;
    if (d.moved) {
      idx = Math.round((d.i * slotW() + d.dx) / slotW());
    } else {
      const b = e.target && e.target.closest && e.target.closest('.seg-btn');
      if (b) idx = devSegBtns.indexOf(b);
    }
    idx = Math.min(2, Math.max(0, idx));
    devSeg.style.setProperty('--dx', '0px');
    chooseDev(idx);
  };

  devSeg.addEventListener('pointerup', endDrag);
  devSeg.addEventListener('pointercancel', () => {
    down = null;
    devSeg.classList.remove('lift', 'drag');
    devSeg.style.setProperty('--dx', '0px');
  });

  devSegBtns.forEach((b, k) => {
    b.addEventListener('click', () => chooseDev(k));
  });

  devSeg.addEventListener('keydown', e => {
    const cur = DEVS.indexOf(S.dev);
    if (e.key === 'ArrowRight') { chooseDev(Math.min(2, cur + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { chooseDev(Math.max(0, cur - 1)); e.preventDefault(); }
  });

  function chooseDev(i) {
    if (i < 0 || i >= DEVS.length) return;
    const next = DEVS[i];
    const changed = next !== S.dev;
    S.dev = next;
    setDevSeg(i, changed);
    renderCatalog();
  }
}

/* Отрисовка витрины и корзины */
function renderCatalog() {
  const plan = CFG.names[S.dev];
  const cur = calc(S.dev, S.months);

  // Синхронизация бегунка
  const devIdx = DEVS.indexOf(S.dev);
  setDevSeg(devIdx >= 0 ? devIdx : 0, false);

  // Обновление плиток
  if (tilesEl) {
    $$('.tile', tilesEl).forEach(t => {
      const m = Number(t.dataset.m);
      const c = calc(S.dev, m);
      t.setAttribute('aria-checked', String(m === S.months));
      t.classList.toggle('active', m === S.months);
      num($('.t-per', t), c.per);
      num($('.t-tot', t), c.total);
      const sv = $('.save', t);
      if (sv) {
        if (c.catPct > 0) {
          sv.hidden = false;
          sv.textContent = `−${c.catPct}%`;
        } else {
          sv.hidden = true;
        }
      }
    });
  }

  // Обновление объема квоты AmneziaWG
  num($('#awgQ'), CFG.awg[S.dev], ' ГБ');

  // Обновление карточки чекаута справа
  const coPlan = $('#coPlan');
  if (coPlan) coPlan.textContent = `Тариф «${plan}» · ${CFG.full[S.months]}`;
  num($('#coPrice'), cur.total);

  const coOld = $('#coOld');
  if (coOld) {
    coOld.textContent = cur.saved > 0 ? `${fmt(cur.base)} ₽` : '';
    coOld.hidden = cur.saved <= 0;
  }

  const coMonth = $('#coMonth');
  if (coMonth) {
    coMonth.textContent = S.promoType === 'gift' ? 'подарочный сертификат' : `${fmt(cur.per)} ₽ в месяц`;
  }

  const coSave = $('#coSave');
  if (coSave) {
    let note = '';
    if (S.promoType === 'gift') note = 'скидка 100%';
    else if (S.promoPct > 0) note = `промокод −${S.promoPct}% · экономия ${fmt(cur.saved)} ₽`;
    else if (S.refPct > 0) note = `приглашение −${S.refPct}% · экономия ${fmt(cur.saved)} ₽`;
    else if (cur.saved > 0) note = `экономия ${fmt(cur.saved)} ₽`;
    coSave.textContent = note;
    coSave.hidden = !note;
  }

  const fOffer = $('#fOffer');
  if (fOffer) fOffer.value = `tcp_${S.dev}_${CFG.days[S.months]}`;

  // Плавающая панель на мобильных
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
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = `✓ Промокод ${code} применен (−10%)`; }
    toast(`Промокод ${code} применен!`);
  } else if (code === 'SALE20' || code === 'START') {
    S.promo = code; S.promoPct = 20; S.promoType = 'pct';
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = `✓ Промокод ${code} применен (−20%)`; }
    toast(`Промокод ${code} применен!`);
  } else if (code === 'GIFT30' || code === 'FREE') {
    S.promo = code; S.promoPct = 100; S.promoType = 'gift';
    if (promoMsg) { promoMsg.className = 'promo-msg ok'; promoMsg.textContent = '✓ Подарочный сертификат активирован (100% скидка)'; }
    toast('Подарочный сертификат применен!');
  } else {
    S.promo = ''; S.promoPct = 0; S.promoType = null;
    if (promoMsg) { promoMsg.className = 'promo-msg err'; promoMsg.textContent = '✕ Промокод не найден или устарел'; }
    toast('Промокод не найден');
  }
  renderCatalog();
}
if (promoApplyBtn) promoApplyBtn.addEventListener('click', applyPromo);
if (promoInput) promoInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });

setDevSeg(0, false);
renderCatalog();

/* =========================================================================
   3. РОУТИНГ СТРАНИЦ / ЭКРАНОВ
   ========================================================================= */
const VIEWS = ['landing', 'order', 'sub', 'cabinet', 'legal'];
function view(name, hash) {
  if (!VIEWS.includes(name)) name = 'landing';
  VIEWS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.hidden = v !== name;
  });
  $$('[data-page-tab]').forEach(b => b.classList.toggle('on', b.dataset.pageTab === name));
  const mbar = $('#mbar');
  if (mbar) mbar.style.display = name === 'landing' ? '' : 'none';

  const target = hash && hash.length > 1 ? $(hash) : null;
  if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 30);
  else window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  syncNavScroll();
}
window.view = view;

$$('[data-page-tab]').forEach(b => b.addEventListener('click', () => view(b.dataset.pageTab)));
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  closeAllModals();
  const doc = a.dataset.docLink;
  if (doc) showLegalDoc(doc);
  const href = a.getAttribute('href');
  view(a.dataset.go, href && href.startsWith('#') ? href : '');
});

/* Оформление заказа (Чек-аут) */
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
    toast('Создание защищенного заказа...');
    setTimeout(() => {
      setOrderState('waiting');
      view('order');
    }, 350);
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
   4. ЭКРАН ЗАКАЗА: 3 СОСТОЯНИЯ (waiting / delivered / cancelled)
   ========================================================================= */
function setOrderState(state) {
  ['waiting', 'delivered', 'cancelled'].forEach(s => {
    const el = $('#orderSec-' + s);
    if (el) el.hidden = s !== state;
  });
  if (state === 'waiting') {
    const qrBox = $('#qrOrderSbp');
    if (qrBox) renderSvgQr('https://qr.nspk.ru/AD10003N48B5739P9N19582847920194?type=02&bank=100000000004&crc=B8F2', qrBox, 160);
  }
}
$$('[data-order-sim]').forEach(b => {
  b.addEventListener('click', () => {
    const targetState = b.dataset.orderSim;
    setOrderState(targetState);
    if (targetState === 'delivered') toast('✓ Оплата успешно подтверждена!');
  });
});

/* =========================================================================
   5. РЕЖИМ 1: ОСНОВНОЙ (1:1 с subjson-service/app.py setup_page_html)
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
  { id: 'clash', name: 'Clash Mi / Mihomo', badge: 'авто-выбор', icon: 'assets/apps/clash.webp', iosIcon: 'assets/apps/clash_mi.webp',
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
    description: 'Легкий и быстрый open-source клиент, идеально оптимизированный под экосистемы iOS и macOS без расхода аккумулятора.',
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
      ? 'Откройте Clash Mi, импортируйте профиль SilentConnect (кнопка вверху страницы сделает это автоматически), выберите профиль и включите тумблер подключения.'
      : 'Откройте Clash / Mihomo, импортируйте профиль SilentConnect (кнопка вверху страницы сделает это автоматически), выберите профиль и включите системный прокси (System Proxy) или кнопку подключения.',
    v2rayn: 'Откройте v2rayN, вставьте ссылку подписки через «Подписка» → «Настройки подписок», нажмите «Обновить подписки» и выберите узел для подключения.',
    nekobox: 'Откройте NekoBox, обновите подписку через меню и нажмите круглую кнопку запуска внизу экрана.',
    v2rayng: 'Откройте v2rayNG, обновите подписку через верхнее меню и нажмите кнопку подключения с буквой V.',
    singbox: os === 'ios'
      ? 'Откройте sing-box MT, импортируйте профиль SilentConnect (кнопка вверху страницы сделает это автоматически) и нажмите кнопку включения (Dashboard → Start).'
      : 'Откройте Sing-box, импортируйте профиль SilentConnect (кнопка вверху страницы сделает это автоматически) и нажмите кнопку включения (Dashboard → Start).'
  };
  return map[appId] || 'Откройте приложение, добавьте подписку SilentConnect и нажмите кнопку подключения.';
}

function badgeClassOf(badge) {
  const b = (badge || '').toLowerCase();
  if (b.includes('ios') || b.includes('macos')) return 'badge-ios';
  if (b.includes('запас')) return 'badge-backup';
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
  return items.map(d => `
    <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
      ${d.icon === 'globe' ? '<span class="btn-globe" aria-hidden="true">🌐</span>' : `<img src="assets/stores/${d.icon}.webp" alt="" class="btn-store-icon">`}
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
        <img src="${icon}" alt="${name}" class="app-icon-img">
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
        <div class="step-btns"><a href="${importUrlFor(cur.id)}" class="btn btn-primary btn-sm" onclick="toast('Открываем ${title} и передаем профиль...');">Добавить подписку ⚡</a></div>
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
          <p>Если бесшовный переход не сработал: скопируйте зашифрованную ссылку ниже в буфер обмена и выберите пункт «Импорт из буфера обмена» (Import from Clipboard) в настройках приложения.</p>
        </div>
        <div class="step-btns"><button type="button" class="btn btn-ghost btn-sm" onclick="copyToClipboard('${SUB_IMPORT_URL}', 'Ссылка подписки скопирована!')">Скопировать ссылку 🔗</button></div>
        <input class="field mono-field" readonly value="${SUB_IMPORT_URL}" aria-label="Ссылка подписки" onclick="this.select()">
      </div>`;
  }
}
renderMainSetup();

/* =========================================================================
   6. ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ ПОДКЛЮЧЕНИЯ (Liquid Glass Segmented)
   ========================================================================= */
function setSubMode(mode) {
  if (!['main', 'awg', 'openflux'].includes(mode)) mode = 'main';
  S.subMode = mode;
  const idx = { main: 0, awg: 1, openflux: 2 }[mode];
  const seg = $('#modeSeg');
  if (seg) seg.style.setProperty('--i', idx);
  $$('#modeSeg .seg-btn').forEach(b => {
    b.setAttribute('aria-checked', String(b.dataset.subMode === mode));
  });

  ['main', 'awg', 'openflux'].forEach(m => {
    const sec = $('#subMode-' + m);
    if (sec) sec.hidden = m !== mode;
  });

  if (mode === 'main') renderMainSetup();
  else if (mode === 'awg') renderAwgSetup();
  else if (mode === 'openflux') renderOfSetup();
}
window.setSubMode = setSubMode;

$$('#modeSeg .seg-btn').forEach(b => {
  b.addEventListener('click', () => setSubMode(b.dataset.subMode));
});

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
    platforms: ['windows', 'android', 'macos'],
    description: 'Специализированная облегченная сборка на базе нативного клиента WireGuard с поддержкой заголовков обфускации Jc/Jmin/Jmax.',
    downloads: {
      android: [dl('Google Play', 'https://play.google.com/store/apps/details?id=org.amnezia.awg', 'googleplay')],
      windows: [dl('GitHub Релизы (.msi)', 'https://github.com/amnezia-vpn/amneziawg-windows-client/releases', 'github')],
      macos: [dl('App Store', 'https://apps.apple.com/app/amneziawg/id6478942364', 'appstore')]
    } }
];

const AWG_SERVERS = {
  nl: { code: 'nl', name: 'Нидерланды', city: 'Амстердам', flag: '🇳🇱', ping: 32 },
  pl: { code: 'pl', name: 'Польша', city: 'Варшава', flag: '🇵🇱', ping: 38 },
  fi: { code: 'fi', name: 'Финляндия', city: 'Хельсинки', flag: '🇫🇮', ping: 24 }
};

const AWG_SLOTS = [
  { id: 1, name: 'Рабочий MacBook', server: 'nl', ip: '10.8.0.2', active: true },
  { id: 2, name: 'iPhone 15 Pro', server: 'pl', ip: '10.8.0.3', active: true },
  { id: 3, name: 'Устройство 3 (Резерв)', server: 'fi', ip: '10.8.0.4', active: false }
];

function mockAwgConfig(slot) {
  const srv = AWG_SERVERS[slot.server] || AWG_SERVERS.nl;
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
Endpoint = edge.silentconnect.net:38421
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

  // Отрисовка слотов устройств в #awgSlotsGrid
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
            <span style="font-weight:700; color:#fff; font-size:15px; display:inline-flex; align-items:center; gap:6px;">
              <span>📱</span> <span id="slotNameText-${slot.id}">${slot.name}</span>
              <button type="button" class="btn-icon" style="font-size:12px; opacity:0.7; cursor:pointer;" title="Переименовать" onclick="promptRenameSlot(${slot.id})">✏️</button>
            </span>
            <span class="status ${slot.active ? 'ok' : 'wait'}"><i></i>${slot.active ? 'Активен' : 'Выключен'}</span>
          </div>
          <div style="margin-top:12px; font-size:13px; color:var(--mut); display:flex; justify-content:space-between;">
            <span>Шлюз: <b style="color:#fff;">${srv.flag} ${srv.name}</b></span>
            <span>IP: <code style="color:var(--em-t);">${slot.ip}</code></span>
          </div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:14px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="downloadSlotConf(${slot.id})">📥 .conf</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openSlotQrModal(${slot.id})">📱 QR-код</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="copySlotConf(${slot.id})">📋 Скопировать</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openAwgSwitchModal(${slot.id})">🔄 Сервер</button>
        </div>`;
      slotsCont.appendChild(card);
    });
  }

  // Отрисовка приложений для AWG
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
        <img src="${a.icon}" alt="${a.name}" class="app-icon-img">
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
            <div class="s-step-head"><span class="s-step-num">1</span><h4>Установка AmneziaVPN</h4></div>
            <p>${cur.description} Операционная система: ${OS_LABEL[S.osAwg]}.</p>
          </div>
          <div class="step-btns">${dlButtonsHtml(cur.downloads[S.osAwg] || [])}</div>
        </div>
        <div class="s-step">
          <div>
            <div class="s-step-head"><span class="s-step-num">2</span><h4>Импорт конфигурации</h4></div>
            <p>Скачайте <code>.conf</code> файл или отсканируйте QR-код любого из ваших слотов выше. AmneziaVPN автоматически создаст профиль подключения.</p>
          </div>
          <div class="step-btns"><button type="button" class="btn btn-primary btn-sm" onclick="downloadSlotConf(1)">Скачать слот 1 (.conf) ⚡</button></div>
        </div>
        <div class="s-step done">
          <div>
            <div class="s-step-head"><span class="s-step-num">3</span><h4>Запуск и проверка квоты</h4></div>
            <p>Нажмите большую круглую кнопку включения в AmneziaVPN. Трафик пойдет через выделенный шлюз со скоростью до 1 Гбит/с без задержек.</p>
          </div>
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
  copyToClipboard(mockAwgConfig(slot), `Конфигурация слота ${slot.id} скопирована!`);
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

  // Установка активного радио-баттона
  const radio = $(`input[name="awg_country"][value="${slot.server}"]`);
  if (radio) radio.checked = true;

  openModal('awgSwitchModal');
};

const awgApplyBtn = $('#awgApplySwitchBtn') || $('#awgSwitchModal .btn-primary');
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
        toast(`Слот переключен на ${srv.flag} ${srv.name}! Скачайте новый .conf`);
      }
    }
    closeAllModals();
  });
}

// Замер пинга
const pingBtn = $('#pingBtn');
if (pingBtn) {
  pingBtn.addEventListener('click', () => {
    toast('Измеряем сетевую задержку до узлов Европы...');
    ['pNl', 'pPl', 'pFi'].forEach(id => {
      const el = $('#' + id);
      if (el) el.textContent = '...';
    });
    setTimeout(() => {
      const pNl = $('#pNl'); if (pNl) pNl.textContent = (28 + Math.floor(Math.random() * 8)) + ' мс';
      const pPl = $('#pPl'); if (pPl) pPl.textContent = (22 + Math.floor(Math.random() * 6)) + ' мс';
      const pFi = $('#pFi'); if (pFi) pFi.textContent = (18 + Math.floor(Math.random() * 5)) + ' мс';
      toast('✓ Задержка обновлена');
    }, 450);
  });
}

/* =========================================================================
   8. РЕЖИМ 3: OPENFLUX (subjson-service/app.py whitelist-mode-container)
   ========================================================================= */
const OF_OS_LIST = OS_META.filter(o => ['ios', 'android', 'windows', 'macos', 'linux'].includes(o.id));
let ofTimerInterval = null;
let ofTimeRemaining = 288; // 4 мин 48 сек для демонстрации

function setOfState(state) {
  S.ofState = state;
  const inact = $('#ofInactive');
  const act = $('#ofActive');
  const mig = $('#ofMigrating');
  if (inact) inact.hidden = state !== 'inactive';
  if (act) act.hidden = state !== 'active';
  if (mig) mig.hidden = state !== 'migrating';

  $$('[data-of-state]').forEach(b => {
    b.classList.toggle('on', b.dataset.ofState === state);
  });

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

  if (state === 'migrating') {
    startOfHandoverTimer();
  } else {
    clearInterval(ofTimerInterval);
  }
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
          <div class="s-step-head"><span class="s-step-num">1</span><h4>Установка клиента OpenFlux</h4></div>
          <p>Специальный клиент для защищенных сессий Mail.ru Cloud Stream. Доступен для ${OS_LABEL[S.osOf]}.</p>
        </div>
        <div class="step-btns">
          <a href="https://github.com/openflux-stream/releases" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <img src="assets/stores/github.webp" alt="" class="btn-store-icon">
            <span>GitHub Релизы OpenFlux</span>
          </a>
        </div>
      </div>
      <div class="s-step">
        <div>
          <div class="s-step-head"><span class="s-step-num">2</span><h4>Импорт защищенного ключа</h4></div>
          <p>Нажмите «1-Click Подключить» или скопируйте ключ формата <code>openflux://v1/...</code> в буфер обмена.</p>
        </div>
        <div class="step-btns">
          <button type="button" class="btn btn-primary btn-sm" onclick="toast('Запуск OpenFlux с защищенным токеном...')">1-Click Подключить ⚡</button>
        </div>
      </div>
      <div class="s-step done">
        <div>
          <div class="s-step-head"><span class="s-step-num">3</span><h4>Непрерывная связь</h4></div>
          <p>Канал маскируется под совместный доступ к облачным документам, обеспечивая надежный обход даже самых строгих фильтраций Белых Списков.</p>
        </div>
      </div>`;
  }
}

$$('[data-of-state]').forEach(b => {
  b.addEventListener('click', () => setOfState(b.dataset.ofState));
});
$$('[data-set-of]').forEach(b => {
  b.addEventListener('click', () => setOfState(b.dataset.setOf));
});

// Открытие пикера OpenFlux (активация или смена страны)
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
if (ofConfirmBtn) {
  ofConfirmBtn.addEventListener('click', () => {
    openModal('ofConfirmModal');
  });
}
const ofFinalizeBtn = $('#ofFinalizeBtn');
if (ofFinalizeBtn) {
  ofFinalizeBtn.addEventListener('click', () => {
    S.ofCountry = S.ofTargetCountry;
    closeAllModals();
    setOfState('active');
    toast('✓ Переход на новый сервер успешно завершен! Старый сервер отключен.');
  });
}

setOfState('active');

/* =========================================================================
   9. АККОРДЕОН ПРОДЛЕНИЯ И ПРИВЯЗКИ ПОЧТЫ (1:1 с боевым сайтом)
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
  if (!S.emailBound) {
    // ВАЖНО: если почта ещё не привязана — раскрываем аккордеон по умолчанию!
    setRenewOpen(true);
    renewAcc.classList.add('warn-unbound');
    const badge = $('#renewEmailBadge');
    if (badge) {
      badge.className = 'status wait';
      badge.innerHTML = '<i></i>⚠️ Почта не привязана';
    }
    const alertBox = $('#emailUnboundAlert');
    if (alertBox) alertBox.hidden = false;
    const boundPill = $('#emailBoundPill');
    if (boundPill) boundPill.hidden = true;
  } else {
    renewAcc.classList.remove('warn-unbound');
    const badge = $('#renewEmailBadge');
    if (badge) {
      badge.className = 'status ok';
      badge.innerHTML = '<i></i>✓ Почта привязана';
    }
    const alertBox = $('#emailUnboundAlert');
    if (alertBox) alertBox.hidden = true;
    const boundPill = $('#emailBoundPill');
    if (boundPill) boundPill.hidden = false;
  }
}

function renderRenewCalculations() {
  $$('[data-r-dev]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.rDev) === S.renDev);
  });
  $$('[data-r-dur]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.rDur) === S.renMonths);
  });

  const price = CFG.prices[S.renDev][S.renMonths];
  const totalEl = $('#renTotal') || $('#renPrice');
  if (totalEl) totalEl.textContent = fmt(price) + ' ₽';
  const totalMo = $('#renTotalMo');
  if (totalMo) totalMo.textContent = `(~${fmt(Math.round(price / S.renMonths))} ₽/мес)`;
  const sumEl = $('#renSummary');
  if (sumEl) sumEl.textContent = `${CFG.names[S.renDev]} (${S.renDev} устр.) · +${CFG.days[S.renMonths]} дней`;

  const submitBtn = $('#renSubmitBtn');
  const submitText = $('#renSubmitText') || submitBtn;
  const selectors = $('#renewPlanSelectors');
  if (S.bindOnly) {
    if (submitText) submitText.textContent = 'Привязать почту ✓ (без оплаты · 0 ₽)';
    if (selectors) selectors.style.opacity = '0.35';
  } else {
    if (submitText) submitText.textContent = `Продлить подписку на ${CFG.full[S.renMonths]} · ${fmt(price)} ₽ ⚡`;
    if (selectors) selectors.style.opacity = '1';
  }
}

$$('[data-r-dev]').forEach(b => {
  b.addEventListener('click', () => {
    S.renDev = Number(b.dataset.rDev);
    renderRenewCalculations();
  });
});
$$('[data-r-dur]').forEach(b => {
  b.addEventListener('click', () => {
    S.renMonths = Number(b.dataset.rDur);
    renderRenewCalculations();
  });
});

if (bindEmailOnlyChk) {
  bindEmailOnlyChk.addEventListener('change', e => {
    S.bindOnly = e.target.checked;
    renderRenewCalculations();
  });
}

const renForm = $('#renewForm') || $('#renForm');
if (renForm) {
  renForm.addEventListener('submit', e => {
    e.preventDefault();
    const mailInput = $('#renewEmailInput') || $('#renEmail');
    const mail = (mailInput ? mailInput.value : '').trim();
    if (!mail || !mail.includes('@')) {
      toast('Укажите корректный адрес электронной почты');
      if (mailInput) mailInput.focus();
      return;
    }
    if (S.bindOnly) {
      S.emailBound = true;
      syncRenewEmailState();
      toast(`✓ Почта ${mail} успешно привязана к подписке!`);
      const boundLbl = $('#boundEmailLabel');
      if (boundLbl) boundLbl.textContent = mail;
    } else {
      toast('Создание счета на продление...');
      setTimeout(() => {
        setOrderState('waiting');
        view('order');
      }, 350);
    }
  });
}

const changeBoundEmailBtn = $('#changeBoundEmailBtn');
if (changeBoundEmailBtn) {
  changeBoundEmailBtn.addEventListener('click', () => {
    S.emailBound = false;
    syncRenewEmailState();
    const mailInput = $('#renewEmailInput') || $('#renEmail');
    if (mailInput) {
      mailInput.value = '';
      mailInput.focus();
    }
  });
}

syncRenewEmailState();
renderRenewCalculations();

/* =========================================================================
   10. МОДАЛЬНЫЕ ОКНА (QR-код, Переключение серверов, Пинг)
   ========================================================================= */
function openModal(modalId) {
  const m = $('#' + modalId);
  if (!m) return;
  m.classList.add('open');
  m.removeAttribute('hidden');
}
window.openModal = openModal;

function closeModal(modalId) {
  const m = $('#' + modalId);
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('hidden', '');
}
window.closeModal = closeModal;

function closeAllModals() {
  $$('.modal').forEach(m => {
    m.classList.remove('open');
    m.setAttribute('hidden', '');
  });
}
window.closeAllModals = closeAllModals;

$$('[data-close]').forEach(b => {
  b.addEventListener('click', closeAllModals);
});

$$('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) closeAllModals();
  });
});

function openQrModal(title, text) {
  const titleEl = $('#qrTitle');
  if (titleEl) titleEl.textContent = title;
  const subEl = $('#qrSub');
  if (subEl) subEl.textContent = text;
  const qrBox = $('#qrModal .qr');
  if (qrBox) renderSvgQr(text, qrBox, 180);
  openModal('qrModal');
}
window.openQrModal = openQrModal;

$$('[data-qr]').forEach(b => {
  b.addEventListener('click', () => {
    openQrModal(b.dataset.qr || 'QR-код', SUB_IMPORT_URL);
  });
});

// Кабинетная модалка
const cabOpenBtn = $('#cabinetOpenBtn') || $('[data-open-modal="cabinetModal"]');
if (cabOpenBtn) {
  cabOpenBtn.addEventListener('click', () => openModal('cabinetModal'));
}
const cabinetForm = $('#cabinetForm');
if (cabinetForm) {
  cabinetForm.addEventListener('submit', e => {
    e.preventDefault();
    closeAllModals();
    toast('Вход в личный кабинет выполнен!');
    view('cabinet');
  });
}

// Command palette
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openModal('cmdModal');
    const input = $('#cmdInput');
    if (input) setTimeout(() => input.focus(), 50);
  } else if (e.key === 'Escape') {
    closeAllModals();
  }
});

/* =========================================================================
   11. РАЗДЕЛ ЮРИДИЧЕСКОЙ ИНФОРМАЦИИ (view-legal)
   ========================================================================= */
const LEGAL_DOCS = {
  offer: {
    title: 'Публичная оферта',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Настоящий документ является публичной безотзывной офертой сервиса <b>SilentConnect</b> на заключение договора об оказании возмездных услуг по предоставлению защищенного сетевого доступа.</p>
      <h3>1. Предмет соглашения</h3>
      <p>Исполнитель обязуется предоставить Заказчику доступ к персональным конфигурациям маршрутизации трафика в рамках выбранного тарифного плана на условиях настоящей оферты.</p>
      <h3>2. Условия возврата денежных средств</h3>
      <p>Заказчик имеет безусловное право на полный возврат уплаченных средств в течение <b>14 календарных дней</b> с момента первичной оплаты при обращении в службу поддержки.</p>
      <h3>3. Ограничения использования</h3>
      <p>Запрещается использование сервиса для распространения вредоносного ПО, проведения сетевых атак (DDoS), рассылки спама и любых действий, нарушающих действующее законодательство.</p>`
  },
  privacy: {
    title: 'Политика конфиденциальности (No-Logs)',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Мы придерживаемся строгой архитектуры конфиденциальности <b>Zero-Knowledge & No-Logs</b>. Ваша сетевая активность принадлежит исключительно вам.</p>
      <h3>1. Что мы не собираем</h3>
      <p>Мы <b>никогда не записываем и не храним</b>: посещенные вами сайты, DNS-запросы, передаваемый контент, IP-адреса назначения и метаданные сессий.</p>
      <h3>2. Что хранится в учетной записи</h3>
      <p>Для функционирования подписки хранится исключительно: указанный вами адрес электронной почты (для отправки чеков и напоминаний), дата окончания оплаченного периода и объем использованного скоростного трафика AmneziaWG.</p>`
  },
  referral: {
    title: 'Партнерская программа',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Приглашайте друзей и получайте постоянные отчисления с каждого платежа и продления.</p>
      <h3>1. Вознаграждение</h3>
      <p>Вы получаете <b>10% пожизненных отчислений</b> со всех оплат приглашенных пользователей. Приглашенный друг получает <b>скидку 10%</b> на свой первый заказ.</p>
      <h3>2. Вывод средств</h3>
      <p>Выплаты производятся по запросу на карты РФ (СБП), ЮMoney или в счет оплаты собственной подписки SilentConnect.</p>`
  },
  refund: {
    title: 'Правила возврата средств',
    date: 'Редакция от 15 октября 2026 г.',
    html: `
      <p>Мы уверены в надежности нашего сервиса и гарантируем прозрачные условия возврата.</p>
      <h3>1. Гарантия 14 дней</h3>
      <p>Если сервис не подошел вам по скорости, совместимости или любой другой причине — напишите в нашу поддержку в течение 14 дней. Возврат осуществляется в полном объеме без скрытых комиссий.</p>`
  }
};

function showLegalDoc(docId) {
  if (!LEGAL_DOCS[docId]) docId = 'offer';
  const doc = LEGAL_DOCS[docId];
  $$('#legalNav button').forEach(b => {
    b.classList.toggle('on', b.dataset.doc === docId);
  });
  const container = $('#legalDoc');
  if (container) {
    container.innerHTML = `
      <h2>${doc.title}</h2>
      <div class="date">${doc.date}</div>
      ${doc.html}`;
  }
  const nav = $('#legalNav');
  if (nav) centerActiveTab(nav);
}
window.showLegalDoc = showLegalDoc;

const legalNav = $('#legalNav');
if (legalNav) {
  setupDraggableTrack(legalNav);
  $$('#legalNav button').forEach(b => {
    b.addEventListener('click', () => {
      showLegalDoc(b.dataset.doc);
    });
  });
}
showLegalDoc('offer');

})();
