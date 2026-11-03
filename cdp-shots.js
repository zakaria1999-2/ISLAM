const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'C:/Temp/dshshots';

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      if (targets.length) break;
    } catch (e) { /* retry */ }
    await sleep(400);
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result.result ? res.result.result.value : null;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  async function viewport(width, height, mobile = false, scale = 1) {
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: scale, mobile,
      screenWidth: width, screenHeight: height
    });
  }

  async function open(hash, width, height, mobile = false) {
    await viewport(width, height, mobile);
    await send('Page.navigate', { url: `http://127.0.0.1:8787/?v=${Date.now()}${hash}` });
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const ok = await evaluate(`(() => {
        const t = document.querySelector('#heroNextTime');
        const ready = t && t.textContent !== '--:--';
        const q = document.querySelector('#readerBody') && !document.querySelector('#readerBody').hidden;
        const qe = document.querySelector('#readerError') && !document.querySelector('#readerError').hidden;
        return document.readyState === 'complete' && (ready || q || qe);
      })()`);
      if (ok) break;
    }
    await sleep(700);
  }

  async function fullShot(name, width, height, mobile = false) {
    const metrics = await send('Page.getLayoutMetrics');
    const content = metrics.result.cssContentSize;
    const h = Math.min(Math.ceil(content.height), 5200);
    const res = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: Math.min(Math.ceil(content.width), width), height: h, scale: 1 },
      captureBeyondViewport: true
    });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(res.result.data, 'base64'));
    console.log('saved', name, width, h);
  }

  async function clipShot(name, selector, scale = 2) {
    const rect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
    if (!rect) { console.log('missing selector', selector); return; }
    const res = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...rect, scale },
      captureBeyondViewport: true
    });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(res.result.data, 'base64'));
    console.log('saved', name, Math.round(rect.width), Math.round(rect.height));
  }

  // القرآن — سطح المكتب
  await open('#quran', 1440, 2200);
  await fullShot('cdp-quran.png', 1440, 2200);

  // القرآن — جوال
  await open('#quran', 390, 900, true);
  await fullShot('cdp-quran-mobile.png', 390, 900, true);

  // الرئيسية — جوال
  await open('#home', 390, 900, true);
  await fullShot('cdp-home-mobile.png', 390, 900, true);
  await clipShot('cdp-home-mobile-header.png', '.site-header', 2);

  // التسبيح — سطح المكتب
  await open('#tasbih', 1440, 1200);
  await clipShot('cdp-tasbih.png', '.tasbih-panel', 1.6);

  // الوضع الفاتح
  await evaluate(`document.querySelector('#themeToggle').click()`);
  await sleep(600);
  await open('#home', 1440, 1400);
  await fullShot('cdp-home-light.png', 1440, 1400);
  await evaluate(`document.querySelector('#themeToggle').click()`);

  ws.close();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
