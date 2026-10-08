import Anthropic from '@anthropic-ai/sdk';

// The vision provider sits behind this one module ("port"). Swapping models or
// providers, or A/B testing prompts, should only touch this file and config.

export const PROMPT_VERSION = 'food-v1';
const MOCK = process.env.MOCK_AI === '1';
// AI_PROVIDER = 'gemini' | 'claude'. Unset: Gemini when its key is present, else Claude.
const PROVIDER = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'claude');
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
// Tried in order. Each Gemini model has its own free-tier daily quota (only
// ~20 requests/day for the newest one), so when one is exhausted or overloaded
// the next takes over.
// GEMINI_MODELS replaces the list; GEMINI_MODEL only chooses which one goes first.
const GEMINI_MODELS = [...new Set(
  (process.env.GEMINI_MODELS || `${process.env.GEMINI_MODEL || ''},gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.5-flash`)
    .split(',').map((m) => m.trim()).filter(Boolean)
)];
// model -> time (ms) until which we skip it after a quota error.
const geminiSkipUntil = new Map();
export const AI_PROVIDER = MOCK ? 'mock' : PROVIDER;

const PER_100G = {
  kcal_100g: { type: 'number', description: 'kcal per 100 g for this preparation' },
  protein_100g: { type: 'number', description: 'grams of protein per 100 g' },
  carbs_100g: { type: 'number', description: 'grams of carbohydrate per 100 g' },
  fat_100g: { type: 'number', description: 'grams of fat per 100 g' },
};

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'notes'],
  properties: {
    is_food: { type: 'boolean' },
    notes: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'portion', 'grams', 'confidence', ...Object.keys(PER_100G), 'alternatives'],
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          grams: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          ...PER_100G,
          alternatives: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', ...Object.keys(PER_100G)],
              properties: { name: { type: 'string' }, ...PER_100G },
            },
          },
        },
      },
    },
  },
};

const LANGUAGES = { en: 'English', ro: 'Romanian' };

function systemPrompt(lang) {
  return `You estimate nutrition for a calorie-tracking app used by an older adult. Accuracy matters more than speed; the user will review and adjust your estimate.

For each distinct food or drink:
- name: short, everyday name including preparation when it changes calories (e.g. "fried egg", "boiled potatoes").
- portion: a household description of the amount (e.g. "1 cup", "2 slices", "1 medium").
- grams: the edible amount as served (cooked weight for cooked food). Judge scale from the plate (a dinner plate is about 26 cm), cutlery, cups, hands and packaging.
- kcal/protein/carbs/fat per 100 g for that preparation, using standard food composition tables. Do not multiply by grams yourself; the app does that.
- confidence: how sure you are about both the identity and the amount.
- alternatives: when you are not sure what the item is, up to 3 other plausible foods with their own per-100 g values; otherwise an empty list.

List significant cooking oil, butter, dressings and sauces as their own items when they are visible or clearly implied. Keep items that are only garnish out of the list.
If the photo shows no food or drink, set is_food to false and return no items.
notes: one short sentence only if something limits the estimate (e.g. a hidden filling); otherwise an empty string.
Write name, portion and notes in ${LANGUAGES[lang] || 'English'}.`;
}

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new AnalysisError('bad_output', 'Model output was not valid JSON');
  }
}

// ---------- Claude ----------

async function callClaude(lang, { image, text }) {
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
  content.push({ type: 'text', text });

  const response = await getClient().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: RESULT_SCHEMA },
    },
    system: systemPrompt(lang),
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new AnalysisError('refused');
  if (response.stop_reason === 'max_tokens') throw new AnalysisError('truncated');

  const out = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return {
    result: normalize(parseJson(out)),
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}

// ---------- Gemini (REST generateContent) ----------

// Gemini's docs show more than one spelling for JSON-schema output. Try the
// documented ones in order and remember the first the API accepts.
const GEMINI_JSON_CONFIGS = [
  { responseMimeType: 'application/json', responseJsonSchema: RESULT_SCHEMA }, // verified working 2026-10
  { responseFormat: { text: { mimeType: 'application/json', schema: RESULT_SCHEMA } } },
  { responseMimeType: 'application/json' }, // schema then comes only from the prompt
];
let geminiConfigIndex = 0;

// "Please retry in 18h27m10s" -> milliseconds (capped), default 10 minutes.
function retryDelayMs(message) {
  const m = /retry in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i.exec(message || '');
  if (!m) return 10 * 60_000;
  const ms = ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000;
  return Math.min(Math.max(ms, 60_000), 24 * 3600_000);
}

async function callGemini(lang, input) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AnalysisError('not_configured', 'GEMINI_API_KEY is not set');
  const deadline = Date.now() + 55_000; // stay under the hosting function's 60 s limit
  const now = Date.now();
  const models = GEMINI_MODELS.filter((m) => (geminiSkipUntil.get(m) || 0) <= now);
  let lastError = new AnalysisError('ai_quota', 'All Gemini models are over their quota');
  for (const model of models) {
    if (Date.now() > deadline - 8_000) break;
    try {
      return await callGeminiModel(model, lang, input, key, deadline);
    } catch (err) {
      if (err.code !== 'ai_quota' && err.code !== 'ai_busy') throw err;
      lastError = err;
      if (err.code === 'ai_quota') geminiSkipUntil.set(model, Date.now() + retryDelayMs(err.message));
      console.warn(`[gemini] ${model}: ${err.code}; trying the next model`);
    }
  }
  throw lastError;
}

async function callGeminiModel(model, lang, { image, text }, key, deadline) {
  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
  parts.push({ text });
  // Spelled out for the fallback config, which can't enforce the schema itself.
  const system = `${systemPrompt(lang)}\n\nReply with JSON only, matching this JSON Schema:\n${JSON.stringify(RESULT_SCHEMA)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  // Gemini answers 500/503 ("high demand") now and then; retry those briefly.
  async function post(generationConfig) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1_000)),
      });
      const data = await res.json().catch(() => ({}));
      const delay = 1_500 * 2 ** attempt;
      if ((res.status === 500 || res.status === 503) && attempt < 1 && Date.now() + delay + 10_000 < deadline) {
        console.warn(`[gemini] ${res.status}, retrying in ${delay} ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { res, data };
    }
  }

  for (let i = geminiConfigIndex; i < GEMINI_JSON_CONFIGS.length; i++) {
    const { res, data } = await post(GEMINI_JSON_CONFIGS[i]);

    if (res.status === 400 && i < GEMINI_JSON_CONFIGS.length - 1 && /generation_?config|response|schema|unknown name/i.test(data.error?.message || '')) {
      console.warn(`[gemini] output config #${i} rejected (${data.error?.message}); trying the next one`);
      continue;
    }
    if (res.status === 429) throw new AnalysisError('ai_quota', data.error?.message);
    if (res.status === 503 || res.status === 500) throw new AnalysisError('ai_busy', data.error?.message);
    // A model name Google has retired: move on to the next model.
    if (res.status === 404) throw new AnalysisError('ai_quota', `Gemini model ${model} not found`);
    if (!res.ok) throw new AnalysisError('ai_unavailable', `Gemini ${res.status}: ${data.error?.message || ''}`);
    geminiConfigIndex = i;

    if (data.promptFeedback?.blockReason) throw new AnalysisError('refused', data.promptFeedback.blockReason);
    const cand = data.candidates?.[0];
    if (!cand) throw new AnalysisError('bad_output', 'Gemini returned no candidates');
    if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new AnalysisError('refused', cand.finishReason);
    if (cand.finishReason === 'MAX_TOKENS') throw new AnalysisError('truncated');

    const out = (cand.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
    // Tolerate a ```json fence when the schema wasn't enforced.
    const json = out.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    return {
      result: normalize(parseJson(json)),
      model: data.modelVersion || model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
  throw new AnalysisError('ai_unavailable', 'Gemini rejected every output config');
}

const callModel = (lang, input) => (PROVIDER === 'gemini' ? callGemini(lang, input) : callClaude(lang, input));

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

function normalizePer100(src) {
  return {
    kcal_100g: num(src.kcal_100g, 900),
    protein_100g: num(src.protein_100g, 100),
    carbs_100g: num(src.carbs_100g, 100),
    fat_100g: num(src.fat_100g, 100),
  };
}

const capitalize = (s) => s.charAt(0).toLocaleUpperCase('ro') + s.slice(1);

// Defensive pass: clamp numbers to physically possible ranges.
function normalize(r) {
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    is_food: Boolean(r.is_food) && items.length > 0,
    notes: String(r.notes || '').slice(0, 300),
    items: items.slice(0, 20).map((it) => ({
      name: capitalize(String(it.name || '?').trim().slice(0, 80)),
      portion: String(it.portion || '').slice(0, 60),
      grams: Math.round(num(it.grams, 3000)),
      confidence: ['high', 'medium', 'low'].includes(it.confidence) ? it.confidence : 'medium',
      ...normalizePer100(it),
      alternatives: (Array.isArray(it.alternatives) ? it.alternatives : []).slice(0, 3).map((a) => ({
        name: String(a.name || '?').slice(0, 80),
        ...normalizePer100(a),
      })),
    })),
  };
}

export async function analyzePhoto({ imageBase64, mediaType, lang }) {
  if (MOCK) return mockResult(lang);
  return callModel(lang, {
    image: { mediaType, data: imageBase64 },
    text: 'Estimate the nutrition of this meal.',
  });
}

export async function analyzeText({ text, lang }) {
  if (MOCK) return mockResult(lang, text);
  return callModel(lang, {
    text: `The user typed what they ate instead of taking a photo. Estimate it. If no amount is given, assume one typical serving.\n\n<food_description>\n${text}\n</food_description>`,
  });
}

async function mockResult(lang, text) {
  await new Promise((r) => setTimeout(r, 1200));
  const ro = lang === 'ro';
  const items = text
    ? [{ name: text.slice(0, 40), portion: ro ? '1 porție' : '1 serving', grams: 150, confidence: 'medium',
         kcal_100g: 120, protein_100g: 5, carbs_100g: 15, fat_100g: 4, alternatives: [] }]
    : [
        { name: ro ? 'Piept de pui la grătar' : 'Grilled chicken breast', portion: ro ? '1 bucată' : '1 piece', grams: 150,
          confidence: 'high', kcal_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6, alternatives: [] },
        { name: ro ? 'Orez alb fiert' : 'Boiled white rice', portion: ro ? '1 cană' : '1 cup', grams: 180,
          confidence: 'medium', kcal_100g: 130, protein_100g: 2.7, carbs_100g: 28, fat_100g: 0.3,
          alternatives: [
            { name: ro ? 'Quinoa' : 'Quinoa', kcal_100g: 120, protein_100g: 4.4, carbs_100g: 21, fat_100g: 1.9 },
            { name: ro ? 'Cușcuș' : 'Couscous', kcal_100g: 112, protein_100g: 3.8, carbs_100g: 23, fat_100g: 0.2 },
          ] },
        { name: ro ? 'Salată verde cu ulei' : 'Green salad with oil', portion: ro ? '1 bol mic' : '1 small bowl', grams: 90,
          confidence: 'low', kcal_100g: 75, protein_100g: 1.2, carbs_100g: 3, fat_100g: 6.5, alternatives: [] },
      ];
  return {
    result: { is_food: true, notes: '', items },
    model: 'mock',
    inputTokens: 0,
    outputTokens: 0,
  };
}
