// Daily Calories: snap a meal, review the estimate, log it, see the day.
import { computeTargets, macroTargets, ACTIVITY_FACTORS } from './targets.js';
import { FOODS, CATEGORIES, foodsInCategory, searchFoods, fold } from './foods.js';
import { parsePortion, unitLabel, unitCount, stepCount } from './units.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- i18n ----------

// Romanian unless the user picked English with the language button.
let LANG = 'ro';
let LOCALE = 'ro-RO';
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
    ob_title: 'Your daily calories', ob_intro: 'A few quick questions so the app can estimate how much you should eat each day.',
    ob_sex: 'You are', male: 'Man', female: 'Woman',
    ob_body: 'About you', age: 'Age', years: 'years', height: 'Height', weight: 'Weight',
    ob_activity: 'How active are you?',
    act_sedentary: 'Mostly sitting', act_sedentary_d: 'Little walking during the day',
    act_light: 'Lightly active', act_light_d: 'Daily walks or light exercise 1–3 days a week',
    act_moderate: 'Moderately active', act_moderate_d: 'Exercise 3–5 days a week',
    act_very: 'Very active', act_very_d: 'Hard exercise 6–7 days a week or physical work',
    ob_goal: 'What is your goal?',
    goal_lose: 'Lose weight', goal_lose_d: 'About 0.5 kg per week',
    goal_maintain: 'Keep my weight', goal_maintain_d: 'Stay as I am',
    goal_gain: 'Build muscle', goal_gain_d: 'A little more food, more protein',
    ob_result: 'Your daily target', perDay: 'kcal per day',
    ob_explain: 'At rest your body uses about {bmr} kcal a day. With your activity, about {tdee} kcal.',
    ob_disclaimer: 'This is an estimate, not medical advice. If you have a health condition, ask your doctor.',
    next: 'Next', back: 'Back', later: 'Later', saveTargets: 'Save my target',
    recalc: 'Recalculate my daily needs', targetsSaved: 'Daily target saved ✓',
    settings: 'Settings', language: 'Language', goal: 'Daily calorie goal', save: 'Save', goalSaved: 'Goal saved ✓',
    disconnect: 'Sign out', disconnectConfirm: 'Sign out of the app on this phone?',
    signInText: 'Sign in to start. Your meals are saved to your account.', google: 'Continue with Google',
    orCode: 'I have an access code', privacy: 'Privacy policy',
    searchPlaceholder: 'What did you eat? e.g. “bread with salami”', calcAuto: 'Calculate automatically',
    calcBtn: 'Calculate calories', calculating: 'Calculating…', calculatingHint: 'about 10 seconds',
    recent: 'Eaten recently', categories: 'Or choose a category', allCategories: 'Categories', fromList: 'Or pick from the list:', added: 'Added: {name}',
    notFoodText: 'No food recognized. Try writing it differently.',
    err_invalid_login: 'Sign-in failed. Please try again.', err_auth_unavailable: 'The sign-in service is not responding. Try again in a moment.',
    err_login_cancelled: 'Sign-in was cancelled.',
    installHint: 'Tip: add this app to your Home Screen for one-tap access. iPhone: Share → “Add to Home Screen”. Android: menu ⋮ → “Add to Home screen”.',
    enrollTitle: 'Daily Calories', enrollText: 'Enter the access code to start.', code: 'Access code', start: 'Start',
    offlineSaved: 'No connection. Saved on the phone — it will sync automatically.',
    waking: 'Starting up… the first open of the day can take up to a minute.',
    close: 'Close', prevDay: 'Previous day', nextDay: 'Next day', retry: 'Try again', loadFailed: 'Could not load. Check the connection.',
    err_network: 'No internet connection. Try again.',
    err_daily_limit: 'Daily photo limit reached. You can still type what you ate.',
    err_ai_unavailable: 'The food recognition service is busy. Try again in a moment.',
    err_refused: 'This photo could not be analyzed. Try another photo.',
    err_ai_busy: 'The food recognition service is very busy right now. Wait a minute and try again.',
    err_ai_quota: 'Automatic calculation has reached its limit for today. Pick the foods from the list instead.',
    err_invalid_code: 'That code is not correct.', err_device_limit: 'The maximum number of phones is already connected.',
    err_too_many_attempts: 'Too many attempts. Wait 15 minutes.', err_server_not_configured: 'The server is not set up yet (missing access code).',
    err_generic: 'Something went wrong. Try again.',
  },
  ro: {
    today: 'Azi', yesterday: 'Ieri', kcal: 'kcal', ofGoal: 'din {goal}',
    left: 'Mai ai <b>{n}</b> kcal', over: '<b>{n}</b> kcal peste țintă',
    protein: 'Proteine', carbs: 'Carbohidrați', fat: 'Grăsimi', meals: 'Mese',
    noMeals: 'Nimic înregistrat încă', noMealsHint: 'Apasă „Fă o poză” și fotografiază farfuria.',
    snap: 'Fă o poză', typeIt: 'Scrie ce ai mâncat', gallery: 'Alege din poze',
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
    ob_title: 'Caloriile tale zilnice', ob_intro: 'Câteva întrebări rapide ca aplicația să estimeze cât ar trebui să mănânci pe zi.',
    ob_sex: 'Ești', male: 'Bărbat', female: 'Femeie',
    ob_body: 'Despre tine', age: 'Vârsta', years: 'ani', height: 'Înălțimea', weight: 'Greutatea',
    ob_activity: 'Cât de activ ești?',
    act_sedentary: 'Stau mai mult jos', act_sedentary_d: 'Merg puțin pe jos în timpul zilei',
    act_light: 'Puțin activ', act_light_d: 'Plimbări zilnice sau sport ușor 1–3 zile pe săptămână',
    act_moderate: 'Moderat activ', act_moderate_d: 'Sport 3–5 zile pe săptămână',
    act_very: 'Foarte activ', act_very_d: 'Sport intens 6–7 zile pe săptămână sau muncă fizică',
    ob_goal: 'Care este obiectivul tău?',
    goal_lose: 'Să slăbesc', goal_lose_d: 'Cam 0,5 kg pe săptămână',
    goal_maintain: 'Să-mi păstrez greutatea', goal_maintain_d: 'Să rămân cum sunt',
    goal_gain: 'Să pun masă musculară', goal_gain_d: 'Puțin mai multă mâncare, mai multe proteine',
    ob_result: 'Ținta ta zilnică', perDay: 'kcal pe zi',
    ob_explain: 'În repaus corpul tău consumă cam {bmr} kcal pe zi. Cu activitatea ta, cam {tdee} kcal.',
    ob_disclaimer: 'Este o estimare, nu un sfat medical. Dacă ai o problemă de sănătate, întreabă medicul.',
    next: 'Înainte', back: 'Înapoi', later: 'Mai târziu', saveTargets: 'Salvează ținta',
    recalc: 'Recalculează necesarul zilnic', targetsSaved: 'Țintă zilnică salvată ✓',
    settings: 'Setări', language: 'Limba', goal: 'Ținta zilnică de calorii', save: 'Salvează', goalSaved: 'Țintă salvată ✓',
    disconnect: 'Ieși din cont', disconnectConfirm: 'Ieși din aplicație pe acest telefon?',
    signInText: 'Conectează-te ca să începi. Mesele tale se salvează în contul tău.', google: 'Continuă cu Google',
    orCode: 'Am un cod de acces', privacy: 'Politica de confidențialitate',
    searchPlaceholder: 'Ce ai mâncat? ex. „pâine cu salam”', calcAuto: 'Calculează automat',
    calcBtn: 'Calculează caloriile', calculating: 'Se calculează…', calculatingHint: 'cam 10 secunde',
    recent: 'Mâncate recent', categories: 'Sau alege o categorie', allCategories: 'Categorii', fromList: 'Sau alege din listă:', added: 'Adăugat: {name}',
    notFoodText: 'Nu am recunoscut alimentul. Încearcă să-l scrii altfel.',
    err_invalid_login: 'Conectarea nu a reușit. Încearcă din nou.', err_auth_unavailable: 'Serviciul de conectare nu răspunde. Încearcă puțin mai târziu.',
    err_login_cancelled: 'Conectarea a fost anulată.',
    installHint: 'Sfat: adaugă aplicația pe ecranul principal. iPhone: Partajare → „Adaugă pe ecranul principal”. Android: meniul ⋮ → „Adaugă pe ecranul de pornire”.',
    enrollTitle: 'Calorii zilnice', enrollText: 'Introdu codul de acces ca să începi.', code: 'Cod de acces', start: 'Începe',
    offlineSaved: 'Fără conexiune. Salvat pe telefon — se sincronizează automat.',
    waking: 'Se pornește… prima deschidere poate dura până la un minut.',
    close: 'Închide', prevDay: 'Ziua anterioară', nextDay: 'Ziua următoare', retry: 'Încearcă din nou', loadFailed: 'Nu s-a putut încărca. Verifică internetul.',
    err_network: 'Nu există internet. Încearcă din nou.',
    err_daily_limit: 'Ai atins limita de poze pe azi. Poți scrie ce ai mâncat.',
    err_ai_unavailable: 'Serviciul de recunoaștere e ocupat. Încearcă puțin mai târziu.',
    err_refused: 'Poza nu a putut fi analizată. Încearcă altă poză.',
    err_ai_busy: 'Serviciul de recunoaștere e foarte ocupat acum. Așteaptă un minut și încearcă din nou.',
    err_ai_quota: 'Calculul automat a atins limita pe azi. Alege alimentele din listă.',
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

function applyLang(lang) {
  LANG = lang === 'en' ? 'en' : 'ro';
  LOCALE = LANG === 'ro' ? 'ro-RO' : 'en-US';
  document.documentElement.lang = LANG;
}
applyLang(store.get('lang'));

// Switch language and redraw whatever screen is showing.
function setLang(lang) {
  applyLang(lang);
  store.set('lang', LANG);
  closeSheet();
  if (token) renderDay();
  else renderEnroll();
}

// Shows the language you can switch TO, written in that language.
const langButton = () =>
  `<button class="lang-btn" data-act="lang" aria-label="${LANG === 'ro' ? 'Switch to English' : 'Schimbă în română'}">${LANG === 'ro' ? 'EN' : 'RO'}</button>`;

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

// ---------- sign-in ----------

let config = null; // { googleLogin, supabaseUrl, codeLogin } from the server
let loginError = '';

const GOOGLE_G = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

// Supabase sends the user back here with the session in the URL fragment
// (#access_token=... or #error=...). Exchange it for our own app token.
async function finishOAuthRedirect() {
  if (!location.hash.includes('access_token=') && !location.hash.includes('error')) return;
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search); // never keep tokens in the URL
  const accessToken = params.get('access_token');
  if (!accessToken) {
    if (params.get('error')) loginError = t('err_login_cancelled');
    return;
  }
  try {
    const res = await api('POST', '/auth/supabase', { accessToken, deviceName: navigator.userAgent.slice(0, 80) });
    token = res.token;
    store.set('token', token);
  } catch (err) {
    loginError = errText(err);
  }
}

async function renderEnroll() {
  if (!config) {
    app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      config = await api('GET', '/config');
    } catch (err) {
      config = null;
      app.innerHTML = `<section class="enroll"><p>${t('loadFailed')}</p>
        <button class="btn btn-secondary" id="retry-config">${t('retry')}</button></section>`;
      $('#retry-config').onclick = renderEnroll;
      return;
    }
  }
  const google = config.googleLogin
    ? `<button class="btn btn-google btn-block" id="google-login">${GOOGLE_G}<span>${t('google')}</span></button>`
    : '';
  const codeForm = `
    <form id="enroll-form" autocomplete="off">
      <input class="field" name="code" placeholder="${t('code')}" autocapitalize="off" autocorrect="off" spellcheck="false" required>
      <button class="btn btn-primary btn-block" type="submit">${t('start')}</button>
    </form>`;
  app.innerHTML = `
    <div class="enroll-lang">${langButton()}</div>
    <section class="enroll">
      <img class="logo" src="/icons/icon-192.png" alt="">
      <h1>${t('enrollTitle')}</h1>
      <p>${config.googleLogin ? t('signInText') : t('enrollText')}</p>
      <div class="login-options">
        ${google}
        ${config.codeLogin
          ? (config.googleLogin ? `<details class="code-login"><summary>${t('orCode')}</summary>${codeForm}</details>` : codeForm)
          : ''}
        <div class="error" id="enroll-error">${esc(loginError)}</div>
      </div>
      <p class="privacy-link"><a href="/privacy.html">${t('privacy')}</a></p>
    </section>`;

  $('#google-login')?.addEventListener('click', () => {
    const back = `${location.origin}/`;
    location.href = `${config.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
  });
  const form = $('#enroll-form');
  if (!form) return;
  form.onsubmit = async (e) => {
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
      loginError = '';
      $('#enroll-error').textContent = errText(err);
      btn.disabled = false;
    }
  };
}

// ---------- day view ----------

async function loadDay() {
  state.loadError = false;
  // The free server sleeps when unused; tell the user why the first load is slow.
  const slowTimer = setTimeout(() => {
    const el = $('#waking');
    if (el) el.hidden = false;
  }, 4000);
  try {
    const [day, me] = await Promise.all([api('GET', `/days/${state.date}`), state.me ? state.me : api('GET', '/me')]);
    state.day = day;
    state.me = me;
  } catch (e) {
    if (e.code === 'unauthorized') return;
    state.loadError = true;
  }
  clearTimeout(slowTimer);
  renderDay();
  // First visit (or skipped earlier on another day): ask for body data once.
  if (state.me && !state.me.profile && !sheetRoot.innerHTML && store.get('ob_later') !== dateStr()) openOnboarding();
}

// ---------- onboarding: body data -> daily calorie target ----------

let ob = null;

function openOnboarding() {
  const p = state.me?.profile;
  draft = null;
  ob = {
    step: 0,
    sex: p?.sex ?? null,
    age: p?.age ?? 55,
    heightCm: p?.height_cm ?? null,
    weightKg: p?.weight_kg ?? null,
    activity: p?.activity ?? null,
    goal: p?.goal ?? null,
    saving: false,
  };
  sheetRoot.innerHTML = `
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ob-title">
        <div class="sheet-head"><h2 id="ob-title">${t('ob_title')}</h2>
          <button class="btn btn-ghost" data-ob="later">${t('later')}</button></div>
        <div class="sheet-body"></div>
        <div class="sheet-foot ob-foot"></div>
      </div>
    </div>`;
  const sheet = $('.sheet', sheetRoot);
  sheet.addEventListener('click', onOnboardingClick);
  sheet.addEventListener('change', (e) => {
    const f = e.target.dataset.field;
    if (!f || !ob) return;
    const v = Number(String(e.target.value).replace(',', '.'));
    if (Number.isFinite(v)) ob[f] = v;
    renderOnboarding();
  });
  renderOnboarding();
}

const OB_STEPS = 5;
// Body numbers are "ready" only when they are in a realistic range.
const obReady = (s) =>
  [
    () => ob.sex,
    () => computeTargets({ ...ob, activity: 'sedentary', goal: 'maintain' }) !== null,
    () => ob.activity,
    () => ob.goal,
    () => true,
  ][s]();

function numField(field, label, unit, step) {
  return `<div class="ob-num">
    <span class="label">${label}</span>
    <div class="stepper">
      <button data-ob="dec" data-field="${field}" data-step="${step}" aria-label="−">−</button>
      <label class="grams"><input data-field="${field}" type="number" inputmode="decimal" value="${ob[field] ?? ''}"><span>${unit}</span></label>
      <button data-ob="inc" data-field="${field}" data-step="${step}" aria-label="+">+</button>
    </div></div>`;
}

function options(field, keys, prefix, icons) {
  return keys.map((k) => `
    <button class="option" data-ob="pick" data-field="${field}" data-value="${k}" aria-pressed="${ob[field] === k}">
      ${icons ? `<span class="option-icon">${icons[k]}</span>` : ''}
      <span><b>${t(prefix + k)}</b>${STR.en[prefix + k + '_d'] ? `<small>${t(prefix + k + '_d')}</small>` : ''}</span>
    </button>`).join('');
}

function renderOnboarding() {
  if (!ob) return;
  const body = $('.sheet-body', sheetRoot);
  const dots = Array.from({ length: OB_STEPS }, (_, i) => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('');
  let html = `<div class="ob-dots" aria-hidden="true">${dots}</div>`;
  if (ob.step === 0) {
    html += `<p class="hint">${t('ob_intro')}</p><h3 class="ob-q">${t('ob_sex')}</h3>
      ${options('sex', ['male', 'female'], '', { male: '👨', female: '👩' })}`;
  } else if (ob.step === 1) {
    html += `<h3 class="ob-q">${t('ob_body')}</h3>
      ${numField('age', t('age'), t('years'), 1)}
      ${numField('heightCm', t('height'), 'cm', 1)}
      ${numField('weightKg', t('weight'), 'kg', 1)}`;
  } else if (ob.step === 2) {
    html += `<h3 class="ob-q">${t('ob_activity')}</h3>
      ${options('activity', Object.keys(ACTIVITY_FACTORS), 'act_', { sedentary: '🪑', light: '🚶', moderate: '🚴', very: '🏋️' })}`;
  } else if (ob.step === 3) {
    html += `<h3 class="ob-q">${t('ob_goal')}</h3>
      ${options('goal', ['lose', 'maintain', 'gain'], 'goal_', { lose: '⬇️', maintain: '⚖️', gain: '💪' })}`;
  } else {
    const tg = computeTargets(ob);
    html += tg
      ? `<h3 class="ob-q">${t('ob_result')}</h3>
        <div class="ob-result"><strong>${fmt(tg.kcal)}</strong><span>${t('perDay')}</span></div>
        <div class="totals">
          <div><b>${tg.protein}</b><span>${t('protein')} g</span></div>
          <div><b>${tg.carbs}</b><span>${t('carbs')} g</span></div>
          <div><b>${tg.fat}</b><span>${t('fat')} g</span></div>
        </div>
        <p class="hint">${t('ob_explain', { bmr: fmt(tg.bmr), tdee: fmt(tg.tdee) })}</p>
        <p class="hint">${t('ob_disclaimer')}</p>`
      : `<p class="error">${t('err_generic')}</p>`;
  }
  body.innerHTML = html;

  const last = ob.step === OB_STEPS - 1;
  $('.ob-foot', sheetRoot).innerHTML = `
    ${ob.step > 0 ? `<button class="btn btn-secondary" data-ob="back">${t('back')}</button>` : ''}
    <button class="btn btn-primary" data-ob="${last ? 'save' : 'next'}" ${obReady(ob.step) && !ob.saving ? '' : 'disabled'}>
      ${last ? t('saveTargets') : t('next')}</button>`;
}

async function onOnboardingClick(e) {
  const el = e.target.closest('[data-ob]');
  if (!el || !ob) return;
  const act = el.dataset.ob;
  const f = el.dataset.field;
  if (act === 'later') {
    store.set('ob_later', dateStr());
    closeSheet();
    return;
  }
  if (act === 'pick') {
    ob[f] = el.dataset.value;
    // Sensible starting values for the next screen, by sex.
    if (f === 'sex') {
      ob.heightCm ??= ob.sex === 'male' ? 175 : 162;
      ob.weightKg ??= ob.sex === 'male' ? 80 : 68;
    }
    renderOnboarding();
    setTimeout(() => { if (ob) { ob.step += 1; renderOnboarding(); } }, 180);
    return;
  }
  if (act === 'inc' || act === 'dec') {
    const d = Number(el.dataset.step) * (act === 'inc' ? 1 : -1);
    ob[f] = Math.max(0, Math.round(((ob[f] || 0) + d) * 10) / 10);
  } else if (act === 'back') {
    ob.step = Math.max(0, ob.step - 1);
  } else if (act === 'next') {
    if (obReady(ob.step)) ob.step += 1;
  } else if (act === 'save') {
    ob.saving = true;
    renderOnboarding();
    try {
      await api('PUT', '/me/profile', {
        sex: ob.sex, age: ob.age, heightCm: ob.heightCm, weightKg: ob.weightKg, activity: ob.activity, goal: ob.goal,
      });
      state.me = await api('GET', '/me');
      closeSheet();
      toast(t('targetsSaved'));
      renderDay();
    } catch (err) {
      if (err.code === 'unauthorized') return;
      ob.saving = false;
      toast(err.code === 'invalid_profile' ? t('err_generic') : errText(err));
      // Out-of-range numbers: send the user back to the body-data screen.
      if (err.code === 'invalid_profile') ob.step = 1;
      renderOnboarding();
    }
    return;
  }
  renderOnboarding();
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
  return `<div class="macro"><div class="macro-row"><span>${label}</span><span><b>${fmt(grams)}</b> / ${fmt(target)} g</span></div>
    <div class="bar ${cls}"><i style="width:${pct}%"></i></div></div>`;
}

function renderDay() {
  const isToday = state.date === dateStr();
  const tot = state.day?.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const goal = state.me?.goalKcal || 2000;
  const mt = macroTargets(goal, state.me?.profile);
  const diff = goal - tot.kcal;
  const meals = state.day?.meals || [];

  let list;
  if (state.loadError) {
    list = `<div class="empty"><p>${t('loadFailed')}</p><button class="btn btn-secondary" data-act="reload">${t('retry')}</button></div>`;
  } else if (!state.day) {
    list = `<p class="hint" id="waking" hidden style="text-align:center">${t('waking')}</p>
      <div class="skeleton"></div><div class="skeleton"></div>`;
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
        ${langButton()}
        <button class="icon-btn" data-act="history" aria-label="${t('history')}">📅</button>
        <button class="icon-btn" data-act="settings" aria-label="${t('settings')}">⚙️</button>
      </div>
    </header>
    <section class="card summary">
      ${ring(tot.kcal, goal)}
      <div>
        <div class="remaining ${diff < 0 ? 'over-text' : ''}">${diff >= 0 ? t('left', { n: fmt(diff) }) : t('over', { n: fmt(-diff) })}</div>
        ${macroBar('p', t('protein'), tot.protein, mt.protein)}
        ${macroBar('c', t('carbs'), tot.carbs, mt.carbs)}
        ${macroBar('f', t('fat'), tot.fat, mt.fat)}
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
  } else if (act === 'lang') {
    setLang(LANG === 'ro' ? 'en' : 'ro');
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
    pending: [], // free-text foods being calculated by the AI
    category: null, // food category open in the browser, if any
    saving: false,
    idempotencyKey: uuid(),
  };
}

// Every food on the review card is counted in its household unit when its
// portion has one ("2 ouă", "1 bol"); otherwise in grams.
function withUnit(item) {
  return { ...item, unit: parsePortion(item.portion, item.grams) };
}

const portionText = (it) => (it.unit ? unitLabel(it.unit, unitCount(it.unit, it.grams), LOCALE) : it.portion);

function itemFromAi(it) {
  return withUnit({
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
  });
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
    items: m.items.map((i) => withUnit({
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
  // Typing only refreshes the suggestions and the main button, so the field keeps focus.
  sheet.addEventListener('input', (e) => {
    if (e.target.name !== 'add') return;
    draft.addText = e.target.value;
    renderFoodResults();
    renderReviewFoot();
  });
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.name === 'add') { e.preventDefault(); calcTypedFood(); }
  });
  renderReview();
  loadRecentFoods();
  if (focusAdd) setTimeout(() => $('input[name="add"]', sheetRoot)?.focus(), 250);
}

// ---------- food search: built-in list + recent foods + AI fallback ----------

let recentFoods = [];
async function loadRecentFoods() {
  try {
    recentFoods = (await api('GET', '/foods/recent')).foods || [];
    if (draft) renderFoodResults();
  } catch { /* suggestions still work from the built-in list */ }
}

const STOPWORDS = new Set(['de', 'cu', 'si', 'o', 'un', 'una', 'la', 'in', 'din', 'pe', 'and', 'with', 'of', 'the', 'felie', 'felii', 'bucata', 'bucati', 'slice', 'piece']);

// Whole-phrase matches first; otherwise match the meaningful words one by one,
// so "1 felie de paine cu salam" suggests both bread and salami.
function listSuggestions(text) {
  let res = searchFoods(text, 6);
  if (!res.length) {
    const seen = new Set();
    for (const w of fold(text).split(/[^a-z0-9]+/)) {
      if (w.length < 3 || STOPWORDS.has(w) || /^\d/.test(w)) continue;
      for (const f of searchFoods(w, 3)) if (!seen.has(f.id)) { seen.add(f.id); res.push(f); }
    }
  }
  return res.slice(0, 6);
}

function recentMatches(text) {
  const words = fold(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (!words.length) return [];
  return recentFoods.filter((r) => words.some((w) => fold(r.name).includes(w))).slice(0, 3);
}

function foodRow(src, idx, name, portion, kcal) {
  return `<button class="food-row" data-act="pick" data-src="${src}" data-idx="${idx}">
    <span><b>${esc(name)}</b><small>${esc(portion)} · ${fmt(kcal)} kcal</small></span>
    <span class="plus" aria-hidden="true">+</span></button>`;
}

function renderFoodResults() {
  const box = $('#food-results', sheetRoot);
  if (!box || !draft) return;
  const text = draft.addText.trim();
  const listRow = (f) => foodRow('list', f.id, LANG === 'ro' ? f.ro : f.en, LANG === 'ro' ? f.portionRo : f.portionEn,
    (f.grams * f.kcal_100g) / 100);
  const recentRow = (r) => foodRow('recent', recentFoods.indexOf(r), r.name, r.portion || `${Math.round(r.grams)} g`,
    (r.grams * r.kcal_100g) / 100);
  let html = '';
  if (text) {
    html += `<button class="food-row ai" data-act="calc">
      <span class="ai-icon" aria-hidden="true">✨</span>
      <span><b>${t('calcAuto')}</b><small>«${esc(text)}»</small></span></button>`;
    const rec = recentMatches(text);
    const list = listSuggestions(text).filter((f) => !rec.some((r) => fold(r.name) === fold(f.ro) || fold(r.name) === fold(f.en)));
    if (rec.length || list.length) html += `<p class="food-head">${t('fromList')}</p>${rec.map(recentRow).join('')}${list.map(listRow).join('')}`;
  } else if (draft.category) {
    // One category open: every food in it.
    const cat = CATEGORIES.find((c) => c.key === draft.category);
    html += `<div class="cat-bar">
      <button class="btn btn-ghost" data-act="cat-back">‹ ${t('allCategories')}</button>
      <b>${cat.icon} ${esc(cat[LANG])}</b></div>
      ${foodsInCategory(cat.key).map(listRow).join('')}`;
  } else {
    // Nothing typed: recent foods, then the categories to browse.
    const rec = recentFoods.slice(0, draft.items.length ? 3 : 5);
    if (rec.length) html += `<p class="food-head">${t('recent')}</p>${rec.map(recentRow).join('')}`;
    html += `<p class="food-head">${t('categories')}</p><div class="cat-grid">${CATEGORIES.map((c) =>
      `<button class="cat-btn" data-act="cat" data-cat="${c.key}"><span aria-hidden="true">${c.icon}</span>${esc(c[LANG])}</button>`).join('')}</div>`;
  }
  box.innerHTML = html;
}

// "2 oua" + tap "Ou fiert" -> two eggs. Null when no number was typed.
function typedQuantity(text) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s/.exec(text);
  const q = m ? Number(m[1].replace(',', '.')) : null;
  return q > 0 && q <= 20 ? q : null;
}

function pickFood(src, idx) {
  const d = draft;
  let item;
  if (src === 'recent') {
    const r = recentFoods[idx];
    if (!r) return;
    item = { name: r.name, portion: r.portion, grams: r.grams, kcal_100g: r.kcal_100g, protein_100g: r.protein_100g, carbs_100g: r.carbs_100g, fat_100g: r.fat_100g };
  } else {
    const f = FOODS[idx];
    if (!f) return;
    const portion = LANG === 'ro' ? f.portionRo : f.portionEn;
    item = { name: LANG === 'ro' ? f.ro : f.en, portion, grams: f.grams,
      kcal_100g: f.kcal_100g, protein_100g: f.protein_100g, carbs_100g: f.carbs_100g, fat_100g: f.fat_100g };
  }
  const added = withUnit({ ...item, key: uuid(), baseGrams: item.grams, confidence: 'high', alternatives: [], showAlts: false, ai_name: null, ai_grams: null });
  // A typed number counts units: "2 oua" -> 2 ouă, "3 linguri smantana" -> 3 linguri.
  const q = typedQuantity(d.addText);
  if (q && added.unit) added.grams = Math.round(added.unit.unitGrams * q);
  d.items.push(added);
  d.addText = '';
  d.error = null;
  toast(t('added', { name: item.name }));
  renderReview();
  // Browsing a category: stay there to add more. Otherwise show what was added.
  if (!d.category) showInSheet('.totals');
}

// Ask the AI about free text. Shows a visible "calculating" card, never blocks the screen.
async function calcTypedFood(retryPending) {
  const d = draft;
  if (!d) return;
  const p = retryPending || { id: uuid(), text: d.addText.trim() };
  if (!p.text) return;
  p.error = null;
  if (!retryPending) {
    d.pending.push(p);
    d.addText = '';
  }
  renderReview();
  showInSheet(`.item.pending[data-pid="${p.id}"]`);
  try {
    const res = await api('POST', '/analyses', { text: p.text, lang: LANG });
    d.pending = d.pending.filter((x) => x !== p);
    // Typed foods are user-provided, not photo recognition: don't count them as AI corrections.
    d.items.push(...res.items.map((x) => ({ ...itemFromAi(x), ai_name: null, ai_grams: null })));
    if (!res.items.length) {
      d.pending.push({ ...p, error: t('notFoodText') });
    } else d.error = null;
  } catch (e) {
    if (e.code === 'unauthorized') return;
    p.error = errText(e);
  }
  if (draft === d) {
    renderReview();
    showInSheet('.totals');
  }
}

// Scroll the sheet so the thing that just changed is in view.
function showInSheet(selector) {
  const el = $(selector, sheetRoot);
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function closeSheet() {
  if (draft?.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.photoUrl);
  draft = null;
  ob = null;
  sheetRoot.innerHTML = '';
}

function renderReview() {
  const d = draft;
  if (!d) return;
  const body = $('.sheet-body', sheetRoot);
  const scroll = body.scrollTop;
  const typing = document.activeElement?.name === 'add';
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
            <small>${it.unit
              ? `${fmt((it.unit.unitGrams * it.kcal_100g) / 100)} kcal / ${esc(it.unit.singular)}`
              : esc(it.portion || '')}</small></button>
          <span class="item-kcal">${fmt(itemKcal(it))} kcal</span>
          <button class="icon-btn remove" data-act="remove" data-i="${i}" aria-label="✕">✕</button>
        </div>
        <div class="stepper">
          <button data-act="dec" data-i="${i}" aria-label="−">−</button>
          ${it.unit
            ? `<div class="qty"><b>${esc(portionText(it))}</b>
                <label class="qty-grams"><input name="grams" data-i="${i}" type="number" inputmode="numeric" min="1" max="5000" value="${Math.round(it.grams)}"><span>g</span></label></div>`
            : `<label class="grams"><input name="grams" data-i="${i}" type="number" inputmode="numeric" min="1" max="5000" value="${Math.round(it.grams)}"><span>g</span></label>`}
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
      ${items}
      ${d.pending.map(pendingCard).join('')}
      <div class="food-search">
        <input class="field" name="add" placeholder="${esc(t('searchPlaceholder'))}" value="${esc(d.addText)}"
          enterkeyhint="go" autocomplete="off" autocorrect="off" spellcheck="false">
        <div id="food-results"></div>
      </div>
      ${d.mealId ? `<p style="margin-top:28px"><button class="btn btn-danger btn-block" data-act="delete">${t('deleteMeal')}</button></p>` : ''}`;
  }
  body.innerHTML = photo + (photo ? '<div style="height:12px"></div>' : '') + content;
  body.scrollTop = scroll;
  renderFoodResults();
  renderReviewFoot();
  if (typing) {
    const input = $('input[name="add"]', sheetRoot);
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }
}

function pendingCard(p) {
  if (p.error) {
    return `<div class="item pending err">
      <span class="pending-icon" aria-hidden="true">⚠️</span>
      <span class="pending-text"><b>${esc(p.error)}</b><small>«${esc(p.text)}»</small></span>
      <button class="btn btn-secondary btn-small" data-act="retry" data-pid="${p.id}">${t('retry')}</button>
      <button class="icon-btn remove" data-act="dismiss" data-pid="${p.id}" aria-label="✕">✕</button>
    </div>`;
  }
  return `<div class="item pending" data-pid="${p.id}">
    <div class="spinner small" aria-hidden="true"></div>
    <span class="pending-text"><b>${t('calculating')}</b><small>«${esc(p.text)}» · ${t('calculatingHint')}</small></span>
  </div>`;
}

// The big button always does something useful: calculate typed text, or save the meal.
function renderReviewFoot() {
  const d = draft;
  const foot = $('.sheet-foot', sheetRoot);
  if (!d || !foot) return;
  const busy = d.pending.some((p) => !p.error);
  if (!d.loading && !d.items.length && d.addText.trim()) {
    foot.innerHTML = `<button class="btn btn-primary btn-block" data-act="calc">✨ ${t('calcBtn')}</button>`;
    return;
  }
  if (!d.items.length && busy) {
    foot.innerHTML = `<button class="btn btn-primary btn-block" disabled>${t('calculating')}</button>`;
    return;
  }
  const tot = sumItems(d.items);
  const label = d.mealId ? t('saveMeal', { n: fmt(tot.kcal) }) : t('logMeal', { n: fmt(tot.kcal) });
  foot.innerHTML =
    `<button class="btn btn-primary btn-block" data-act="log" ${d.loading || d.saving || !d.items.length || busy ? 'disabled' : ''}>${label}</button>`;
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
    case 'dec': {
      const dir = el.dataset.act === 'inc' ? 1 : -1;
      if (it.unit) {
        it.grams = Math.round(stepCount(it.unit, unitCount(it.unit, it.grams), dir) * it.unit.unitGrams);
      } else {
        it.grams = Math.min(5000, Math.max(5, it.grams + dir * stepFor(it)));
      }
      break;
    }
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
    case 'calc':
      calcTypedFood();
      return;
    case 'pick':
      pickFood(el.dataset.src, Number(el.dataset.idx));
      return;
    case 'cat':
      d.category = el.dataset.cat;
      renderFoodResults();
      showInSheet('.cat-bar');
      return;
    case 'cat-back':
      d.category = null;
      renderFoodResults();
      showInSheet('.food-search');
      return;
    case 'retry': {
      const p = d.pending.find((x) => x.id === el.dataset.pid);
      if (p) calcTypedFood(p);
      return;
    }
    case 'dismiss':
      d.pending = d.pending.filter((x) => x.id !== el.dataset.pid);
      break;
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
      name: it.name, portion: portionText(it), grams: it.grams,
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
    <span class="label">${t('language')}</span>
    <div class="chips" role="group">
      <button class="chip" data-lang="ro" aria-pressed="${LANG === 'ro'}">Română</button>
      <button class="chip" data-lang="en" aria-pressed="${LANG === 'en'}">English</button>
    </div>
    <label class="label" for="goal">${t('goal')}</label>
    <div class="stepper">
      <button data-step="-50" aria-label="−">−</button>
      <label class="grams"><input id="goal" type="number" inputmode="numeric" min="800" max="6000" step="50" value="${goal}"><span>kcal</span></label>
      <button data-step="50" aria-label="+">+</button>
    </div>
    <p><button class="btn btn-primary btn-block" id="save-goal">${t('save')}</button></p>
    <p><button class="btn btn-secondary btn-block" id="recalc">${t('recalc')}</button></p>
    <p class="hint">${t('installHint')}</p>
    <p style="margin-top:32px"><button class="btn btn-danger btn-block" id="disconnect">${t('disconnect')}</button></p>
    <p class="privacy-link"><a href="/privacy.html">${t('privacy')}</a></p>`);
  const body = $('.sheet-body', sheetRoot);
  body.onclick = async (e) => {
    const step = e.target.closest('[data-step]');
    const input = $('#goal', body);
    const langChip = e.target.closest('[data-lang]');
    if (langChip) {
      setLang(langChip.dataset.lang);
      openSettings();
    } else if (step) {
      input.value = Math.min(6000, Math.max(800, Number(input.value) + Number(step.dataset.step)));
    } else if (e.target.id === 'recalc') {
      openOnboarding();
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
      await api('POST', '/logout').catch(() => {}); // revoke this phone's token on the server
      token = null;
      store.del('token');
      state.me = null;
      state.day = null;
      closeSheet();
      renderEnroll();
    }
  };
}

function openSimpleSheet(title, html) {
  draft = null;
  ob = null;
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
  if (e.target.classList.contains('sheet-backdrop') && !draft && !ob) closeSheet();
});

// ---------- start ----------

async function start() {
  await finishOAuthRedirect();
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
