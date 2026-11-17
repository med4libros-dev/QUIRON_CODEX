import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4230),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1340,'height':940}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4230/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.4)
    pg.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.7)
    pg.click('button:has-text("Crear cuaderno")'); time.sleep(0.4)
    pg.fill('.modal input.input','Pruebas'); pg.click('.modal .btn.primary'); time.sleep(0.7)
    pg.click('.nb-card:has-text("Pruebas")'); time.sleep(0.4)
    pg.click('.nb-notes .btn.primary:has-text("Nota")'); time.sleep(1.6)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.8)

    # cuaderno corto: todo montado
    ok('cuaderno corto sin virtualizar', pg.locator('.ink-sheet').count() == pg.locator('.ink-page').count())
    short = pg.locator('.ink-sheet').count()

    # cuaderno largo: 80 hojas reservadas
    nid = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const t = r.result.transaction('kv').objectStore('kv').get('notes');
        t.onsuccess = () => { const d = typeof t.result === 'string' ? JSON.parse(t.result) : t.result; res(d.notes[0].id); }; }; })""")
    pg.evaluate("""(id) => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const s = r.result.transaction('kv','readwrite').objectStore('kv'); const g = s.get('notes');
        g.onsuccess = () => { const d = typeof g.result === 'string' ? JSON.parse(g.result) : g.result;
          d.notes = d.notes.map(n => n.id === id ? {...n, inkPages: 80} : n);
          s.put(JSON.stringify(d), 'notes'); res(1); }; }; })""", nid)
    pg.reload(); time.sleep(2.0)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(1.4)
    mounted = pg.locator('.ink-sheet').count()
    ok('con 80 hojas solo se monta una ventana', 0 < mounted < 25, mounted)
    h_total = pg.evaluate("() => document.querySelector('.ink-scroll').scrollHeight")
    ok('la barra de desplazamiento conserva el alto de las 80', h_total > 20000, h_total)

    # desplazarse al final monta las últimas
    pg.evaluate("() => { const s = document.querySelector('.ink-scroll'); s.scrollTop = s.scrollHeight; }"); time.sleep(1.2)
    ok('al final siguen montadas pocas', pg.locator('.ink-sheet').count() < 25, pg.locator('.ink-sheet').count())
    last = pg.locator('.ink-page-head').last.inner_text()
    ok('al final se ve la última hoja', '80' in last or '79' in last, last)
    pg.evaluate("() => { const s = document.querySelector('.ink-scroll'); s.scrollTop = 0; }"); time.sleep(1.0)
    first = pg.locator('.ink-page-head').first.inner_text()
    ok('al volver arriba se ve la primera', 'Hoja 1' in first, first)

    # escribir sigue funcionando con el cuaderno largo
    bx = pg.locator('.ink-page').first.bounding_box()
    pg.mouse.move(bx['x']+90, bx['y']+110); pg.mouse.down()
    for i in range(12): pg.mouse.move(bx['x']+90+i*10, bx['y']+110+i*4)
    pg.mouse.up(); time.sleep(1.2)
    painted = pg.evaluate("""() => { const c = document.querySelector('.ink-page canvas'); const x = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<x.length;i+=4) if (x[i]) n++; return n; }""")
    ok('se puede escribir en un cuaderno largo', painted > 50, painted)
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
