const fs = require('fs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      if (targets.length) break;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  const page = targets && targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false
  });

  async function evalJs(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result.result.value;
  }

  async function open(hash) {
    await send('Page.navigate', { url: 'http://127.0.0.1:8787/' + hash });
    await sleep(4500);
  }

  async function shot(file, selector) {
    const metrics = await send('Page.getLayoutMetrics');
    const pageHeight = Math.ceil(metrics.result.cssContentSize.height);
    let clip = { x: 0, y: 0, width: 1440, height: Math.min(pageHeight, 4200), scale: 1 };
    if (selector) {
      const raw = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height }; })()`);
      if (raw) clip = { ...raw, scale: 2 };
    }
    const res = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true
    });
    fs.writeFileSync(file, Buffer.from(res.result.data, 'base64'));
    console.log('saved', file, clip.width, clip.height);
  }

  await open('');
  const cd = await evalJs(`JSON.stringify({
    dir: getComputedStyle(document.querySelector('#heroCountdown')).direction,
    boxes: [...document.querySelectorAll('#heroCountdown .cd')].map(e => ({ t: e.innerText.replace(/\\n/g,' '), x: Math.round(e.getBoundingClientRect().x) })),
    next: document.querySelector('#heroNextTime').textContent,
    name: document.querySelector('#heroNextName').textContent
  })`);
  console.log('COUNTDOWN', cd);
  await shot('preview-card.png', '.prayer-card');
  await shot('shot-home-full.png', null);

  await open('#prayer');
  await shot('shot-prayer.png', null);

  await open('#quran');
  const qInfo = await evalJs(`JSON.stringify({ body: !document.querySelector('#readerBody').hidden, ayahs: document.querySelectorAll('.ayah').length, err: !document.querySelector('#readerError').hidden, title: document.querySelector('#readerTitle').textContent })`);
  console.log('QURAN', qInfo);
  await shot('shot-quran.png', null);

  await open('#azkar');
  await shot('shot-azkar.png', null);

  await open('#tasbih');
  await shot('shot-tasbih.png', null);

  await open('#names');
  await shot('shot-names.png', null);

  await open('#qibla');
  await shot('shot-qibla.png', null);

  ws.close();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
