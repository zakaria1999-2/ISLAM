const fs = require('fs');
const vm = require('vm');
const ctx = { console, Intl, Date, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/js/data.js', 'utf8') + '\n;this.DATA=DATA;', ctx);
const { DATA } = ctx;

const problems = [];
if (DATA.surahs.length !== 114) problems.push('surahs=' + DATA.surahs.length);
DATA.surahs.forEach((s, i) => {
  if (s.n !== i + 1) problems.push('surah order ' + i + ' ' + s.n);
});
if (DATA.names.length !== 99) problems.push('names=' + DATA.names.length);
const nameSet = new Set(DATA.names.map((n) => n.name));
if (nameSet.size !== DATA.names.length) problems.push('duplicate names');
if (DATA.names[0].name !== 'الله') problems.push('first name ' + DATA.names[0].name);
if (DATA.names[98].name !== 'الرشيد') problems.push('last name ' + DATA.names[98].name);
let zTotal = 0;
for (const cat of DATA.azkar) {
  zTotal += cat.items.length;
  if (!cat.items.length) problems.push('empty cat ' + cat.id);
  for (const item of cat.items) if (!item.text || !item.count) problems.push('bad item in ' + cat.id);
}
Object.keys(DATA.fallbackQuran).forEach((k) => {
  const s = DATA.surahs.find((x) => x.n === Number(k));
  const arr = DATA.fallbackQuran[k];
  if (!s) problems.push('fallback bad surah ' + k);
  else if (s.n !== 1 && s.n !== 9 && arr.length !== s.ayahs) problems.push('fallback ayah count ' + k + ' ' + arr.length + '/' + s.ayahs);
});
console.log('surahs', DATA.surahs.length, 'names', DATA.names.length, 'azkar cats', DATA.azkar.length, 'items', zTotal);
console.log('cities', DATA.cities.length, 'methods', DATA.methods.length, 'verses', DATA.verses.length, 'hadiths', DATA.hadiths.length);
console.log(problems.length ? 'PROBLEMS: ' + problems.join(' | ') : 'DATA OK');
