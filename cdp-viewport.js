const fs = require('fs');
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8787/?v=' + Date.now() + '#quran' });
  await sleep(4000);

  console.log(await ev(`JSON.stringify({
    scrollX, scrollY, innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    header: document.querySelector('.site-header').getBoundingClientRect().toJSON(),
    brand: document.querySelector('.brand').getBoundingClientRect().toJSON(),
    nav: document.querySelector('.nav').getBoundingClientRect().toJSON(),
    container: document.querySelector('main .container') ? document.querySelector('main .container').getBoundingClientRect().toJSON() : null,
    layout: document.querySelector('.quran-layout').getBoundingClientRect().toJSON(),
    aside: document.querySelector('.surah-panel').getBoundingClientRect().toJSON(),
    reader: document.querySelector('.reader').getBoundingClientRect().toJSON()
  })`));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Temp/dshshots/quran-viewport.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved viewport');
  ws.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
