"""Los menús «⋯» deben caber en la ventana. El de la nota se salía 208 px: estaba
anclado por la izquierda de un botón que vive pegado al borde derecho."""
import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4304),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

CAJA = """() => { const m=document.querySelector(SEL); if(!m) return null;
  const b=m.getBoundingClientRect();
  const items=[...m.querySelectorAll('[role=menuitem], button')].map(i=>{const q=i.getBoundingClientRect();
    return [i.textContent.trim().slice(0,24), Math.round(q.left), Math.round(q.right)];});
  return {x:Math.round(b.x), right:Math.round(b.right), vw:innerWidth, items}; }"""

with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    for w in (1340, 1060, 820):
        ctx=b.new_context(viewport={'width':w,'height':940}); pg=ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://127.0.0.1:4304/'); pg.wait_for_selector('.setup')
        pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()+datetime.timedelta(days=5)).isoformat())
        pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.8)
        pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.8)
        pg.click('.notes-panel .btn.primary:has-text("Nueva nota")'); pg.wait_for_selector('.editor'); time.sleep(0.5)
        pg.click('button[aria-label="Más acciones de la nota"]'); pg.wait_for_selector('.more-menu'); time.sleep(0.4)
        r = pg.evaluate(CAJA.replace('SEL', "'.more-menu'"))
        ok(f'{w}: el menú de la nota cabe', r and 0 <= r['x'] and r['right'] <= r['vw'], r and (r['x'], r['right'], r['vw']))
        cortados = [i[0] for i in (r['items'] if r else []) if i[2] > (r['vw'] if r else 0) or i[1] < 0]
        ok(f'{w}: ninguna acción queda cortada', not cortados, cortados[:3])
        ok(f'{w}: siguen las tres de exportar',
           sum(1 for i in (r['items'] if r else []) if 'Export' in i[0] or 'PDF con' in i[0]) >= 3,
           [i[0] for i in (r['items'] if r else [])])
        ctx.close()
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
