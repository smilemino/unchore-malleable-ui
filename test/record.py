# Records the demo flow to media/demo.webm for the README GIF.
import http.server, threading, functools, os, time, glob, shutil
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = "/tmp/pui/rec"; shutil.rmtree(out, ignore_errors=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1000, "height": 640}, record_video_dir=out, record_video_size={"width": 1000, "height": 640})
    page = ctx.new_page(); page.goto(f"http://127.0.0.1:{srv.server_port}/index.html")
    time.sleep(1.6)
    page.click("#say"); page.keyboard.type("night mode, please", delay=55); time.sleep(0.3); page.click("#ask button"); time.sleep(2.8)
    page.fill("#say", ""); page.keyboard.type("bigger text, menu on the right", delay=45); page.click("#ask button"); time.sleep(2.8)
    page.click("text=Show today's to-dos above the chat"); time.sleep(2.2)
    f = page.frame_locator("#device iframe"); f.locator("input[name=item]").click(); page.keyboard.type("Send the invoice", delay=50); f.locator("button[data-action=add]").click(); time.sleep(1.4)
    page.click("text=Bad AI output: a loop that never ends"); time.sleep(4.2)
    page.click("text=Bad AI output: tries to send your data away"); time.sleep(5)
    page.click("#reset"); time.sleep(1.8)
    ctx.close(); b.close()
srv.shutdown()
v = glob.glob(out + "/*.webm")[0]; shutil.copy(v, "/tmp/pui/demo.webm"); print(v)
