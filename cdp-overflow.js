const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find((t) => t.type === 'page');
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
    return res.result.result.value;
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8787/?v=' + Date.now() + '#quran' });
  await sleep(4000);

  const info = await evaluate(`JSON.stringify({
    innerWidth: innerWidth,
    scrollX: scrollX,
    docScroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    docRect: document.documentElement.getBoundingClientRect().toJSON(),
    wide: [...document.querySelectorAll('body *')].map(e => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, cls: (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '', x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), pos: getComputedStyle(e).position };
    }).filter(o => o.w > innerWidth + 2 || o.right > innerWidth + 2 || o.x < -2).slice(0, 30)
  })`);
  console.log(info);
  ws.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
