# Runs the demo in headless Chromium and checks every promise the README makes.
# Set DEMO_URL to test a deployed copy instead of a local server.
import http.server, threading, functools, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = os.environ.get("DEMO_URL") or f"http://127.0.0.1:{srv.server_port}/index.html"
fails = []
def check(name, ok):
    print(("PASS " if ok else "FAIL ") + name); ok or fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1100, "height": 760})
    page = ctx.new_page()
    outside, dialogs, errors = [], [], []
    page.on("request", lambda r: "example.com" in r.url and outside.append(r.url))
    page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    toast = page.locator("#toast")
    frame_sel = "#device iframe"
    check("starts on default screen", page.locator(frame_sel).count() == 0)

    page.fill("#say", "bigger text please"); page.click("#ask button")
    page.wait_for_function("document.querySelector('#toast').textContent.startsWith('Done')", timeout=8000)
    f = page.frame_locator(frame_sel)
    check("spoken request changes the screen", f.locator("nav").inner_text().startswith("Chats"))
    fr = next(x for x in page.frames if x != page.main_frame)
    check("menu moved to the right and text got bigger", fr.evaluate("() => { const n = document.querySelector('nav'), m = document.querySelector('main'); return n.getBoundingClientRect().x > m.getBoundingClientRect().x && getComputedStyle(document.querySelector('.app')).fontSize === '20px'; }"))
    page.screenshot(path=os.path.join(ROOT, "test", "shot-bigger.png"))

    page.click("text=Show today's to-dos above the chat")
    page.wait_for_function("document.querySelectorAll('#device iframe').length === 1 && document.querySelector('#toast').textContent.includes('to-dos')", timeout=8000)
    f = page.frame_locator(frame_sel)
    f.locator("input[name=item]").fill("Send the invoice"); f.locator("button[data-action=add]").click()
    f.locator("li").first.wait_for(timeout=5000)
    page.reload()
    page.wait_for_function("document.querySelector('#toast').textContent.startsWith('Welcome back')", timeout=8000)
    check("to-do survives a reload", "Send the invoice" in page.frame_locator(frame_sel).locator("ul").inner_text())
    page.screenshot(path=os.path.join(ROOT, "test", "shot-todo.png"))

    page.click("text=Bad AI output: a loop that never ends")
    page.wait_for_function("document.querySelector('#toast').textContent.includes('froze')", timeout=10000)
    check("frozen screen is rejected, old screen stays", page.locator(frame_sel).count() == 1 and "Send the invoice" in page.frame_locator(frame_sel).locator("ul").inner_text())
    check("page itself stays responsive", page.evaluate("1+1") == 2)

    page.click("text=Bad AI output: tries to send your data away")
    page.wait_for_function("document.querySelector('#toast').textContent.includes('blocked')", timeout=10000)
    f = page.frame_locator(frame_sel)
    f.locator("h3").wait_for(timeout=10000)
    txt = f.locator(".r").inner_text()
    check("every escape attempt is blocked", txt.count("blocked") == 5 and "got through" not in txt)
    check("no request reached the outside site", outside == [])
    f.locator("button").click(); time.sleep(0.5)
    inner = f.locator(".r").inner_html()
    check("injected script and onclick never ran", dialogs == [] and "<script" not in inner and "onclick=" not in inner)
    page.screenshot(path=os.path.join(ROOT, "test", "shot-blocked.png"))

    page.click("#reset")
    check("reset returns to the default screen", page.locator(frame_sel).count() == 0)
    page.reload(); time.sleep(1)
    check("default stays after reload", page.locator(frame_sel).count() == 0)

    page.click("text=Night mode, please")
    page.wait_for_function("document.querySelector('#toast').textContent.startsWith('Done')", timeout=8000)
    other = b.new_context().new_page(); other.goto(URL); time.sleep(1.5)
    check("another visitor still sees the default", other.locator(frame_sel).count() == 0)
    page.screenshot(path=os.path.join(ROOT, "test", "shot-night.png"))
    check("no page errors", errors == [])
    b.close()
srv.shutdown()
print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
