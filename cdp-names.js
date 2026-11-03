const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result.result.value; };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:8787/?z=' + Date.now() + '#names' });
  await sleep(2500);
  console.log(await ev(`JSON.stringify({
    inner: innerWidth, scrollX, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    container: document.querySelector('main').getBoundingClientRect().toJSON(),
    head: document.querySelector('.page-head').getBoundingClientRect().toJSON(),
    h1: document.querySelector('#namesTitle').getBoundingClientRect().toJSON(),
    kicker: document.querySelector('#page-names .kicker').getBoundingClientRect().toJSON(),
    lead: document.querySelector('#page-names .lead').getBoundingClientRect().toJSON(),
    toolbar: document.querySelector('.names-toolbar').getBoundingClientRect().toJSON(),
    search: document.querySelector('.names-toolbar .search-box').getBoundingClientRect().toJSON(),
    grid: document.querySelector('.names-grid').getBoundingClientRect().toJSON(),
    card: document.querySelector('.name-card').getBoundingClientRect().toJSON(),
    wide: [...document.querySelectorAll('#page-names *')].map(e => { const r = e.getBoundingClientRect(); return { c: (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName, right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) }; }).filter(o => o.right > innerWidth + 1 || o.left < -1 || o.w > innerWidth + 1)
  })`));
  ws.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
