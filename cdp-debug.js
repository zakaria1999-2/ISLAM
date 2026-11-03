const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      if (targets.length) break;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  const page = targets && targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

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
    if (res.result.exceptionDetails) return { error: res.result.exceptionDetails.text, detail: res.result.exceptionDetails.exception && res.result.exceptionDetails.exception.description };
    return res.result.result.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8787/#prayer' });
  await sleep(6000);

  const info = await evaluate(`JSON.stringify({
    dir: document.documentElement.dir,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
    casa: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Casablanca' }),
    offset: Prayer.tzOffsetHours(new Date(), 'Africa/Casablanca'),
    parts: Prayer.zonedParts(new Date(), 'Africa/Casablanca'),
    times: (() => { const c = DATA.cities.find(x => x.name === 'الدار البيضاء'); const r = Prayer.timesForCity(c, DATA.methods.find(m => m.id === 'morocco')); return Object.fromEntries(Prayer.PRAYER_KEYS.map(k => [k, r.timings[k].h + ':' + r.timings[k].m + ' ' + r.timings[k].date.toISOString()])); })(),
    next: document.querySelector('#pNextTime').textContent,
    city: document.querySelector('#citySelect').value,
    header: [...document.querySelector('.header-inner').children].map(e => ({ c: e.className, x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width) })),
    toolbar: [...document.querySelectorAll('.names-toolbar > *')].map(e => ({ c: e.className, x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width) }))
  })`);
  console.log('INFO', info);

  await send('Page.navigate', { url: 'http://127.0.0.1:8787/#names' });
  await sleep(5000);
  const layout = await evaluate(`JSON.stringify({
    toolbar: [...document.querySelectorAll('.names-toolbar > *')].map(e => ({ c: e.className, x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width) })),
    grid: document.querySelector('.names-grid').getBoundingClientRect().toJSON(),
    title: document.querySelector('#namesTitle').getBoundingClientRect().toJSON(),
    container: document.querySelector('.container').getBoundingClientRect().toJSON()
  })`);
  console.log('NAMES', layout);

  ws.close();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
