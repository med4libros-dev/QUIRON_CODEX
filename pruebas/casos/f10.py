import threading, http.server, socketserver, functools, time, datetime, sys
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k:None
class Q(socketserver.TCPServer): allow_reuse_address=True
URL = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4183/'
if URL.startswith('http'):
    srv=Q(('127.0.0.1',4183), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever,daemon=True).start()
res, errs = {}, []
def ok(n,c,x=''):
    res[n]=bool(c); print(('PASS ' if c else 'FAIL ')+n, str(x)[:160]); sys.stdout.flush()
LS="(k)=>JSON.parse(localStorage.getItem(k)||'null')"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1368,'height':912})
    pg.clock.install()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL); pg.wait_for_selector('.rail')
    ok('no clock before studying', pg.locator('.study-clock').count()==0)
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.4)
    # 13 ticks de 5 s = 65 s de actividad simulada
    for i in range(14):
        pg.mouse.wheel(0, 40)
        pg.clock.run_for(5000)
        time.sleep(0.05)
    time.sleep(0.6)
    logs=(pg.evaluate(LS,'alq:planner') or {}).get('logs') or []
    ok('a minute of reading is registered', sum(l['minutes'] for l in logs)>=1, logs)
    ok('clock visible in the top bar', pg.locator('.study-clock').count()==1 and 'min' in pg.inner_text('.study-clock'))
    ok('clock marked as counting', 'on' in (pg.get_attribute('.study-clock','class') or ''))
    # fuera de Estudio no cuenta
    pg.click('.rail-btn:has-text("Inicio")'); time.sleep(0.3)
    n0=sum(l['minutes'] for l in ((pg.evaluate(LS,'alq:planner') or {}).get('logs') or []))
    for i in range(14):
        pg.mouse.wheel(0, 40); pg.clock.run_for(5000); time.sleep(0.03)
    time.sleep(0.5)
    n1=sum(l['minutes'] for l in ((pg.evaluate(LS,'alq:planner') or {}).get('logs') or []))
    ok('it does not count outside Estudio/Cuadernos', n1==n0, (n0,n1))
    ok('clock still shows what was studied', pg.locator('.study-clock').count()==1 and 'on' not in (pg.get_attribute('.study-clock','class') or ''))
    # inactividad: no cuenta
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.3)
    pg.mouse.wheel(0,40); pg.clock.run_for(130000)
    n2=sum(l['minutes'] for l in ((pg.evaluate(LS,'alq:planner') or {}).get('logs') or []))
    pg.clock.run_for(30000); time.sleep(0.4)
    n3=sum(l['minutes'] for l in ((pg.evaluate(LS,'alq:planner') or {}).get('logs') or []))
    ok('it stops after 2 min without activity', n3==n2, (n2,n3))
    pg.mouse.wheel(0,40)
    for _ in range(13):
        pg.clock.run_for(5000); time.sleep(0.02)
    time.sleep(0.4)
    n4=sum(l['minutes'] for l in ((pg.evaluate(LS,'alq:planner') or {}).get('logs') or []))
    ok('it resumes when you come back', n4>n3, (n3,n4))
    real=[e for e in errs if 'favicon' not in e]
    print('errors', real[:4]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
