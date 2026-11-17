import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4231),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':960}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4231/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=30)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.6)

    # --- ponerme al día ---
    ok('hay pendientes atrasadas', pg.locator('.card:has-text("Pendientes")').count() == 1)
    ok('está el botón de ponerse al día', pg.locator('button:has-text("Ponerme al día")').count() == 1)
    import re as _re
    def pend():
        if not pg.locator('.card:has-text("Pendientes")').count(): return 0
        m = _re.search(r'(\d+)', pg.inner_text('.card:has-text("Pendientes") .card-head'))
        return int(m.group(1)) if m else 0
    pend_before = pend()
    before = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')||'{}').shifts || {}")
    pg.click('button:has-text("Ponerme al día")'); time.sleep(1.2)
    after = pg.evaluate("() => JSON.parse(localStorage.getItem('alq:internship')||'{}').shifts || {}")
    ok('reparte lo atrasado en días que vienen', len(after) > len(before), (len(before), len(after)))
    today = datetime.date.today().isoformat()
    ok('no manda nada al pasado', all(v >= today for v in after.values()), [v for v in after.values() if v < today][:3])
    left = pend()
    # Los pendientes de la tarjeta son solo temas nuevos; «Ponerme al día» mueve también repasos.
    ok('la lista de pendientes baja', 0 < pend_before - left <= len(after), (pend_before, left, len(after)))

    # --- mini-examen ---
    ok('está el mini-examen', pg.locator('button:has-text("Mini-examen")').count() == 1)
    pg.click('button:has-text("Mini-examen")'); time.sleep(1.2)
    ok('sin banco avisa y no abre nada', pg.locator('.runner').count() == 0 and pg.locator('.toast').count() >= 1, pg.locator('.runner').count())

    # --- capas y flujograma ---
    pg.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.7)
    pg.click('button:has-text("Crear cuaderno")'); time.sleep(0.4)
    pg.fill('.modal input.input','Pruebas'); pg.click('.modal .btn.primary'); time.sleep(0.7)
    pg.click('.nb-card:has-text("Pruebas")'); time.sleep(0.4)
    pg.click('.nb-notes .btn.primary:has-text("Nota")'); time.sleep(1.6)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.8)
    ok('hay selector de capa', pg.locator('[aria-label="Capa del lienzo"]').count() == 1)
    ok('hay plantillas de flujograma', pg.locator('select[aria-label="Plantilla de flujograma"] option').count() == 4)
    pg.select_option('select[aria-label="Plantilla de flujograma"]', 'tres-pasos'); time.sleep(1.4)
    painted = pg.evaluate("""() => { const c = document.querySelector('.ink-page canvas'); const x = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<x.length;i+=4) if (x[i]) n++; return n; }""")
    ok('el flujograma se dibuja', painted > 2000, painted)
    # capa borrador: trazo nuevo marcado y ocultable
    pg.click('[aria-label="Capa del lienzo"] button:has-text("Borrador")'); time.sleep(0.4)

    bx = pg.locator('.ink-page').first.bounding_box()
    pg.evaluate("() => { const s = document.querySelector('.ink-scroll'); s.scrollTop = 0; }"); time.sleep(0.5)
    bx = pg.locator('.ink-page').first.bounding_box()
    pg.mouse.move(bx['x']+120, bx['y']+120); pg.mouse.down()
    for i in range(14): pg.mouse.move(bx['x']+120+i*12, bx['y']+120+i*3)
    pg.mouse.up(); time.sleep(1.4)
    layers = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const s = r.result.transaction('ink').objectStore('ink'); const k = s.getAllKeys();
        k.onsuccess = () => { const id = k.result.find(x => !String(x).includes(':'));
          const g = s.get(id); g.onsuccess = () => res((g.result||[]).map(st => st.layer || 'clean')); }; }; })""")
    ok('el trazo nuevo va al borrador', 'draft' in (layers or []), layers)
    with_draft = pg.evaluate("""() => { const c = document.querySelector('.ink-page canvas'); const x = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<x.length;i+=4) if (x[i]) n++; return n; }""")
    pg.click('button[title^="Ocultar el borrador"]'); time.sleep(1.0)
    hidden = pg.evaluate("""() => { const c = document.querySelector('.ink-page canvas'); const x = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<x.length;i+=4) if (x[i]) n++; return n; }""")
    ok('ocultar el borrador lo quita de la vista', hidden < with_draft, (with_draft, hidden))
    ok('pero no lo borra', len(layers or []) == len(pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const s = r.result.transaction('ink').objectStore('ink'); const k = s.getAllKeys();
        k.onsuccess = () => { const id = k.result.find(x => !String(x).includes(':'));
          const g = s.get(id); g.onsuccess = () => res(g.result||[]); }; }; })""") or []))
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
