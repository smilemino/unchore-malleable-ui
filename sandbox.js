// sandbox.js — run a screen an AI wrote for one user, without letting it touch your app.
//
// 1. Markup and CSS are drawn by a small trusted renderer inside an opaque-origin iframe
//    (sandbox="allow-scripts", no allow-same-origin): no cookies, no storage, no parent DOM.
// 2. The screen's own logic runs in a Web Worker started inside that iframe. The worker
//    inherits the iframe's CSP (connect-src 'none'), so fetch, WebSocket and importScripts fail.
// 3. The renderer keeps an allow-list of tags and attributes. <script>, <img>, <a>, <form>
//    and every on* handler are dropped before anything reaches the page.
// 4. A watchdog pings the worker. A screen that freezes or crashes is stopped, and the
//    caller keeps the previous screen. New screens are test-run hidden before they are shown.

const FRAME = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-renderer'; worker-src blob:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><style id="design"></style><style>html,body{margin:0;height:100%;box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}</style></head><body><div id="root" style="height:100%"></div><script nonce="renderer">
const root = document.getElementById('root');
const TAGS = new Set('DIV SPAN P H1 H2 H3 H4 HEADER FOOTER MAIN NAV SECTION ARTICLE ASIDE BUTTON INPUT TEXTAREA SELECT OPTION LABEL UL OL LI STRONG B EM I SMALL BR HR PRE CODE PROGRESS'.split(' '));
const ATTRS = new Set('class style title role aria-label type name value placeholder checked disabled min max data-action for'.split(' '));
function clean(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of [...doc.body.querySelectorAll('*')]) {
    if (!TAGS.has(el.tagName)) { el.remove(); continue; }
    for (const a of [...el.attributes]) if (!ATTRS.has(a.name)) el.removeAttribute(a.name);
  }
  return doc.body.innerHTML;
}
let worker;
addEventListener('message', e => {
  if (e.source !== parent || !e.data) return;
  const d = e.data;
  if (d.kind === 'start' && !worker) {
    try {
      const url = URL.createObjectURL(new Blob([d.source], { type: 'text/javascript' }));
      worker = new Worker(url); URL.revokeObjectURL(url);
      worker.onmessage = ({ data }) => {
        if (data && data.kind === 'render') {
          root.innerHTML = clean(String(data.html).slice(0, 100000));
          document.getElementById('design').textContent = String(data.css || '').slice(0, 60000);
        }
        parent.postMessage({ kind: 'worker', data: data && data.kind === 'render' ? { kind: 'render' } : data }, '*');
      };
      worker.onerror = () => parent.postMessage({ kind: 'crash' }, '*');
    } catch { parent.postMessage({ kind: 'crash' }, '*'); }
  }
  if (d.kind === 'to-worker') worker && worker.postMessage(d.data);
  if (d.kind === 'stop') worker && worker.terminate();
});
function act(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const values = {};
  for (const i of root.querySelectorAll('input[name],textarea[name],select[name]')) values[i.name] = i.type === 'checkbox' ? i.checked : i.value;
  worker && worker.postMessage({ kind: 'action', event: { action: el.dataset.action, value: el.value, values } });
}
root.addEventListener('click', e => { if (e.target.closest('button')) act(e); });
root.addEventListener('change', act);
parent.postMessage({ kind: 'ready' }, '*');
</script></body></html>`;

// What the AI-written code can use: ui.render(html, css), ui.onAction(fn), ui.load(key), ui.save(key, value).
const BOOT = `
const ui = (() => {
  let next = 0, handler = () => {}; const waiting = new Map();
  const ask = (op, args) => new Promise((ok, fail) => {
    const id = ++next; waiting.set(id, { ok, fail });
    setTimeout(() => { if (waiting.delete(id)) fail(Error('timed out')); }, 5000);
    postMessage({ kind: 'ask', id, op, args });
  });
  addEventListener('message', ({ data: d }) => {
    if (d.kind === 'ping') postMessage({ kind: 'pong' });
    if (d.kind === 'action') Promise.resolve().then(() => handler(d.event)).catch(e => postMessage({ kind: 'error', text: String(e && e.message) }));
    if (d.kind === 'answer') { const w = waiting.get(d.id); if (w) { waiting.delete(d.id); w.ok(d.value); } }
  });
  return Object.freeze({
    render: (html, css = '') => postMessage({ kind: 'render', html, css }),
    onAction: fn => { handler = fn; },
    load: key => ask('load', { key }),
    save: (key, value) => ask('save', { key, value }),
  });
})();
`;

// store: { load(key), save(key, value) } — the host decides where a user's data lives.
// Resolves { ok: true, frame, stop } once the screen has drawn and answered a ping,
// or { ok: false, reason } if it crashed, froze or never drew. onFail fires if it dies later.
export function mountScreen(container, code, { store, onFail = () => {}, testMs = 1500 } = {}) {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.title = 'Your screen';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden';
    let drawn = false, lastPong = Date.now(), live = false, dead = false;
    const started = Date.now();
    const send = m => frame.contentWindow && frame.contentWindow.postMessage(m, '*');
    const stop = () => { dead = true; clearInterval(timer); removeEventListener('message', receive); send({ kind: 'stop' }); frame.remove(); };
    const fail = reason => {
      if (dead) return;
      stop();
      if (live) onFail(reason); else resolve({ ok: false, reason });
    };
    async function receive(e) {
      if (e.source !== frame.contentWindow || !e.data) return;
      const d = e.data;
      if (d.kind === 'ready') send({ kind: 'start', source: BOOT + '\n' + code });
      if (d.kind === 'crash') fail('crashed');
      if (d.kind !== 'worker') return;
      const w = d.data || {};
      if (w.kind === 'render') drawn = true;
      if (w.kind === 'pong') lastPong = Date.now();
      if (w.kind === 'ask' && store) {
        const key = String(w.args && w.args.key || '').slice(0, 100);
        const value = w.op === 'save' ? await store.save(key, w.args.value) : await store.load(key);
        send({ kind: 'to-worker', data: { kind: 'answer', id: w.id, value } });
      }
    }
    addEventListener('message', receive);
    const timer = setInterval(() => {
      if (Date.now() - lastPong > 2000) return fail('froze');
      send({ kind: 'to-worker', data: { kind: 'ping' } });
      if (!live && drawn && Date.now() - started > testMs && Date.now() - lastPong < 1000) {
        live = true; frame.style.visibility = 'visible';
        resolve({ ok: true, frame, stop });
      }
      if (!live && Date.now() - started > testMs + 3000) fail(drawn ? 'froze' : 'never drew');
    }, 250);
    frame.srcdoc = FRAME;
    container.appendChild(frame);
  });
}
