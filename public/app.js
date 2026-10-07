// Daily Calories: snap a meal, review the estimate, log it, see the day.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- i18n ----------

const LANG = (navigator.language || 'en').toLowerCase().startsWith('ro') ? 'ro' : 'en';
const LOCALE = LANG === 'ro' ? 'ro-RO' : 'en-US';
const STR = {
  en: {
    today: 'Today', yesterday: 'Yesterday', kcal: 'kcal', ofGoal: 'of {goal}',
    left: '<b>{n}</b> kcal left', over: '<b>{n}</b> kcal over goal',
    protein: 'Protein', carbs: 'Carbs', fat: 'Fat', meals: 'Meals',
    noMeals: 'Nothing logged yet', noMealsHint: 'Tap “Snap meal” and take a photo of your plate.',
    snap: 'Snap meal', typeIt: 'Type what you ate', gallery: 'Choose from photos',
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
    newMeal: 'New meal', editMeal: 'Edit meal',
    looking: 'Looking at your plate…', lookingHint: 'This takes a few seconds.',
    notFood: 'I couldn’t find food in this photo. Try another photo, or type what you ate below.',
    addPlaceholder: 'Add food, e.g. “1 apple”', add: 'Add', adding: '…',
    logMeal: 'Log meal · {n} kcal', saveMeal: 'Save · {n} kcal',
    logged: 'Meal logged ✓', undo: 'Undo', removed: 'Removed {name}', savedChanges: 'Changes saved ✓',
    check: 'check', maybe: 'Not right? It could also be:',
    deleteMeal: 'Delete this meal', confirmDelete: 'Delete this meal?', deleted: 'Meal deleted',
    discard: 'Discard this meal?', emptyItems: 'No foods yet. Add what you ate below.',
    history: 'Last 14 days', avg: 'Average: <b>{n}</b> kcal per day', noData: 'Nothing logged in the last 14 days.',
    settings: 'Settings', goal: 'Daily calorie goal', save: 'Save', goalSaved: 'Goal saved ✓',
    disconnect: 'Disconnect this phone', disconnectConfirm: 'Disconnect this phone? You will need the access code again.',
    installHint: 'Tip: add this app to your Home Screen for one-tap access. iPhone: Share → “Add to Home Screen”. Android: menu ⋮ → “Add to Home screen”.',
    enrollTitle: 'Daily Calories', enrollText: 'Enter the access code to start.', code: 'Access code', start: 'Start',
    offlineSaved: 'No connection. Saved on the phone — it will sync automatically.',
    close: 'Close', prevDay: 'Previous day', nextDay: 'Next day', retry: 'Try again', loadFailed: 'Could not load. Check the connection.',
    err_network: 'No internet connection. Try again.',
    err_daily_limit: 'Daily photo limit reached. You can still type what you ate.',
    err_ai_unavailable: 'The food recognition service is busy. Try again in a moment.',
    err_refused: 'This photo could not be analyzed. Try another photo.',
    err_invalid_code: 'That code is not correct.', err_device_limit: 'The maximum number of phones is already connected.',
    err_too_many_attempts: 'Too many attempts. Wait 15 minutes.', err_server_not_configured: 'The server is not set up yet (missing access code).',
    err_generic: 'Something went wrong. Try again.',
  },
  ro: {
    today: 'Azi', yesterday: 'Ieri', kcal: 'kcal', ofGoal: 'din {goal}',
    left: 'Mai ai <b>{n}</b> kcal', over: '<b>{n}</b> kcal peste țintă',
    protein: 'Proteine', carbs: 'Carbohidrați', fat: 'Grăsimi', meals: 'Mese',
    noMeals: 'Nimic înregistrat încă', noMealsHint: 'Apasă „Fotografiază masa” și fă o poză farfuriei.',
    snap: 'Fotografiază masa', typeIt: 'Scrie ce ai mâncat', gallery: 'Alege din poze',
    breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustare',
    newMeal: 'Masă nouă', editMeal: 'Modifică masa',
    looking: 'Mă uit la farfurie…', lookingHint: 'Durează câteva secunde.',
    notFood: 'Nu am găsit mâncare în poză. Încearcă altă poză sau scrie mai jos ce ai mâncat.',
    addPlaceholder: 'Adaugă, ex. „1 măr”', add: 'Adaugă', adding: '…',
    logMeal: 'Salvează masa · {n} kcal', saveMeal: 'Salvează · {n} kcal',
    logged: 'Masă salvată ✓', undo: 'Anulează', removed: 'Ai scos {name}', savedChanges: 'Modificări salvate ✓',
    check: 'verifică', maybe: 'Nu e corect? Ar putea fi și:',
    deleteMeal: 'Șterge masa', confirmDelete: 'Ștergi această masă?', deleted: 'Masă ștearsă',
    discard: 'Renunți la această masă?', emptyItems: 'Niciun aliment încă. Adaugă mai jos ce ai mâncat.',
    history: 'Ultimele 14 zile', avg: 'Media: <b>{n}</b> kcal pe zi', noData: 'Nimic înregistrat în ultimele 14 zile.',
    settings: 'Setări', goal: 'Ținta zilnică de calorii', save: 'Salvează', goalSaved: 'Țintă salvată ✓',
    disconnect: 'Deconectează acest telefon', disconnectConfirm: 'Deconectezi telefonul? Vei avea nevoie din nou de cod.',
    installHint: 'Sfat: adaugă aplicația pe ecranul principal. iPhone: Partajare → „Adaugă pe ecranul principal”. Android: meniul ⋮ → „Adaugă pe ecranul de pornire”.',
    enrollTitle: 'Calorii zilnice', enrollText: 'Introdu codul de acces ca să începi.', code: 'Cod de acces', start: 'Începe',
    offlineSaved: 'Fără conexiune. Salvat pe telefon — se sincronizează automat.',
    close: 'Închide', prevDay: 'Ziua anterioară', nextDay: 'Ziua următoare', retry: 'Încearcă din nou', loadFailed: 'Nu s-a putut încărca. Verifică internetul.',
    err_network: 'Nu există internet. Încearcă din nou.',
    err_daily_limit: 'Ai atins limita de poze pe azi. Poți scrie ce ai mâncat.',
    err_ai_unavailable: 'Serviciul de recunoaștere e ocupat. Încearcă puțin mai târziu.',
    err_refused: 'Poza nu a putut fi analizată. Încearcă altă poză.',
    err_invalid_code: 'Codul nu este corect.', err_device_limit: 'Numărul maxim de telefoane este deja conectat.',
    err_too_many_attempts: 'Prea multe încercări. Așteaptă 15 minute.', err_server_not_configured: 'Serverul nu este configurat (lipsește codul).',
    err_generic: 'Ceva n-a mers. Încearcă din nou.',
  },
};
const t = (key, vars = {}) =>
  (STR[LANG][key] ?? STR.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// ---------- storage (never trusted to exist) ----------

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- API ----------

class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

let token = store.get('token');

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  if (res.status === 401 && path !== '/enroll') {
    token = null;
    store.del('token');
    closeSheet();
    renderEnroll();
    throw new ApiError('unauthorized', 401);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'generic', res.status);
  return data;
}

const errText = (e) => STR[LANG][`err_${e?.code}`] || STR.en[`err_${e?.code}`] ? t(`err_${e.code}`) : t('err_generic');

// ---------- dates & numbers ----------

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
const fmt = (n) => Math.round(n).toLocaleString(LOCALE);

function dayLabel(s) {
  const today = dateStr();
  if (s === today) return t('today');
  if (s === addDays(today, -1)) return t('yesterday');
  return parseDate(s).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

function mealTypeForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4.5 && h < 10.5) return 'breakfast';
  if (h >= 11.5 && h < 15.5) return 'lunch';
  if (h >= 18 && h < 22) return 'dinner';
  return 'snack';
}

const MEAL_ICON = { breakfast: '🍳', lunch: '🍲', dinner: '🍽️', snack: '🍎' };
const itemKcal = (it) => (it.grams * it.kcal_100g) / 100;
function sumItems(items) {
  return items.reduce(
    (a, it) => ({
      kcal: a.kcal + itemKcal(it),
      protein: a.protein + (it.grams * it.protein_100g) / 100,
      carbs: a.carbs + (it.grams * it.carbs_100g) / 100,
      fat: a.fat + (it.grams * it.fat_100g) / 100,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// ---------- toast ----------

let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) {
    el.querySelector('button').onclick = () => { el.hidden = true; action.run(); };
  }
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3000);
}

// ---------- app state ----------

const app = $('#app');
const sheetRoot = $('#sheet-root');
const state = { date: dateStr(), day: null, me: null, loadError: false };

// ---------- enrollment ----------

function renderEnroll() {
  app.innerHTML = `
    <section class="enroll">
      <img class="logo" src="/icons/icon-192.png" alt="">
      <h1>${t('enrollTitle')}</h1>
      <p>${t('enrollText')}</p>
      <form id="enroll-form" autocomplete="off">
        <input class="field" name="code" placeholder="${t('code')}" autocapitalize="off" autocorrect="off" spellcheck="false" required>
        <button class="btn btn-primary btn-block" type="submit">${t('start')}</button>
        <div class="error" id="enroll-error"></div>
      </form>
    </section>`;
  $('#enroll-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const res = await api('POST', '/enroll', {
        code: e.target.code.value.trim(),
        deviceName: navigator.userAgent.slice(0, 80),
      });
      token = res.token;
      store.set('token', token);
      start();
    } catch (err) {
      $('#enroll-error').textContent = errText(err);
      btn.disabled = false;
    }
  };
}

// ---------- day view ----------

async function loadDay() {
  state.loadError = false;
  try {
    const [day, me] = await Promise.all([api('GET', `/days/${state.date}`), state.me ? state.me : api('GET', '/me')]);
    state.day = day;
    state.me = me;
  } catch (e) {
    if (e.code === 'unauthorized') return;
    state.loadError = true;
  }
  renderDay();
}

function ring(kcal, goal) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(kcal / goal, 1) : 0;
  return `
    <div class="ring ${kcal > goal ? 'over' : ''}">
      <svg viewBox="0 0 150 150" aria-hidden="true">
        <circle class="track" cx="75" cy="75" r="${r}" fill="none" stroke-width="13"/>
        <circle class="value" cx="75" cy="75" r="${r}" fill="none" stroke-width="13" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/>
      </svg>
      <div class="ring-label"><strong>${fmt(kcal)}</strong><span>${t('ofGoal', { goal: fmt(goal) })} ${t('kcal')}</span></div>
    </div>`;
}

function macroBar(cls, label, grams, target) {
  const pct = target > 0 ? Math.min((grams / target) * 100, 100) : 0;
  return `<div class="macro"><div class="macro-row"><span>${label}</span><b>${fmt(grams)} g</b></div>
    <div class="bar ${cls}"><i style="width:${pct}%"></i></div></div>`;
}

function renderDay() {
  const isToday = state.date === dateStr();
  const tot = state.day?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const goal = state.me?.goalKcal || 2000;
  const diff = goal - tot.kcal;
  const meals = state.day?.meals || [];

  let list;
  if (state.loadError) {
    list = `<div class="empty"><p>${t('loadFailed')}</p><button class="btn btn-secondary" data-act="reload">${t('retry')}</button></div>`;
  } else if (!state.day) {
    list = '<div class="skeleton"></div><div class="skeleton"></div>';
  } else if (!meals.length) {
    list = `<div class="empty"><div class="big">🍽️</div><b>${t('noMeals')}</b><p class="hint">${t('noMealsHint')}</p></div>`;
  } else {
    list = meals.map((m) => {
      const time = new Date(m.eaten_at).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
      const names = m.items.map((i) => i.name).join(', ');
      const thumb = m.thumbnail
        ? `<img class="thumb" src="${esc(m.thumbnail)}" alt="">`
        : `<div class="thumb">${MEAL_ICON[m.meal_type] || '🍽️'}</div>`;
      return `<button class="meal" data-act="open-meal" data-id="${esc(m.id)}">
        ${thumb}
        <div class="meal-body">
          <div class="top"><span class="type">${t(m.meal_type)} <span class="hint">· ${time}</span></span><span class="kcal">${fmt(m.kcal)} kcal</span></div>
          <div class="names">${esc(names)}</div>
        </div></button>`;
    }).join('');
  }

  app.innerHTML = `
    <header class="topbar">
      <div class="datenav">
        <button class="icon-btn" data-act="prev" aria-label="${t('prevDay')}">‹</button>
        <h1>${esc(dayLabel(state.date))}</h1>
        <button class="icon-btn" data-act="next" aria-label="${t('nextDay')}" ${isToday ? 'disabled' : ''}>›</button>
      </div>
      <div class="top-actions">
        <button class="icon-btn" data-act="history" aria-label="${t('history')}">📅</button>
        <button class="icon-btn" data-act="settings" aria-label="${t('settings')}">⚙️</button>
      </div>
    </header>
    <section class="card summary">
      ${ring(tot.kcal, goal)}
      <div>
        <div class="remaining ${diff < 0 ? 'over-text' : ''}">${diff >= 0 ? t('left', { n: fmt(diff) }) : t('over', { n: fmt(-diff) })}</div>
        ${macroBar('p', t('protein'), tot.protein, (goal * 0.2) / 4)}
        ${macroBar('c', t('carbs'), tot.carbs, (goal * 0.5) / 4)}
        ${macroBar('f', t('fat'), tot.fat, (goal * 0.3) / 9)}
      </div>
    </section>
    <h2 class="section-title">${t('meals')}</h2>
    ${list}
    <div class="dock"><div class="dock-inner">
      <button class="btn btn-primary btn-camera" data-act="camera"><span class="ico">📷</span>${t('snap')}</button>
      <button class="btn btn-secondary btn-round" data-act="gallery" aria-label="${t('gallery')}">🖼️</button>
      <button class="btn btn-secondary btn-round" data-act="type" aria-label="${t('typeIt')}">✏️</button>
    </div></div>`;
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'prev' || act === 'next') {
    state.date = addDays(state.date, act === 'prev' ? -1 : 1);
    state.day = null;
    renderDay();
    loadDay();
  } else if (act === 'reload') {
    loadDay();
  } else if (act === 'camera') {
    $('#camera-input').click();
  } else if (act === 'gallery') {
    $('#gallery-input').click();
  } else if (act === 'type') {
    openReview(newDraft(), { focusAdd: true });
  } else if (act === 'open-meal') {
    const meal = state.day?.meals.find((m) => m.id === el.dataset.id);
    if (meal) openReview(draftFromMeal(meal));
  } else if (act === 'history') {
    openHistory();
  } else if (act === 'settings') {
    openSettings();
  }
});

for (const id of ['#camera-input', '#gallery-input']) {
  $(id).addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) startPhotoAnalysis(file);
  });
}

// ---------- images ----------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ApiError('invalid_image', 0)); };
    img.src = url;
  });
}

function drawScaled(img, maxEdge, quality, square) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  if (square) {
    const side = Math.min(w, h);
    canvas.width = canvas.height = maxEdge;
    canvas.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, maxEdge, maxEdge);
  } else {
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/jpeg', quality);
}

// ---------- review sheet (new or existing meal) ----------

let draft = null;

function newDraft() {
  const viewingToday = state.date === dateStr();
  return {
    mealId: null,
    analysisId: null,
    date: state.date,
    eatenAt: viewingToday ? Date.now() : parseDate(state.date).setHours(12, 0, 0, 0),
    mealType: viewingToday ? mealTypeForNow() : 'snack',
    items: [],
    thumbnail: null,
    photoUrl: null,
    loading: false,
    error: null,
    notes: '',
    addText: '',
    adding: false,
    saving: false,
    idempotencyKey: uuid(),
  };
}

function itemFromAi(it) {
  return {
    key: uuid(),
    name: it.name,
    portion: it.portion,
    grams: it.grams,
    baseGrams: it.grams || 100,
    kcal_100g: it.kcal_100g,
    protein_100g: it.protein_100g,
    carbs_100g: it.carbs_100g,
    fat_100g: it.fat_100g,
    confidence: it.confidence,
    alternatives: it.alternatives || [],
    showAlts: it.confidence === 'low' && (it.alternatives || []).length > 0,
    ai_name: it.name,
    ai_grams: it.grams,
  };
}

function draftFromMeal(m) {
  return {
    ...newDraft(),
    mealId: m.id,
    analysisId: m.analysis_id,
    date: m.local_date,
    eatenAt: m.eaten_at,
    mealType: m.meal_type,
    thumbnail: m.thumbnail,
    photoUrl: m.thumbnail,
    items: m.items.map((i) => ({
      ...i,
      key: uuid(),
      baseGrams: i.grams,
      alternatives: [],
      showAlts: false,
    })),
  };
}

async function startPhotoAnalysis(file) {
  const d = newDraft();
  d.loading = true;
  openReview(d);
  try {
    const { img, url } = await loadImage(file);
    d.photoUrl = url;
    renderReview();
    const image = drawScaled(img, 1280, 0.82, false);
    d.thumbnail = drawScaled(img, 160, 0.7, true);
    const res = await api('POST', '/analyses', { image, lang: LANG });
    d.analysisId = res.id;
    d.notes = res.notes;
    d.items = res.items.map(itemFromAi);
    if (!res.is_food) d.error = t('notFood');
  } catch (e) {
    if (e.code === 'unauthorized') return;
    d.error = errText(e);
  }
  d.loading = false;
  if (draft === d) renderReview();
}

function openReview(d, { focusAdd = false } = {}) {
  draft = d;
  sheetRoot.innerHTML = `
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <h2 id="sheet-title"></h2>
          <button class="icon-btn" data-act="close" aria-label="${t('close')}">✕</button>
        </div>
        <div class="sheet-body"></div>
        <div class="sheet-foot"></div>
      </div>
    </div>`;
  const sheet = $('.sheet', sheetRoot);
  sheet.addEventListener('click', onReviewClick);
  sheet.addEventListener('change', onReviewChange);
  sheet.addEventListener('input', (e) => { if (e.target.name === 'add') draft.addText = e.target.value; });
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.name === 'add') { e.preventDefault(); addTypedFood(); }
  });
  renderReview();
  if (focusAdd) setTimeout(() => $('input[name="add"]', sheetRoot)?.focus(), 250);
}

function closeSheet() {
  if (draft?.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.photoUrl);
  draft = null;
  sheetRoot.innerHTML = '';
}

function renderReview() {
  const d = draft;
  if (!d) return;
  const body = $('.sheet-body', sheetRoot);
  const scroll = body.scrollTop;
  const tot = sumItems(d.items);
  $('#sheet-title').textContent = d.mealId ? t('editMeal') : t('newMeal');

  const photo = d.photoUrl ? `<img class="photo" src="${esc(d.photoUrl)}" alt="">` : '';
  let content;
  if (d.loading) {
    content = `<div class="loading"><div class="spinner"></div><b>${t('looking')}</b><div class="hint">${t('lookingHint')}</div></div>
      <div class="skeleton"></div><div class="skeleton"></div>`;
  } else {
    const items = d.items.map((it, i) => {
      const alts = it.showAlts && it.alternatives.length
        ? `<div class="alts"><p>${t('maybe')}</p>${it.alternatives
            .map((a, j) => `<button class="chip" data-act="alt" data-i="${i}" data-j="${j}">${esc(a.name)}</button>`).join('')}</div>`
        : '';
      const badge = it.confidence === 'low' ? `<span class="badge">${t('check')}</span>` : '';
      return `<div class="item">
        <div class="item-top">
          <button class="item-name" data-act="toggle-alts" data-i="${i}">${esc(it.name)}${badge}
            <small>${esc(it.portion || '')}</small></button>
          <span class="item-kcal">${fmt(itemKcal(it))} kcal</span>
          <button class="icon-btn remove" data-act="remove" data-i="${i}" aria-label="✕">✕</button>
        </div>
        <div class="stepper">
          <button data-act="dec" data-i="${i}" aria-label="−">−</button>
          <label class="grams"><input name="grams" data-i="${i}" type="number" inputmode="numeric" min="1" max="5000" value="${Math.round(it.grams)}"><span>g</span></label>
          <button data-act="inc" data-i="${i}" aria-label="+">+</button>
        </div>
        ${alts}
      </div>`;
    }).join('');

    content = `
      ${d.error ? `<div class="notes">${esc(d.error)}</div>` : ''}
      ${d.items.length ? `<div class="totals">
          <div class="k"><b>${fmt(tot.kcal)}</b><span>kcal</span></div>
          <div><b>${fmt(tot.protein)}</b><span>${t('protein')} g</span></div>
          <div><b>${fmt(tot.carbs)}</b><span>${t('carbs')} g</span></div>
          <div><b>${fmt(tot.fat)}</b><span>${t('fat')} g</span></div>
        </div>` : ''}
      ${d.notes ? `<div class="notes">${esc(d.notes)}</div>` : ''}
      <div class="chips" role="group">
        ${['breakfast', 'lunch', 'dinner', 'snack'].map((mt) =>
          `<button class="chip" data-act="type" data-type="${mt}" aria-pressed="${d.mealType === mt}">${t(mt)}</button>`).join('')}
      </div>
      ${items || (d.error ? '' : `<p class="hint">${t('emptyItems')}</p>`)}
      <div class="add-row">
        <input class="field" name="add" placeholder="${esc(t('addPlaceholder'))}" value="${esc(d.addText)}" enterkeyhint="done" ${d.adding ? 'disabled' : ''}>
        <button class="btn btn-secondary" data-act="add" ${d.adding ? 'disabled' : ''}>${d.adding ? t('adding') : t('add')}</button>
      </div>
      ${d.mealId ? `<p style="margin-top:28px"><button class="btn btn-danger btn-block" data-act="delete">${t('deleteMeal')}</button></p>` : ''}`;
  }
  body.innerHTML = photo + (photo ? '<div style="height:12px"></div>' : '') + content;
  body.scrollTop = scroll;

  const label = d.mealId ? t('saveMeal', { n: fmt(tot.kcal) }) : t('logMeal', { n: fmt(tot.kcal) });
  $('.sheet-foot', sheetRoot).innerHTML =
    `<button class="btn btn-primary btn-block" data-act="log" ${d.loading || d.saving || !d.items.length ? 'disabled' : ''}>${label}</button>`;
}

function stepFor(it) {
  return Math.max(5, Math.round((it.baseGrams * 0.25) / 5) * 5);
}

function onReviewClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !draft) return;
  const d = draft;
  const i = Number(el.dataset.i);
  const it = d.items[i];
  switch (el.dataset.act) {
    case 'close':
      if (!d.mealId && d.items.length && !confirm(t('discard'))) return;
      closeSheet();
      return;
    case 'type':
      d.mealType = el.dataset.type;
      break;
    case 'inc':
      it.grams = Math.min(5000, it.grams + stepFor(it));
      break;
    case 'dec':
      it.grams = Math.max(5, it.grams - stepFor(it));
      break;
    case 'toggle-alts':
      it.showAlts = !it.showAlts;
      break;
    case 'alt': {
      const alt = it.alternatives[Number(el.dataset.j)];
      const previous = { name: it.name, kcal_100g: it.kcal_100g, protein_100g: it.protein_100g, carbs_100g: it.carbs_100g, fat_100g: it.fat_100g };
      it.alternatives[Number(el.dataset.j)] = previous;
      Object.assign(it, alt, { confidence: 'high', showAlts: false });
      break;
    }
    case 'remove': {
      const [removed] = d.items.splice(i, 1);
      toast(t('removed', { name: removed.name }), {
        label: t('undo'),
        run: () => { if (draft === d) { d.items.splice(i, 0, removed); renderReview(); } },
      });
      break;
    }
    case 'add':
      addTypedFood();
      return;
    case 'log':
      saveDraft();
      return;
    case 'delete':
      deleteMeal(d.mealId);
      return;
    default:
      return;
  }
  renderReview();
}

function onReviewChange(e) {
  if (e.target.name !== 'grams' || !draft) return;
  const it = draft.items[Number(e.target.dataset.i)];
  const v = Number(e.target.value);
  if (it && Number.isFinite(v) && v > 0) it.grams = Math.min(5000, Math.round(v));
  renderReview();
}

async function addTypedFood() {
  const d = draft;
  const text = d.addText.trim();
  if (!text || d.adding) return;
  d.adding = true;
  renderReview();
  try {
    const res = await api('POST', '/analyses', { text, lang: LANG });
    // Typed foods are user-provided, not photo recognition: don't count them as AI corrections.
    d.items.push(...res.items.map((x) => ({ ...itemFromAi(x), ai_name: null, ai_grams: null })));
    d.addText = '';
    if (res.items.length) d.error = null;
  } catch (e) {
    if (e.code === 'unauthorized') return;
    toast(errText(e));
  }
  d.adding = false;
  if (draft === d) {
    renderReview();
    $('.sheet-body', sheetRoot).scrollTop = 1e6;
  }
}

function mealPayload(d) {
  return {
    analysisId: d.analysisId,
    mealType: d.mealType,
    localDate: d.date,
    eatenAt: d.eatenAt,
    tzOffsetMin: -new Date(d.eatenAt).getTimezoneOffset(),
    thumbnail: d.thumbnail,
    idempotencyKey: d.idempotencyKey,
    items: d.items.map((it) => ({
      name: it.name, portion: it.portion, grams: it.grams,
      kcal_100g: it.kcal_100g, protein_100g: it.protein_100g, carbs_100g: it.carbs_100g, fat_100g: it.fat_100g,
      ai_name: it.ai_name ?? null, ai_grams: it.ai_grams ?? null,
    })),
  };
}

async function saveDraft() {
  const d = draft;
  d.saving = true;
  renderReview();
  const payload = mealPayload(d);
  try {
    if (d.mealId) {
      await api('PUT', `/meals/${d.mealId}`, payload);
      closeSheet();
      toast(t('savedChanges'));
    } else {
      const meal = await api('POST', '/meals', payload);
      closeSheet();
      toast(t('logged'), {
        label: t('undo'),
        run: async () => { await api('DELETE', `/meals/${meal.id}`).catch(() => {}); loadDay(); },
      });
    }
    if (navigator.vibrate) navigator.vibrate(30);
    loadDay();
  } catch (e) {
    if (e.code === 'unauthorized') return;
    if (e.code === 'network' && !d.mealId) {
      outbox.add(payload);
      closeSheet();
      toast(t('offlineSaved'));
      return;
    }
    d.saving = false;
    toast(errText(e));
    if (draft === d) renderReview();
  }
}

async function deleteMeal(id) {
  if (!confirm(t('confirmDelete'))) return;
  try {
    await api('DELETE', `/meals/${id}`);
    closeSheet();
    toast(t('deleted'));
    loadDay();
  } catch (e) {
    if (e.code !== 'unauthorized') toast(errText(e));
  }
}

// ---------- offline outbox for logged meals ----------

const outbox = {
  read() { try { return JSON.parse(store.get('outbox') || '[]'); } catch { return []; } },
  write(list) { store.set('outbox', JSON.stringify(list)); },
  add(payload) { this.write([...this.read(), payload]); },
  async flush() {
    const pending = this.read();
    if (!pending.length || !token) return;
    const remaining = [];
    for (const p of pending) {
      try {
        await api('POST', '/meals', p);
      } catch (e) {
        if (e.code === 'network' || e.status >= 500) remaining.push(p); // retry later; drop invalid ones
      }
    }
    this.write(remaining);
    if (remaining.length < pending.length) loadDay();
  },
};
window.addEventListener('online', () => outbox.flush());

// ---------- history sheet ----------

async function openHistory() {
  openSimpleSheet(t('history'), '<div class="skeleton"></div><div class="skeleton"></div>');
  const to = dateStr();
  const from = addDays(to, -13);
  let days;
  try {
    days = (await api('GET', `/summary?from=${from}&to=${to}`)).days;
  } catch (e) {
    if (e.code !== 'unauthorized') $('.sheet-body', sheetRoot).innerHTML = `<p class="empty">${t('loadFailed')}</p>`;
    return;
  }
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const goal = state.me?.goalKcal || 2000;
  const max = Math.max(goal * 1.25, ...days.map((d) => d.kcal));
  const logged = days.filter((d) => d.kcal > 0);
  const avg = logged.length ? logged.reduce((a, d) => a + d.kcal, 0) / logged.length : 0;
  let rows = '';
  for (let i = 0; i < 14; i++) {
    const date = addDays(to, -i);
    const kcal = byDate[date]?.kcal || 0;
    rows += `<button class="day ${kcal > goal ? 'over' : ''}" data-date="${date}">
      <span>${esc(dayLabel(date))}</span>
      <div class="bar"><i style="width:${(kcal / max) * 100}%"></i></div>
      <b>${kcal ? fmt(kcal) : '–'}</b></button>`;
  }
  $('.sheet-body', sheetRoot).innerHTML =
    (logged.length ? `<p class="avg">${t('avg', { n: fmt(avg) })}</p>` : `<p class="avg">${t('noData')}</p>`) + rows;
  $('.sheet-body', sheetRoot).onclick = (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    state.date = b.dataset.date;
    state.day = null;
    closeSheet();
    renderDay();
    loadDay();
  };
}

// ---------- settings sheet ----------

function openSettings() {
  const goal = state.me?.goalKcal || 2000;
  openSimpleSheet(t('settings'), `
    <label class="label" for="goal">${t('goal')}</label>
    <div class="stepper">
      <button data-step="-50" aria-label="−">−</button>
      <label class="grams"><input id="goal" type="number" inputmode="numeric" min="800" max="6000" step="50" value="${goal}"><span>kcal</span></label>
      <button data-step="50" aria-label="+">+</button>
    </div>
    <p><button class="btn btn-primary btn-block" id="save-goal">${t('save')}</button></p>
    <p class="hint">${t('installHint')}</p>
    <p style="margin-top:32px"><button class="btn btn-danger btn-block" id="disconnect">${t('disconnect')}</button></p>`);
  const body = $('.sheet-body', sheetRoot);
  body.onclick = async (e) => {
    const step = e.target.closest('[data-step]');
    const input = $('#goal', body);
    if (step) {
      input.value = Math.min(6000, Math.max(800, Number(input.value) + Number(step.dataset.step)));
    } else if (e.target.id === 'save-goal') {
      try {
        const goalKcal = Math.round(Number(input.value));
        await api('PATCH', '/me', { goalKcal });
        state.me = { ...state.me, goalKcal };
        closeSheet();
        toast(t('goalSaved'));
        renderDay();
      } catch (err) {
        if (err.code !== 'unauthorized') toast(errText(err));
      }
    } else if (e.target.id === 'disconnect') {
      if (!confirm(t('disconnectConfirm'))) return;
      token = null;
      store.del('token');
      closeSheet();
      renderEnroll();
    }
  };
}

function openSimpleSheet(title, html) {
  draft = null;
  sheetRoot.innerHTML = `
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-head"><h2>${esc(title)}</h2>
          <button class="icon-btn" data-act="close-simple" aria-label="${t('close')}">✕</button></div>
        <div class="sheet-body">${html}</div>
      </div>
    </div>`;
  $('[data-act="close-simple"]', sheetRoot).onclick = closeSheet;
}

// Tapping the dimmed area closes simple sheets (not the review, to avoid losing a meal).
sheetRoot.addEventListener('click', (e) => {
  if (e.target.classList.contains('sheet-backdrop') && !draft) closeSheet();
});

// ---------- start ----------

function start() {
  if (!token) return renderEnroll();
  state.date = dateStr();
  state.day = null;
  renderDay();
  loadDay();
  outbox.flush();
}

// Coming back to the app on a new day should show the new day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && token && !sheetRoot.innerHTML && state.date !== dateStr()) start();
});

document.documentElement.lang = LANG;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
start();
