import threading, http.server, socketserver, functools, time, datetime, math
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4241),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
# El estado se lee del propio disco: el guardado en disco va con retraso a propósito.
TOOL = "() => document.querySelector('.dial-read').textContent.split(' \u00b7 ')[0]"
COLOR = "() => document.querySelector('.dial-sec.color.on')?.getAttribute('fill')"
SIZE = "() => +document.querySelector('.dial-read').textContent.split(' \u00b7 ')[1]"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1420,'height':940}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4241/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.4)
    pg.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.7)
    pg.click('button:has-text("Crear cuaderno")'); time.sleep(0.4)
    pg.fill('.modal input.input','Pruebas'); pg.click('.modal .btn.primary'); time.sleep(0.7)
    pg.click('.nb-card:has-text("Pruebas")'); time.sleep(0.4)
    pg.click('.nb-notes .btn.primary:has-text("Nota")'); time.sleep(1.6)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.9)

    ok('el disco del lienzo está arriba a la izquierda', pg.locator('.pen-dial.tl').count() == 1)
    ok('empieza cerrado y en 48 px', pg.locator('.pen-dial.closed .dial-knob').count() == 1 and abs(pg.locator('.dial-knob').bounding_box()['width'] - 48) < 2)
    pg.click('.dial-knob'); time.sleep(0.6)
    ok('se abre', pg.locator('.pen-dial.open').count() == 1)
    ok('son tres deslizadores, no botones', pg.locator('.dial-grab[role=slider]').count() == 3, pg.locator('.dial-grab[role=slider]').count())
    ok('ya no hay botones de sector', pg.locator('.dial-sec [role=radio], [role=radio].dial-sec').count() == 0)

    bx = pg.locator('.dial-svg').bounding_box()
    cx, cy = bx['x']+bx['width']/2, bx['y']+bx['height']/2
    k = bx['width']/216
    def at(r, deg):
        a = math.radians(deg)
        return cx + r*k*math.cos(a), cy + r*k*math.sin(a)

    # --- girar el anillo de herramienta ---
    pg.mouse.move(*at(44, -90)); pg.mouse.down()
    seen = set()
    for d in range(-90, 200, 12):
        pg.mouse.move(*at(44, d)); time.sleep(0.04)
        seen.add(pg.evaluate(TOOL))
    pg.mouse.up(); time.sleep(0.4)
    ok('girar el anillo recorre varias herramientas', len(seen) >= 3, seen)
    last = pg.evaluate(TOOL)
    ok('se queda en la que soltaste', last in ('Pluma','Lápiz','Rotulador','Marcatextos'), last)

    # --- girar el anillo de color ---
    pg.mouse.move(*at(69, -90)); pg.mouse.down()
    cols = set()
    for d in range(-90, 210, 15):
        pg.mouse.move(*at(69, d)); time.sleep(0.04)
        cols.add(pg.evaluate(COLOR))
    pg.mouse.up(); time.sleep(0.4)
    ok('girar el color recorre la paleta', len(cols) >= 4, cols)

    # --- girar el grosor (continuo) ---
    sizes = set()
    pg.mouse.move(*at(94, -80)); pg.mouse.down()
    for d in range(-80, 160, 8):
        pg.mouse.move(*at(94, d)); time.sleep(0.04)
        sizes.add(pg.evaluate(SIZE))
    pg.mouse.up(); time.sleep(0.4)
    ok('el grosor es continuo, no escalones', len(sizes) >= 6, sorted(sizes))
    ok('el grosor respeta el máximo de la herramienta', max(sizes) <= 48 and min(sizes) >= 1, (min(sizes), max(sizes)))

    # --- teclado ---
    pg.locator('.dial-grab[aria-label="Color"]').focus(); time.sleep(0.2)
    c1 = pg.evaluate(COLOR)
    pg.keyboard.press('ArrowRight'); time.sleep(0.4)
    c2 = pg.evaluate(COLOR)
    ok('las flechas giran el anillo', c1 != c2, (c1, c2))
    ok('el anillo se anuncia como deslizador', pg.get_attribute('.dial-grab[aria-label="Color"]', 'role') == 'slider')

    # --- escribir sigue funcionando y el disco no estorba ---
    pg.keyboard.press('Escape'); time.sleep(0.4)
    ok('Escape lo cierra', pg.locator('.pen-dial.closed').count() == 1)
    pbox = pg.locator('.ink-page').first.bounding_box()
    pg.mouse.move(pbox['x']+pbox['width']*0.55, pbox['y']+200); pg.mouse.down()
    for i in range(12): pg.mouse.move(pbox['x']+pbox['width']*0.55+i*10, pbox['y']+200+i*4)
    pg.mouse.up(); time.sleep(1.2)
    painted = pg.evaluate("""() => { const c = document.querySelector('.ink-page canvas'); const x = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<x.length;i+=4) if (x[i]) n++; return n; }""")
    ok('se escribe con lo que dejaste en el disco', painted > 50, painted)

    # --- el del PDF ---
    pg.click('.rail-btn:has-text("Estudio")'); time.sleep(0.6)
    pg.set_input_files('.pdf-body input[type=file]','/tmp/tc/test.pdf')
    pg.wait_for_function("() => [...document.querySelectorAll('.pdf-page > canvas')].some(c=>c.width>0)", timeout=20000); time.sleep(1.0)
    ok('sin la herramienta de dibujo no hay disco en el PDF', pg.locator('.pdf-body .pen-dial').count() == 0, pg.locator('.pdf-body .pen-dial').count())
    pg.click('button[aria-label="Escribir / dibujar"]'); time.sleep(0.7)
    ok('el disco del PDF está arriba a la derecha', pg.locator('.pen-dial.tr').count() == 1)
    db = pg.locator('.pen-dial.tr').bounding_box(); body = pg.locator('.pdf-body').bounding_box()
    ok('pegado al borde derecho', abs((body['x']+body['width']) - (db['x']+db['width'])) < 30, (body['x']+body['width'], db['x']+db['width']))
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
