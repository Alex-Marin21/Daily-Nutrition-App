// Household units for portions: "2 ouă", "3 linguri", "1½ bol".
// A portion string like "3 linguri" with 30 g becomes a unit of 10 g that the
// user counts up and down, with correct singular/plural words.

// [singular, plural]. Romanian first, then English.
const FORMS = [
  ['ou', 'ouă'], ['felie', 'felii'], ['lingură', 'linguri'], ['linguriță', 'lingurițe'], ['bol', 'boluri'],
  ['cană', 'căni'], ['pahar', 'pahare'], ['porție', 'porții'], ['porție mică', 'porții mici'], ['bucată', 'bucăți'],
  ['ceașcă', 'cești'], ['halbă', 'halbe'], ['păhărel', 'păhărele'], ['doză', 'doze'], ['sticlă mică', 'sticle mici'],
  ['mână', 'mâini'], ['cupă', 'cupe'], ['rând', 'rânduri'], ['punguță', 'punguțe'], ['covrig', 'covrigi'],
  ['clătită', 'clătite'], ['pulpă', 'pulpe'], ['mic', 'mici'], ['pește', 'pești'], ['conservă', 'conserve'],
  ['roșie', 'roșii'], ['castravete', 'castraveți'], ['ardei', 'ardei'], ['morcov', 'morcovi'], ['ceapă', 'cepe'],
  ['măr', 'mere'], ['banană', 'banane'], ['portocală', 'portocale'], ['pară', 'pere'], ['ciorchine', 'ciorchini'],
  ['prună', 'prune'], ['mandarină', 'mandarine'], ['biscuit', 'biscuiți'], ['sandviș', 'sandvișuri'], ['chiflă', 'chifle'],
  ['lipie', 'lipii'], ['chiftea', 'chiftele'], ['pârjoală', 'pârjoale'], ['cârnat', 'cârnați'], ['crenvurst', 'crenvurști'],
  ['sfert', 'sferturi'], ['știulete', 'știuleți'], ['fir', 'fire'], ['cățel', 'căței'], ['caisă', 'caise'],
  ['piersică', 'piersici'], ['nectarină', 'nectarine'], ['kiwi', 'kiwi'], ['smochină', 'smochine'], ['curmală', 'curmale'],
  ['gogoașă', 'gogoși'], ['cornuleț', 'cornulețe'], ['ecler', 'eclere'], ['napolitană', 'napolitane'], ['bomboană', 'bomboane'],
  ['baton', 'batoane'], ['cornet', 'cornete'], ['croissant', 'croissante'], ['jumătate', 'jumătăți'], ['măslină', 'măsline'],
  ['ridiche', 'ridichi'], ['triunghi', 'triunghiuri'], ['gutuie', 'gutui'], ['avocado', 'avocado'], ['grepfrut', 'grepfruturi'],
  ['egg', 'eggs'], ['slice', 'slices'], ['tbsp', 'tbsp'], ['tsp', 'tsp'], ['bowl', 'bowls'], ['cup', 'cups'],
  ['mug', 'mugs'], ['glass', 'glasses'], ['serving', 'servings'], ['small serving', 'small servings'], ['piece', 'pieces'],
  ['handful', 'handfuls'], ['can', 'cans'], ['pint', 'pints'], ['shot', 'shots'], ['small bottle', 'small bottles'],
  ['row', 'rows'], ['bag', 'bags'], ['scoop', 'scoops'], ['crêpe', 'crêpes'], ['thigh', 'thighs'], ['fish', 'fish'],
  ['tomato', 'tomatoes'], ['cucumber', 'cucumbers'], ['pepper', 'peppers'], ['carrot', 'carrots'], ['onion', 'onions'],
  ['apple', 'apples'], ['banana', 'bananas'], ['orange', 'oranges'], ['pear', 'pears'], ['bunch', 'bunches'],
  ['plum', 'plums'], ['tangerine', 'tangerines'], ['biscuit', 'biscuits'], ['sandwich', 'sandwiches'], ['roll', 'rolls'],
  ['meatball', 'meatballs'], ['patty', 'patties'], ['sausage', 'sausages'], ['frankfurter', 'frankfurters'],
  ['quarter', 'quarters'], ['cob', 'cobs'], ['stalk', 'stalks'], ['clove', 'cloves'], ['apricot', 'apricots'],
  ['peach', 'peaches'], ['nectarine', 'nectarines'], ['fig', 'figs'], ['date', 'dates'], ['prune', 'prunes'],
  ['doughnut', 'doughnuts'], ['cookie', 'cookies'], ['wafer', 'wafers'], ['sweet', 'sweets'], ['bar', 'bars'],
  ['cone', 'cones'], ['half', 'halves'], ['olive', 'olives'], ['radish', 'radishes'], ['wedge', 'wedges'],
  ['quince', 'quinces'], ['grapefruit', 'grapefruits'], ['flatbread', 'flatbreads'], ['burger', 'burgers'],
  ['wrap', 'wraps'], ['plate', 'plates'], ['toastie', 'toasties'], ['hot dog', 'hot dogs'], ['éclair', 'éclairs'],
];
const LOOKUP = new Map();
for (const pair of FORMS) for (const w of pair) if (!LOOKUP.has(w)) LOOKUP.set(w, pair);

// Units served in containers can be halved (½ bol, 1½ porție); countable things go up by one.
const HALVES = new Set(['bol', 'cană', 'pahar', 'porție', 'porție mică', 'ceașcă', 'halbă', 'cupă', 'mână', 'bowl', 'cup',
  'mug', 'glass', 'serving', 'small serving', 'handful', 'pint', 'scoop', 'plate', 'avocado', 'grepfrut', 'grapefruit',
  'sfert', 'quarter', 'conservă', 'can', 'punguță', 'bag', 'sticlă mică', 'small bottle', 'doză']);

const SIZE_WORDS = new Set(['mediu', 'medie', 'medii', 'mare', 'mari', 'mic', 'mică', 'mici', 'medium', 'large', 'small', 'big']);

function parseCount(s) {
  if (s === '½') return 0.5;
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s.replace(',', '.'));
}

// "3 linguri" + 30 g -> { unitGrams: 10, singular: 'lingură', plural: 'linguri', rest: '' }.
// Returns null when the portion has no leading count ("puțin", "100 g").
export function parsePortion(portion, grams) {
  const m = /^\s*(\d+(?:[.,]\d+)?|\d+\/\d+|½)\s+(.+?)\s*$/.exec(portion || '');
  if (!m || !(grams > 0)) return null;
  const count = parseCount(m[1]);
  if (!(count > 0)) return null;
  const words = m[2].split(/\s+/);
  if (/^(g|gr|grame|ml|kg|l)$/i.test(words[0])) return null; // already a weight
  let forms = null;
  let rest = '';
  if (words.length > 1) {
    forms = LOOKUP.get(words.slice(0, 2).join(' ').toLowerCase());
    if (forms) rest = words.slice(2).join(' ');
  }
  if (!forms) {
    forms = LOOKUP.get(words[0].toLowerCase());
    rest = words.slice(1).join(' ');
  }
  if (!forms) {
    forms = [m[2], m[2]]; // unknown word: keep it as written
    rest = '';
  }
  // Size words don't survive a count change grammatically ("1 ou medii"), so drop them.
  rest = rest.split(/\s+/).filter((w) => w && !SIZE_WORDS.has(w.toLowerCase())).join(' ');
  return { unitGrams: grams / count, singular: forms[0], plural: forms[1], rest };
}

export const unitStep = (unit) => (HALVES.has(unit.singular) || HALVES.has(unit.plural) ? 0.5 : 1);

export function unitCount(unit, grams) {
  return grams / unit.unitGrams;
}

// 0.5 -> "½", 1.5 -> "1½", 2 -> "2", 1.3 -> "1,3".
export function formatCount(n, locale) {
  const r = Math.round(n * 10) / 10;
  const whole = Math.floor(r + 1e-9);
  if (Math.abs(r - whole - 0.5) < 1e-9) return whole ? `${whole}½` : '½';
  if (Math.abs(r - whole) < 1e-9) return String(whole);
  return r.toLocaleString(locale, { maximumFractionDigits: 1 });
}

// "2 ouă", "½ bol", "1 lingură".
export function unitLabel(unit, count, locale) {
  const word = count <= 1 ? unit.singular : unit.plural;
  return `${formatCount(count, locale)} ${word}${unit.rest ? ` ${unit.rest}` : ''}`;
}

// Next count up or down, snapped to the unit's step; never below one step.
export function stepCount(unit, count, dir) {
  const step = unitStep(unit);
  const snapped = dir > 0 ? Math.floor(count / step + 1e-9) * step + step : Math.ceil(count / step - 1e-9) * step - step;
  return Math.min(Math.max(snapped, step), 50);
}
