// Daily energy and macro targets. Shared by the phone (preview) and the server
// (the saved, authoritative value), so both always compute the same numbers.

export const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725 };
export const GOALS = ['lose', 'maintain', 'gain'];
export const SEXES = ['male', 'female'];

const LIMITS = { age: [14, 100], heightCm: [120, 230], weightKg: [30, 300] };

// Returns a clean profile, or null if anything is missing or out of range.
export function normalizeProfile(p) {
  if (!p || !SEXES.includes(p.sex) || !(p.activity in ACTIVITY_FACTORS) || !GOALS.includes(p.goal)) return null;
  const out = { sex: p.sex, activity: p.activity, goal: p.goal };
  for (const [k, [min, max]] of Object.entries(LIMITS)) {
    const n = Number(p[k]);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    out[k] = k === 'weightKg' ? Math.round(n * 10) / 10 : Math.round(n);
  }
  return out;
}

export function computeTargets(profile) {
  const p = normalizeProfile(profile);
  if (!p) return null;
  // Mifflin–St Jeor resting energy expenditure.
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTORS[p.activity];

  let kcal = tdee;
  if (p.goal === 'lose') kcal = tdee - Math.min(500, tdee * 0.2); // ~0.5 kg/week, never more than 20% below
  if (p.goal === 'gain') kcal = tdee + 300; // small surplus for lean muscle gain
  // Never recommend eating below resting needs or a safe minimum.
  kcal = Math.max(kcal, bmr, p.sex === 'male' ? 1500 : 1200);
  kcal = Math.round(kcal / 50) * 50;

  // Protein: higher when losing (keep muscle) or building muscle.
  const protein = Math.round(p.weightKg * (p.goal === 'maintain' ? 1.2 : 1.6));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, ...splitRest(kcal, protein) };
}

// Fat ~30% of energy; carbohydrates fill the rest.
function splitRest(kcal, protein) {
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { fat, carbs };
}

// Macro targets for the day view. Keeps the profile's protein target when the
// calorie goal was changed by hand, otherwise falls back to a standard split.
export function macroTargets(goalKcal, profile) {
  const protein = profile?.protein_g ?? Math.round((goalKcal * 0.2) / 4);
  return { protein, ...splitRest(goalKcal, protein) };
}
