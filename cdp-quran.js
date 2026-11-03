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
  if (!page) { console.log('NO PAGE'); return; }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') events.push('EXC ' + JSON.stringify(msg.params.exceptionDetails.text));
    else if (msg.method === 'Runtime.consoleAPICalled') events.push('LOG ' + msg.params.args.map(a => a.value).join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.result.exceptionDetails) return 'ERR ' + JSON.stringify(res.result.exceptionDetails.text);
    return res.result.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(e.message+' @'+e.filename+':'+e.lineno)});window.addEventListener('unhandledrejection',function(e){window.__errs.push('rej:'+e.reason)});"
  });

  await send('Page.navigate', { url: 'http://127.0.0.1:8787/#quran' });
  await sleep(5000);

  const info = await evaluate(`JSON.stringify({
    ready: document.readyState,
    errs: window.__errs,
    selected: (function(){ try { return DATA ? 'data-ok' : 'no-data'; } catch(e){ return 'no-global'; } })(),
    loading: document.querySelector('#readerLoading') ? !document.querySelector('#readerLoading').hidden : 'missing',
    body: document.querySelector('#readerBody') ? !document.querySelector('#readerBody').hidden : 'missing',
    error: document.querySelector('#readerError') ? !document.querySelector('#readerError').hidden : 'missing',
    ayahs: document.querySelectorAll('.ayah').length,
    title: document.querySelector('#readerTitle') ? document.querySelector('#readerTitle').textContent : 'missing',
    list: document.querySelectorAll('.surah-item').length,
    audioSrc: document.querySelector('#surahAudio') ? document.querySelector('#surahAudio').getAttribute('src') : 'missing'
  })`);
  console.log('QURAN', info);
  console.log('EVENTS', events.slice(0, 10));

  ws.close();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
