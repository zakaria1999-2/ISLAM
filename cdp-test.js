const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception || {}).description);
  };
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return 'ERR ' + r.result.exceptionDetails.text;
    return r.result.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: 'http://127.0.0.1:8787/?t=' + Date.now() + '#azkar' });
  await sleep(2500);
  console.log('AZKAR BEFORE', await ev(`JSON.stringify({ first: document.querySelector('.z-count').textContent.trim(), progress: document.querySelector('#azkarProgressText').textContent, cards: document.querySelectorAll('.azkar-card').length })`));
  await ev(`document.querySelector('.z-count').click()`);
  await sleep(300);
  console.log('AZKAR AFTER', await ev(`JSON.stringify({ first: document.querySelector('.z-count').textContent.trim(), progress: document.querySelector('#azkarProgressText').textContent, stored: localStorage.getItem('azkarDone') })`));

  await ev(`location.hash = 'tasbih'`);
  await sleep(800);
  await ev(`document.querySelector('#tasbihBtn').click(); document.querySelector('#tasbihBtn').click(); document.querySelector('#tasbihBtn').click()`);
  await sleep(400);
  console.log('TASBIH', await ev(`JSON.stringify({ count: document.querySelector('#tasbihCount').textContent, today: document.querySelector('#tasbihToday').textContent, ring: document.querySelector('#ringProgress').style.strokeDashoffset })`));

  await ev(`location.hash = 'quran'`);
  await sleep(1200);
  await ev(`document.querySelector('[data-surah="112"]').click()`);
  await sleep(2500);
  console.log('QURAN 112', await ev(`JSON.stringify({ body: !document.querySelector('#readerBody').hidden, error: !document.querySelector('#readerError').hidden, ayahs: document.querySelectorAll('.ayah').length, title: document.querySelector('#readerTitle').textContent, audio: document.querySelector('#surahAudio').getAttribute('src') })`));

  await ev(`document.querySelector('.nav-link[data-page="names"]').click()`);
  await sleep(600);
  console.log('NAMES', await ev(`JSON.stringify({ cards: document.querySelectorAll('.name-card').length, count: document.querySelector('#namesCount').textContent, page: location.hash })`));

  // الجوال: فحص التجاوز الأفقي
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:8787/?m=' + Date.now() + '#home' });
  await sleep(2500);
  console.log('MOBILE', await ev(`JSON.stringify({ inner: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, brand: document.querySelector('.brand').getBoundingClientRect().toJSON(), nav: document.querySelector('.nav').getBoundingClientRect().toJSON(), hero: document.querySelector('.hero-copy').getBoundingClientRect().toJSON(), card: document.querySelector('.prayer-card').getBoundingClientRect().toJSON() })`));
  console.log('ERRORS', errors.length ? errors.join(' || ') : 'none');
  ws.close();
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
