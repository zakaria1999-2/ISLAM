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

  async function shot(name, hash, width, height, mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await send('Page.navigate', { url: `http://127.0.0.1:8787/?x=${Date.now()}${hash}` });
    await sleep(3000);
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:/Temp/dshshots/' + name, Buffer.from(res.result.data, 'base64'));
    console.log('saved', name, width, height);
  }

  await shot('m-prayer.png', '#prayer', 390, 844, true);
  await shot('m-azkar.png', '#azkar', 390, 844, true);
  await shot('m-qibla.png', '#qibla', 390, 844, true);
  await shot('m-names.png', '#names', 390, 844, true);
  await shot('d-qibla.png', '#qibla', 1440, 1000, false);
  ws.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
