// The people of each country (founder 2026-11-10): a fixed roster of 100 to 200 per country, of mixed gender and age, each with
// a real hometown of that country and hobbies. Pure and seeded: the same country always gives the same people.
// Hometowns favour the places a coffee hand or a café worker would really come from.
import { NAMES, drawName } from './staff-names.js';

export const AGE = { min: 18, max: 58 };
// Share of people in each age band.
const AGE_BANDS = [[18, 24, .25], [25, 34, .35], [35, 44, .25], [45, 58, .15]];

export const HOMES = {
  vn: 'Buôn Ma Thuột|Đà Lạt|Bảo Lộc|Di Linh|Pleiku|Kon Tum|Gia Nghĩa|Đắk Mil|Khe Sanh|Sơn La|Điện Biên|Nghệ An|Thanh Hóa|Quảng Ngãi|Bình Định|Hà Nội|TP. Hồ Chí Minh|Huế|Cần Thơ|Hải Phòng',
  jp: 'Tokyo|Osaka|Kyoto|Nagoya|Fukuoka|Sapporo|Yokohama|Kobe|Hiroshima|Sendai|Naha|Kanazawa',
  fr: 'Paris|Lyon|Marseille|Bordeaux|Lille|Nantes|Toulouse|Strasbourg|Nice|Rennes|Montpellier|Dijon',
  gb: 'London|Manchester|Birmingham|Leeds|Glasgow|Edinburgh|Liverpool|Bristol|Cardiff|Belfast|Sheffield|Newcastle',
  us: 'Seattle|Portland|New York|Chicago|Los Angeles|San Francisco|Austin|Boston|Denver|Atlanta|Hilo|Kona',
  au: 'Melbourne|Sydney|Brisbane|Perth|Adelaide|Hobart|Canberra|Darwin|Cairns|Byron Bay|Newcastle|Geelong',
  de: 'Berlin|Hamburg|München|Köln|Frankfurt|Stuttgart|Düsseldorf|Leipzig|Dresden|Bremen|Nürnberg|Hannover',
  tr: 'İstanbul|Ankara|İzmir|Gaziantep|Bursa|Antalya|Trabzon|Konya|Adana|Mardin|Şanlıurfa|Eskişehir',
  sa: 'Riyadh|Jeddah|Mecca|Medina|Dammam|Jazan|Abha|Al Baha|Taif|Tabuk|Hail|Buraidah',
  cn: 'Pu’er|Kunming|Baoshan|Lincang|Dehong|Shanghai|Beijing|Chengdu|Guangzhou|Shenzhen|Hangzhou|Xi’an',
  tw: 'Taipei|Kaohsiung|Taichung|Tainan|Hsinchu|Chiayi|Yunlin|Pingtung|Hualien|Taitung|Keelung|Nantou',
  kr: 'Seoul|Busan|Incheon|Daegu|Daejeon|Gwangju|Gangneung|Jeonju|Ulsan|Suwon|Jeju|Chuncheon',
  br: 'São Paulo|Santos|Varginha|Patrocínio|Franca|Vitória|Belo Horizonte|Londrina|Rio de Janeiro|Poços de Caldas|Guaxupé|Porto Velho',
  in: 'Chikmagalur|Coorg|Hassan|Wayanad|Araku|Bengaluru|Chennai|Mumbai|Kochi|Mysuru|Delhi|Hyderabad',
  ca: 'Toronto|Vancouver|Montréal|Calgary|Ottawa|Edmonton|Québec|Winnipeg|Halifax|Victoria|Saskatoon|St. John’s',
  id: 'Medan|Takengon|Lampung|Toraja|Flores|Bandung|Jakarta|Surabaya|Denpasar|Malang|Makassar|Yogyakarta',
  my: 'Kuala Lumpur|Ipoh|Penang|Johor Bahru|Melaka|Kota Kinabalu|Kuching|Tawau|Kluang|Alor Setar|Kuantan|Seremban',
  ru: 'Moscow|Saint Petersburg|Kazan|Novosibirsk|Yekaterinburg|Sochi|Krasnodar|Vladivostok|Samara|Omsk|Irkutsk|Voronezh',
  et: 'Jimma|Yirgacheffe|Sidama|Harar|Bonga|Dilla|Addis Ababa|Hawassa|Gondar|Bahir Dar|Mekelle|Nekemte',
  ke: 'Nyeri|Kirinyaga|Murang’a|Kiambu|Embu|Meru|Nairobi|Mombasa|Kisumu|Nakuru|Eldoret|Kisii',
  ug: 'Mbale|Kapchorwa|Masaka|Kasese|Fort Portal|Mukono|Kampala|Jinja|Gulu|Mbarara|Lira|Entebbe',
  tz: 'Moshi|Arusha|Mbeya|Mbinga|Bukoba|Dar es Salaam|Dodoma|Mwanza|Zanzibar|Iringa|Tanga|Morogoro',
  rw: 'Huye|Nyamasheke|Rusizi|Karongi|Gicumbi|Kigali|Musanze|Rubavu|Muhanga|Nyagatare|Rwamagana|Nyanza',
  bi: 'Kayanza|Ngozi|Kirundo|Muyinga|Gitega|Bujumbura|Rumonge|Makamba|Bururi|Muramvya|Cibitoke|Kirimiro',
  ci: 'Daloa|Man|San-Pédro|Soubré|Gagnoa|Abidjan|Bouaké|Yamoussoukro|Korhogo|Abengourou|Divo|Aboisso',
  za: 'Cape Town|Johannesburg|Durban|Pretoria|Gqeberha|Bloemfontein|Stellenbosch|East London|Pietermaritzburg|Polokwane|Nelspruit|Knysna',
};
// Legacy: every worker used to get one of these, whatever the country. Only used to find and fix old saves.
export const LEGACY_HOMES = new Set(['Buôn Ma Thuột', 'Đà Lạt', 'Bảo Lộc', 'Di Linh', 'Pleiku', 'Kon Tum', 'Gia Nghĩa', 'Đắk Mil', 'Cầu Đất', 'Khe Sanh', 'Sơn La', 'Điện Biên']);

// Keys into the `hobby.*` strings (locales/staff-people.js): shared by everyone, plus a few that belong to one country.
const COMMON_HOBBIES = ['cooking', 'football', 'fishing', 'reading', 'gardening', 'music', 'singing', 'drawing', 'photo', 'hiking', 'cycling', 'running', 'chess', 'games', 'movies', 'baking', 'knitting', 'dancing', 'volunteer', 'birds', 'camping', 'cupping', 'yoga', 'swimming'];
const LOCAL_HOBBIES = {
  vn: ['xiangqi', 'shuttlecock', 'songbirds'], jp: ['shogi', 'onsen', 'karaoke'], fr: ['petanque', 'wine', 'tourcycling'], gb: ['darts', 'allotment', 'pubquiz'],
  us: ['baseball', 'roadtrip', 'bbq'], au: ['surfing', 'cricket', 'bushwalk'], de: ['wandern', 'boardgames', 'handball'], tr: ['tavla', 'ney', 'fortune'],
  sa: ['falconry', 'oud', 'desert'], cn: ['mahjong', 'taichi', 'calligraphy'], tw: ['nightmarket', 'baseball', 'hotspring'], kr: ['baduk', 'kpop', 'noraebang'],
  br: ['capoeira', 'samba', 'futsal'], in: ['cricket', 'carrom', 'yogaAsana'], ca: ['hockey', 'canoe', 'curling'], id: ['batik', 'badminton', 'gamelan'],
  my: ['badminton', 'sepaktakraw', 'batik'], ru: ['banya', 'mushrooms', 'iceFishing'], et: ['buna', 'distance', 'krar'], ke: ['distance', 'rugby7', 'beadwork'],
  ug: ['netball', 'beadwork', 'drums'], tz: ['bao', 'taarab', 'safari'], rw: ['imigongo', 'intore', 'basket'], bi: ['drums', 'distance', 'basket'],
  ci: ['zouglou', 'awale', 'basket'], za: ['braai', 'rugby', 'surfing'],
};

const hashOf = text => { let h = 2166136261; for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const known = country => (HOMES[country] ? country : 'vn');
const pick = (list, r) => list[Math.floor(r() * list.length)];
function shuffled(list, r) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ageFrom(r) {
  let x = r();
  for (const [lo, hi, share] of AGE_BANDS) { if (x < share) return lo + Math.floor(r() * (hi - lo + 1)); x -= share; }
  return AGE.min;
}
function hobbiesFrom(country, r) {
  const pool = shuffled([...COMMON_HOBBIES, ...LOCAL_HOBBIES[country], ...LOCAL_HOBBIES[country]], r), out = [...new Set(pool)];
  return out.slice(0, 2);
}
/** A person's age, hometown and hobbies, from any rng: everyone is someone of that country. */
export function lifeFrom(country, r) {
  const c = known(country);
  return { age: ageFrom(r), home: pick(HOMES[c].split('|'), r), hobbies: hobbiesFrom(c, r) };
}
/** The stable life of someone who has no record yet (old saves), from their uid. */
export const lifeOfSeed = (country, seed) => lifeFrom(country, rngOf(hashOf(`${known(country)}:${seed}`)));

const fullName = (c, given, family) => (c.familyFirst ? `${family} ${given}` : `${given} ${family}`);
const rosters = new Map();
/** Everyone of a country: 100 to 200 people, half of each gender, no two with the same name. */
export function rosterOf(country) {
  const id = known(country);
  if (rosters.has(id)) return rosters.get(id);
  const c = NAMES[id], r = rngOf(hashOf(`roster:${id}`)), size = 100 + hashOf(id) % 101, seen = new Set(), out = [];
  const families = c.last.split(' ');
  for (const gender of ['male', 'female']) {
    const given = shuffled((gender === 'female' ? c.f : c.m).split(' '), r), want = gender === 'male' ? Math.ceil(size / 2) : Math.floor(size / 2);
    const combos = shuffled(given.flatMap((g, i) => families.map((f, j) => ({ g, order: (i * 7 + j) % families.length, f }))), r).sort((a, b) => a.order - b.order);
    for (const { g, f } of combos) {
      if (out.filter(p => p.gender === gender).length >= want) break;
      const name = fullName(c, g, f);
      if (name.length > 20 || seen.has(name)) continue;
      seen.add(name); out.push({ name, gender, country: id, ...lifeFrom(id, r) });
    }
  }
  rosters.set(id, out);
  return out;
}
/** Someone of this country and gender that `taken` does not hold. Draws exactly one r(), so a seeded board keeps its other picks. */
export function drawPerson(country, gender, r, taken) {
  const free = rosterOf(country).filter(p => p.gender === gender && !taken.has(p.name)), roll = r();
  if (free.length) return free[Math.floor(roll * free.length)];
  const name = drawName(country, gender, () => roll, taken); // every one of them is taken: a numbered name
  return { name, gender, country: known(country), ...lifeOfSeed(country, name) };
}
