const fs = require('fs');
const vm = require('vm');
const ctx = { console, Intl, Date, Math };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync('assets/js/data.js', 'utf8') + '\n' +
  fs.readFileSync('assets/js/prayer.js', 'utf8') + '\n;this.Prayer=Prayer;this.DATA=DATA;',
  ctx
);
const { Prayer, DATA } = ctx;
const city = DATA.cities.find(c => c.name === 'الدار البيضاء');
const method = DATA.methods.find(m => m.id === 'morocco');
const r = Prayer.timesForCity(city, method, new Date('2026-10-23T12:00:00Z'));
for (const k of Prayer.PRAYER_KEYS) {
  const t = r.timings[k];
  console.log(k.padEnd(9), String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0'), t.date.toISOString());
}
const n = Prayer.nextPrayer(r, new Date('2026-10-23T12:00:00Z'));
console.log('next:', n.timing.label, n.timing.h + ':' + n.timing.m, 'tomorrow?', n.tomorrow);
console.log('qibla Casa:', Prayer.qiblaBearing(33.5731, -7.5898).toFixed(1), 'dist:', Prayer.distanceToKaaba(33.5731, -7.5898));
console.log('hijri:', Prayer.hijriParts(new Date('2026-10-23T12:00:00Z')).text);
const c = DATA.cities.find(x => x.name === 'لندن');
const rr = Prayer.timesForCity(c, DATA.methods[0], new Date('2026-10-23T12:00:00Z'));
console.log('London:', Prayer.PRAYER_KEYS.map(k => k + '=' + rr.timings[k].h + ':' + String(rr.timings[k].m).padStart(2, '0')).join(' '));
