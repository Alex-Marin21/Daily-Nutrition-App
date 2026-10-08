// Built-in list of common foods for instant search (no AI wait).
// Values per 100 g (standard food-composition tables, rounded), plus a typical
// portion. Columns:
//   [ro name, en name, kcal, protein, carbs, fat, portion g, portion ro, portion en]
// For drinks, 100 g ≈ 100 ml. Alcohol calories are included in kcal only.

const RAW = [
  '#dairy',
  ['Ou fiert', 'Boiled egg', 155, 12.6, 1.1, 10.6, 50, '1 ou', '1 egg'],
  ['Ou ochi (prăjit)', 'Fried egg', 196, 13.6, 0.8, 15.3, 46, '1 ou', '1 egg'],
  ['Omletă', 'Omelette', 154, 10.6, 0.6, 11.7, 120, '2 ouă', '2 eggs'],
  ['Lapte 1,5%', 'Milk 1.5%', 47, 3.4, 4.9, 1.5, 250, '1 cană', '1 cup'],
  ['Lapte 3,5%', 'Whole milk', 64, 3.3, 4.7, 3.5, 250, '1 cană', '1 cup'],
  ['Iaurt', 'Yogurt', 61, 3.5, 4.7, 3.3, 150, '1 pahar', '1 cup'],
  ['Iaurt grecesc', 'Greek yogurt', 97, 9, 3.6, 5, 150, '1 pahar', '1 cup'],
  ['Telemea', 'Feta / white cheese', 264, 14.2, 4.1, 21.3, 50, '1 bucată', '1 piece'],
  ['Brânză de vaci', 'Cottage cheese', 98, 11.1, 3.4, 4.3, 100, '1 porție', '1 serving'],
  ['Cașcaval', 'Yellow cheese', 356, 25, 2.2, 27.4, 20, '1 felie', '1 slice'],
  ['Smântână', 'Sour cream', 204, 2.7, 3.5, 20, 15, '1 lingură', '1 tbsp'],
  ['Unt', 'Butter', 717, 0.9, 0.1, 81, 10, '1 linguriță', '1 tsp'],

  '#bread',
  ['Pâine albă', 'White bread', 265, 9, 49, 3.2, 35, '1 felie', '1 slice'],
  ['Pâine integrală', 'Wholemeal bread', 247, 13, 41, 3.4, 35, '1 felie', '1 slice'],
  ['Covrig', 'Pretzel (covrig)', 300, 9, 58, 3, 80, '1 covrig', '1 pretzel'],
  ['Orez fiert', 'Boiled rice', 130, 2.7, 28, 0.3, 180, '1 porție', '1 serving'],
  ['Paste fierte', 'Cooked pasta', 158, 5.8, 31, 0.9, 200, '1 porție', '1 serving'],
  ['Mămăligă', 'Polenta (mămăligă)', 75, 1.7, 16, 0.4, 250, '1 porție', '1 serving'],
  ['Cartofi fierți', 'Boiled potatoes', 87, 1.9, 20, 0.1, 200, '1 porție', '1 serving'],
  ['Piure de cartofi', 'Mashed potatoes', 113, 2, 16, 4.2, 200, '1 porție', '1 serving'],
  ['Cartofi prăjiți', 'French fries', 312, 3.4, 41, 15, 150, '1 porție', '1 serving'],
  ['Fulgi de ovăz', 'Oats (dry)', 389, 16.9, 66, 6.9, 40, '4 linguri', '4 tbsp'],
  ['Clătită', 'Pancake (crêpe)', 227, 6.4, 28, 9.7, 60, '1 clătită', '1 crêpe'],

  '#meat',
  ['Piept de pui la grătar', 'Grilled chicken breast', 165, 31, 0, 3.6, 150, '1 porție', '1 serving'],
  ['Pulpă de pui la cuptor', 'Roast chicken thigh', 229, 24, 0, 15, 150, '1 pulpă', '1 thigh'],
  ['Șnițel de pui', 'Breaded chicken schnitzel', 250, 20, 12, 13, 150, '1 bucată', '1 piece'],
  ['Cotlet de porc', 'Pork chop', 231, 25.7, 0, 13.6, 150, '1 bucată', '1 piece'],
  ['Ceafă de porc la grătar', 'Grilled pork neck', 270, 22, 0, 20, 150, '1 bucată', '1 piece'],
  ['Friptură de vită', 'Beef steak', 250, 26, 0, 15, 150, '1 porție', '1 serving'],
  ['Mici', 'Mici (grilled sausages)', 270, 16, 1, 22, 50, '1 mic', '1 piece'],
  ['Cârnați', 'Sausages', 300, 12, 2, 27, 100, '1 porție', '1 serving'],
  ['Salam', 'Salami', 336, 22, 1.2, 26, 30, '3 felii', '3 slices'],
  ['Șuncă', 'Ham', 145, 21, 1.5, 6, 40, '2 felii', '2 slices'],
  ['Păstrăv la grătar', 'Grilled trout', 168, 24, 0, 7.4, 200, '1 pește', '1 fish'],
  ['Somon', 'Salmon', 206, 22, 0, 12.4, 150, '1 porție', '1 serving'],
  ['Ton în apă (conservă)', 'Tuna in water (can)', 116, 26, 0, 0.8, 120, '1 conservă', '1 can'],

  '#dishes',
  ['Ciorbă de perișoare', 'Meatball soup', 55, 3.5, 4, 2.8, 350, '1 bol', '1 bowl'],
  ['Ciorbă de burtă', 'Tripe soup', 80, 5, 3, 5, 350, '1 bol', '1 bowl'],
  ['Supă de pui cu tăiței', 'Chicken noodle soup', 40, 2.5, 4.5, 1.2, 350, '1 bol', '1 bowl'],
  ['Ciorbă de legume', 'Vegetable soup', 35, 1.2, 5, 1.2, 350, '1 bol', '1 bowl'],
  ['Ciorbă de fasole', 'Bean soup', 70, 4, 9, 2, 350, '1 bol', '1 bowl'],
  ['Sarmale', 'Sarmale (cabbage rolls)', 170, 8, 9, 11, 210, '3 bucăți', '3 rolls'],
  ['Tocăniță de cartofi', 'Potato stew', 90, 1.8, 12, 4, 300, '1 porție', '1 serving'],
  ['Fasole bătută', 'Bean dip (fasole bătută)', 130, 6, 15, 5, 200, '1 porție', '1 serving'],
  ['Fasole cu cârnați', 'Beans with sausages', 140, 8, 12, 7, 300, '1 porție', '1 serving'],
  ['Varză călită', 'Braised cabbage', 70, 1.5, 7, 4, 200, '1 porție', '1 serving'],
  ['Ghiveci de legume', 'Vegetable stew', 70, 1.5, 7, 4, 250, '1 porție', '1 serving'],
  ['Musaca', 'Moussaka', 150, 7, 10, 9, 300, '1 porție', '1 serving'],
  ['Pilaf cu pui', 'Chicken pilaf', 150, 8, 20, 4, 300, '1 porție', '1 serving'],
  ['Tochitură', 'Tochitură (pork stew)', 220, 15, 3, 17, 300, '1 porție', '1 serving'],
  ['Salată de boeuf', 'Beef salad (salată de boeuf)', 170, 4, 9, 13, 150, '1 porție', '1 serving'],
  ['Zacuscă', 'Zacuscă (vegetable spread)', 120, 1.5, 8, 9, 40, '2 linguri', '2 tbsp'],
  ['Papanași', 'Papanași (doughnuts)', 280, 7, 35, 12, 200, '1 porție', '1 serving'],
  ['Cozonac', 'Sweet bread (cozonac)', 340, 7, 55, 10, 60, '1 felie', '1 slice'],
  ['Pizza', 'Pizza', 266, 11, 33, 10, 110, '1 felie', '1 slice'],
  ['Hamburger', 'Hamburger', 250, 13, 24, 11, 200, '1 bucată', '1 burger'],
  ['Shaorma', 'Shawarma wrap', 220, 10, 22, 10, 400, '1 porție', '1 wrap'],
  ['Sandviș cu șuncă și cașcaval', 'Ham & cheese sandwich', 260, 13, 28, 11, 150, '1 sandviș', '1 sandwich'],

  '#veg',
  ['Salată verde', 'Lettuce', 15, 1.4, 2.9, 0.2, 100, '1 bol', '1 bowl'],
  ['Roșii', 'Tomatoes', 18, 0.9, 3.9, 0.2, 120, '1 roșie', '1 tomato'],
  ['Castraveți', 'Cucumber', 15, 0.7, 3.6, 0.1, 150, '1 castravete', '1 cucumber'],
  ['Ardei gras', 'Bell pepper', 20, 0.9, 4.6, 0.2, 120, '1 ardei', '1 pepper'],
  ['Salată de roșii și castraveți', 'Tomato & cucumber salad', 60, 0.8, 3.5, 4.6, 200, '1 bol', '1 bowl'],
  ['Morcov', 'Carrot', 41, 0.9, 9.6, 0.2, 60, '1 morcov', '1 carrot'],
  ['Broccoli fiert', 'Boiled broccoli', 35, 2.4, 7.2, 0.4, 150, '1 porție', '1 serving'],
  ['Ciuperci', 'Mushrooms', 22, 3.1, 3.3, 0.3, 100, '1 porție', '1 serving'],
  ['Murături', 'Pickles', 11, 0.3, 2.3, 0.2, 100, '1 porție', '1 serving'],
  ['Ceapă', 'Onion', 40, 1.1, 9.3, 0.1, 100, '1 ceapă', '1 onion'],

  '#fruit',
  ['Măr', 'Apple', 52, 0.3, 13.8, 0.2, 180, '1 măr', '1 apple'],
  ['Banană', 'Banana', 89, 1.1, 22.8, 0.3, 120, '1 banană', '1 banana'],
  ['Portocală', 'Orange', 47, 0.9, 11.8, 0.1, 150, '1 portocală', '1 orange'],
  ['Pară', 'Pear', 57, 0.4, 15, 0.1, 170, '1 pară', '1 pear'],
  ['Struguri', 'Grapes', 69, 0.7, 18, 0.2, 150, '1 ciorchine', '1 bunch'],
  ['Căpșuni', 'Strawberries', 32, 0.7, 7.7, 0.3, 150, '1 bol', '1 bowl'],
  ['Pepene roșu', 'Watermelon', 30, 0.6, 7.6, 0.2, 300, '1 felie', '1 slice'],
  ['Prune', 'Plums', 46, 0.7, 11.4, 0.3, 150, '5 prune', '5 plums'],
  ['Cireșe', 'Cherries', 63, 1.1, 16, 0.2, 150, '1 bol', '1 bowl'],
  ['Mandarine', 'Tangerines', 53, 0.8, 13.3, 0.3, 150, '2 mandarine', '2 tangerines'],

  '#sweets',
  ['Ciocolată cu lapte', 'Milk chocolate', 535, 7.6, 59, 30, 25, '1 rând', '1 row'],
  ['Ciocolată neagră', 'Dark chocolate', 598, 7.8, 46, 43, 25, '1 rând', '1 row'],
  ['Biscuiți', 'Biscuits', 480, 7, 64, 21, 30, '4 biscuiți', '4 biscuits'],
  ['Prăjitură', 'Cake', 380, 5, 50, 18, 100, '1 felie', '1 slice'],
  ['Înghețată', 'Ice cream', 207, 3.5, 24, 11, 100, '1 cupă', '1 scoop'],
  ['Nuci', 'Walnuts', 654, 15, 14, 65, 30, '1 mână', '1 handful'],
  ['Migdale', 'Almonds', 579, 21, 22, 50, 30, '1 mână', '1 handful'],
  ['Semințe de floarea-soarelui', 'Sunflower seeds', 584, 21, 20, 51, 30, '1 mână', '1 handful'],
  ['Chipsuri', 'Crisps / chips', 536, 7, 53, 35, 50, '1 punguță', '1 bag'],
  ['Miere', 'Honey', 304, 0.3, 82, 0, 20, '1 lingură', '1 tbsp'],
  ['Dulceață', 'Jam', 250, 0.4, 64, 0.1, 20, '1 lingură', '1 tbsp'],
  ['Zahăr', 'Sugar', 387, 0, 100, 0, 5, '1 linguriță', '1 tsp'],

  '#drinks',
  ['Cafea neagră', 'Black coffee', 2, 0.1, 0, 0, 150, '1 ceașcă', '1 cup'],
  ['Cafea cu lapte', 'Coffee with milk', 50, 3, 4.6, 2.4, 250, '1 cană', '1 mug'],
  ['Ceai neîndulcit', 'Unsweetened tea', 1, 0, 0.2, 0, 250, '1 cană', '1 mug'],
  ['Suc de portocale', 'Orange juice', 45, 0.7, 10.4, 0.2, 250, '1 pahar', '1 glass'],
  ['Suc carbogazos (cola)', 'Soft drink (cola)', 42, 0, 10.6, 0, 330, '1 doză', '1 can'],
  ['Bere', 'Beer', 43, 0.5, 3.6, 0, 500, '1 halbă', '1 pint'],
  ['Vin roșu', 'Red wine', 85, 0.1, 2.6, 0, 150, '1 pahar', '1 glass'],
  ['Vin alb', 'White wine', 82, 0.1, 2.6, 0, 150, '1 pahar', '1 glass'],
  ['Țuică / pălincă', 'Plum brandy (țuică)', 231, 0, 0, 0, 50, '1 păhărel', '1 shot'],

  '#fats',
  ['Ulei (floarea-soarelui / măsline)', 'Oil (sunflower / olive)', 884, 0, 0, 100, 15, '1 lingură', '1 tbsp'],
  ['Maioneză', 'Mayonnaise', 680, 1, 0.6, 75, 15, '1 lingură', '1 tbsp'],
  ['Ketchup', 'Ketchup', 112, 1.2, 26, 0.1, 15, '1 lingură', '1 tbsp'],
];

// Extra words people type (plurals, everyday names) that should find a food.
const ALIASES = {
  'Ou fiert': 'oua ouă ou fierte oua fierte eggs', 'Ou ochi (prăjit)': 'oua ouă prajite eggs', 'Omletă': 'oua ouă eggs',
  'Măr': 'mere', 'Banană': 'banane', 'Portocală': 'portocale', 'Pară': 'pere', 'Castraveți': 'castravete',
  'Roșii': 'rosie roșie', 'Mandarine': 'mandarina mandarină', 'Prune': 'pruna prună',
  'Pâine albă': 'paine franzela franzelă', 'Cartofi fierți': 'cartof', 'Piept de pui la grătar': 'carne pui',
  'Friptură de vită': 'carne vita vită', 'Cotlet de porc': 'carne porc', 'Cafea cu lapte': 'cappuccino latte',
  'Brânză de vaci': 'branza brânză', 'Telemea': 'branza brânză', 'Iaurt': 'iaurt lapte batut', 'Suc carbogazos (cola)': 'cola pepsi fanta suc',
  'Ciocolată cu lapte': 'ciocolata', 'Ulei (floarea-soarelui / măsline)': 'ulei', 'Mici': 'mititei',
};

// Categories for browsing, in display order. '#key' rows in RAW start a category.
export const CATEGORIES = [
  { key: 'dairy', icon: '🥚', ro: 'Ouă și lactate', en: 'Eggs & dairy' },
  { key: 'bread', icon: '🍞', ro: 'Pâine și garnituri', en: 'Bread & sides' },
  { key: 'meat', icon: '🍗', ro: 'Carne și pește', en: 'Meat & fish' },
  { key: 'dishes', icon: '🍲', ro: 'Mâncăruri', en: 'Dishes' },
  { key: 'veg', icon: '🥗', ro: 'Legume', en: 'Vegetables' },
  { key: 'fruit', icon: '🍎', ro: 'Fructe', en: 'Fruit' },
  { key: 'sweets', icon: '🍫', ro: 'Dulciuri și gustări', en: 'Sweets & snacks' },
  { key: 'drinks', icon: '☕', ro: 'Băuturi', en: 'Drinks' },
  { key: 'fats', icon: '🧈', ro: 'Grăsimi și sosuri', en: 'Fats & sauces' },
];

export const FOODS = [];
let category = 'dairy';
for (const row of RAW) {
  if (typeof row === 'string') {
    category = row.slice(1);
    continue;
  }
  const [ro, en, kcal, protein, carbs, fat, grams, portionRo, portionEn] = row;
  FOODS.push({
    id: FOODS.length, ro, en, kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat,
    grams, portionRo, portionEn, aliases: ALIASES[ro] || '', category,
  });
}

export const foodsInCategory = (key) => FOODS.filter((f) => f.category === key);

// Shown before the user types anything.
export const POPULAR = [
  'Pâine albă', 'Ou fiert', 'Cafea cu lapte', 'Ciorbă de perișoare', 'Mămăligă', 'Piept de pui la grătar',
  'Cartofi fierți', 'Salată de roșii și castraveți', 'Sarmale', 'Măr', 'Iaurt', 'Telemea',
].map((n) => FOODS.find((f) => f.ro === n)).filter(Boolean);

// Lowercase and strip Romanian diacritics so "oua" finds "Ouă".
export const fold = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[șş]/g, 's').replace(/[țţ]/g, 't');

// Every typed word must start a word in the Romanian or English name.
export function searchFoods(query, limit = 8) {
  const words = fold(query).split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  if (!words.length) return [];
  const scored = [];
  for (const f of FOODS) {
    const names = `${fold(f.ro)} ${fold(f.en)}`.split(/[^a-z0-9]+/);
    const hay = names.concat(fold(f.aliases).split(/[^a-z0-9]+/));
    if (!words.every((w) => hay.some((h) => h.startsWith(w)))) continue;
    // Best: name starts with the first word; then: found in the name; last: only via an alias.
    const starts = fold(f.ro).startsWith(words[0]) || fold(f.en).startsWith(words[0]);
    const inName = words.every((w) => names.some((h) => h.startsWith(w)));
    const rank = starts ? 0 : inName ? 1 : 2;
    // Ties: list order (more common foods are listed first).
    scored.push([rank, f.id, f]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map((s) => s[2]);
}
