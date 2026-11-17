import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4221),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':960}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4221/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.4)
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.5)
    pg.set_input_files('.pdf-body input[type=file]','/tmp/tc/test.pdf')
    pg.wait_for_function("() => [...document.querySelectorAll('.pdf-page > canvas')].some(c=>c.width>0)", timeout=20000); time.sleep(1.0)

    def geom():
        return pg.evaluate("""() => { const p = document.querySelector('.pdf-page'); const c = p.querySelector('canvas');
          return { page: p.getBoundingClientRect().width, canvas: c.getBoundingClientRect().width }; }""")
    g0 = geom()
    ok('sin margen la página y el lienzo miden igual', abs(g0['page']-g0['canvas']) < 2, g0)
    pg.click('button[aria-label="Margen de notas"]'); time.sleep(0.9)
    g1 = geom()
    ok('con margen el elemento crece ~30 %', 1.25 < g1['page']/g1['canvas'] < 1.35, g1)
    ok('la guía conserva su ancho', abs(g1['canvas']-g0['canvas']) < 2, (g0['canvas'], g1['canvas']))
    ok('se dibuja la línea del margen', pg.evaluate("getComputedStyle(document.querySelector('.pdf-page'),'::after').width") not in ('auto','0px'))
    ink = pg.evaluate("() => { const p=document.querySelector('.pdf-page'); const i=p.querySelector('.ink-layer'); return i.getBoundingClientRect().width/p.getBoundingClientRect().width; }")
    ok('la capa de tinta cubre también el margen', abs(ink-1) < 0.02, ink)
    pg.click('button[aria-label="Margen de notas"]'); time.sleep(0.8)
    g2 = geom()
    ok('segundo toque: 60 %', 1.55 < g2['page']/g2['canvas'] < 1.65, g2)

    # escribir en el margen debe guardarse con x > 1000
    pg.click('button[aria-label="Escribir / dibujar"]'); time.sleep(0.4)
    pg.evaluate("() => { const s = document.querySelector('.pdf-scroll'); s.scrollLeft = s.scrollWidth; }"); time.sleep(0.5)
    bx = pg.locator('.pdf-page').first.bounding_box()
    sc = pg.locator('.pdf-scroll').bounding_box()
    sx = min(bx['x'] + bx['width']*0.85, sc['x'] + sc['width'] - 40)
    # control: primero dentro de la página
    cx = max(bx['x'] + bx['width']*0.2, sc['x'] + 40)
    pg.mouse.move(cx, bx['y']+200); pg.mouse.down()
    for i in range(10): pg.mouse.move(cx+i*6, bx['y']+200+i*4)
    pg.mouse.up(); time.sleep(1.0)
    pg.mouse.move(sx, bx['y']+140); pg.mouse.down()
    for i in range(12): pg.mouse.move(sx+i*6, bx['y']+140+i*5)
    pg.mouse.up(); time.sleep(1.2)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); time.sleep(1.2)
    xs = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const t = r.result.transaction('kv').objectStore('kv').get('library');
        t.onsuccess = () => { const raw = t.result; const d = typeof raw === 'string' ? JSON.parse(raw||'{}') : (raw||{}); const inks = d.inks||{};
          const all = Object.values(inks).flat(); res(all.flatMap(s => s.points.map(p => p[0]))); }; }; })""")
    ok('lo escrito en el margen queda a la derecha de la página', bool(xs) and max(xs) > 1000, (len(xs or []), max(xs) if xs else None))
    pg.click('button[aria-label="Margen de notas"]'); time.sleep(0.6)
    g3 = geom()
    ok('tercer toque lo quita', abs(g3['page']-g3['canvas']) < 2, g3)
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
