import Anthropic from '@anthropic-ai/sdk';

// The vision provider sits behind this one module ("port"). Swapping models or
// providers, or A/B testing prompts, should only touch this file and config.

export const PROMPT_VERSION = 'food-v1';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const MOCK = process.env.MOCK_AI === '1';

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

async function callClaude(lang, content) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
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

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AnalysisError('bad_output', 'Model output was not valid JSON');
  }
  return {
    result: normalize(parsed),
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}

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

// Defensive pass: clamp numbers to physically possible ranges.
function normalize(r) {
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    is_food: Boolean(r.is_food) && items.length > 0,
    notes: String(r.notes || '').slice(0, 300),
    items: items.slice(0, 20).map((it) => ({
      name: String(it.name || '?').slice(0, 80),
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
  return callClaude(lang, [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    { type: 'text', text: 'Estimate the nutrition of this meal.' },
  ]);
}

export async function analyzeText({ text, lang }) {
  if (MOCK) return mockResult(lang, text);
  return callClaude(lang, [
    {
      type: 'text',
      text: `The user typed what they ate instead of taking a photo. Estimate it. If no amount is given, assume one typical serving.\n\n<food_description>\n${text}\n</food_description>`,
    },
  ]);
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
