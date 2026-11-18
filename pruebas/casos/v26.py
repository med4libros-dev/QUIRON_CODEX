import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4268),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1340,'height':940}, accept_downloads=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    # Sin carpetas, como un iPad: así el paso del respaldo es el archivo descargable.
    pg.add_init_script("delete window.showDirectoryPicker;")
    pg.goto('http://127.0.0.1:4268/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()+datetime.timedelta(days=5)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.0)

    print('DBG cajas:', pg.evaluate("""() => {
      const bs = [...document.querySelectorAll('button')].filter(b => /Preparar el d/.test(b.textContent));
      const bar = document.querySelector('.sync-bar');
      return { botones: bs.map(b => { const r = b.getBoundingClientRect(); return [b.className, Math.round(r.x), Math.round(r.y), Math.round(r.height)]; }),
               barra: bar ? (() => { const r = bar.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() : null,
               alto: window.innerHeight };
    }"""))
    pg.click('button:has-text("Preparar el día 1")'); pg.wait_for_selector('.modal'); time.sleep(0.6)
    txt = pg.inner_text('.modal')
    ok('se abre la preparación', 'Preparar el día 1' in txt)
    ok('lleva la cuenta de lo listo', 'de 4 listos' in txt, txt[:140].replace('\n',' '))
    ok('sin carpetas, no pide apuntar resúmenes', 'ultrarresúmenes' not in txt)
    ok('explica que aquí no hay respaldo automático', 'no hay respaldo automático posible' in txt)
    ok('pide la fecha real de inicio', 'fecha real de inicio' in txt)
    ok('dice por qué importa cada cosa', 'reparte 139 temas' in txt)
    ok('pide respaldo', 'Dónde se respalda' in txt)
    ok('cuenta las fichas de urgencias', 'Fichas de guardia: 0 de 10' in txt, [l for l in txt.split('\n') if 'Fichas' in l][:1])
    ok('pide fármacos por peso', 'Fármacos por peso' in txt)
    ok('da la dirección para el teléfono', 'med4libros-dev.github.io' in txt)
    ok('advierte que el teléfono no comparte datos', 'no comparte almacenamiento' in txt)
    ok('sugiere qué fichas llenar primero', 'yo priorizaría' in txt)

    # El plan ya existe: ese paso debe salir hecho
    ok('reconoce que el plan ya está', pg.locator('.d1-list li.ok').count() >= 1, pg.locator('.d1-list li.ok').count())

    # Marcar una ficha de urgencias y ver que el conteo sube
    pg.click('.modal button:has-text("Cerrar")'); time.sleep(0.4)
    pg.evaluate("""() => new Promise(res => {
      const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const db = r.result; const tx = db.transaction('kv', 'readwrite');
        const st = tx.objectStore('kv');
        const g = st.get('topics');
        g.onsuccess = () => {
          const prev = JSON.parse(g.result || '{}');
          prev.info = prev.info || {};
          const urg = Object.keys(prev.info);
          prev.info['urg-01'] = { ...(prev.info['urg-01'] || {}), guard: { criteria: 'Criterio de prueba', firstLine: '', secondLine: '', referral: '' }, docs: [], cases: [] };
          st.put(JSON.stringify(prev), 'topics');
          tx.oncomplete = () => res(1);
        };
      };
    })""")
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.5)
    pg.click('button:has-text("Preparar el día 1")'); pg.wait_for_selector('.modal'); time.sleep(0.6)
    ok('el conteo de fichas refleja lo que llenaste', 'Fichas de guardia: 1 de 10' in pg.inner_text('.modal'), [l for l in pg.inner_text('.modal').split('\n') if 'Fichas' in l][:1])

    # El respaldo se puede resolver desde ahí
    fila = pg.locator('.d1-list li', has_text='Dónde se respalda')
    with pg.expect_download(timeout=25000) as dl:
        fila.locator('button').click()
    ok('se puede respaldar desde la preparación', dl.value.suggested_filename.endswith('.json'))
    time.sleep(1.5)
    ok('y queda marcado como hecho', 'Listo' in fila.inner_text(), fila.inner_text().replace('\n',' ')[:80])
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
