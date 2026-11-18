import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright

def abrir_hoja(pg):
    """Los controles de hoja viven tras el botón «Hoja» desde la 0.26."""
    if pg.locator('.hoja-pop').count() == 0:
        pg.click('.ink-toolbar button:has-text("Hoja")')
        pg.wait_for_selector('.hoja-pop')


http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4220),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(name, cond, extra=''):
    global P,F
    if cond: P+=1
    else:
        F+=1; print('FAIL', name, extra)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':960}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4220/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.4)
    pg.click('.rail-btn:has-text("Cuadernos")'); time.sleep(0.7)
    pg.click('button:has-text("Crear cuaderno")'); time.sleep(0.4)
    pg.fill('.modal input.input','Pruebas'); pg.click('.modal .btn.primary'); time.sleep(0.7)
    pg.click('.nb-card:has-text("Pruebas")'); time.sleep(0.4)
    pg.click('.nb-notes .btn.primary:has-text("Nota")'); time.sleep(1.6)
    pg.click('[role=tab]:has-text("Lienzo")'); pg.wait_for_selector('.ink-page canvas'); time.sleep(0.8)

    # --- tamaño de hoja ---
    abrir_hoja(pg)
    ok('hay selector de tamaño de hoja', pg.locator('select[aria-label="Tamaño de hoja"]').count() == 1)
    ok('cuatro tamaños', pg.locator('select[aria-label="Tamaño de hoja"] option').count() == 4, pg.locator('select[aria-label="Tamaño de hoja"] option').count())
    def ratio():
        bx = pg.locator('.ink-page').first.bounding_box(); return bx['height']/bx['width']
    r_a4 = ratio()
    pg.select_option('select[aria-label="Tamaño de hoja"]','apaisada'); time.sleep(0.6)
    r_h = ratio()
    ok('la apaisada es más ancha que alta', r_h < 0.9 and r_h < r_a4, (r_a4, r_h))
    pg.select_option('select[aria-label="Tamaño de hoja"]','rollo'); time.sleep(0.6)
    r_r = ratio()
    ok('el rollo es mucho más alto', r_r > 3, r_r)
    ok('el rollo quita la separación entre hojas', pg.evaluate("getComputedStyle(document.querySelector('.ink-page')).boxShadow") == 'none')
    pg.select_option('select[aria-label="Tamaño de hoja"]','a4'); time.sleep(0.6)
    ok('vuelve a A4', abs(ratio() - r_a4) < 0.02, (r_a4, ratio()))
    ok('el tamaño se guarda en la nota', pg.evaluate("JSON.parse(localStorage.getItem('alq:settings')||'{}') && true"))

    # --- miniaturas ---
    pg.keyboard.press('Escape'); time.sleep(0.4)
    bx = pg.locator('.ink-page').first.bounding_box()
    pg.mouse.move(bx['x']+90, bx['y']+120); pg.mouse.down()
    for i in range(14): pg.mouse.move(bx['x']+90+i*14, bx['y']+120+(10 if i%2 else -10))
    pg.mouse.up(); time.sleep(1.2)
    (abrir_hoja(pg), pg.click('.hoja-pop button[title*="miniaturas"]')); time.sleep(1.4)
    ok('se abre la columna de miniaturas', pg.locator('.sheet-rail').count() == 1)
    ok('hay una miniatura por hoja', pg.locator('.sheet-thumb').count() == pg.locator('.ink-sheet').count(), (pg.locator('.sheet-thumb').count(), pg.locator('.ink-sheet').count()))
    ok('la primera miniatura se dibujó', pg.locator('.sheet-thumb img').count() >= 1)
    ok('la hoja actual va marcada', pg.locator('.sheet-thumb.cur').count() == 1)
    (abrir_hoja(pg), pg.click('.hoja-pop button[title*="miniaturas"]')); time.sleep(0.5)
    ok('se puede cerrar', pg.locator('.sheet-rail').count() == 0)

    # --- leer la selección (lazo) ---
    pg.keyboard.press('Escape'); time.sleep(0.3)
    pg.click('button[aria-label="Lazo"]'); time.sleep(0.4)
    print('modo lazo:', pg.locator('button[aria-label="Lazo"][aria-pressed="true"]').count())
    bx = pg.locator('.ink-page').first.bounding_box()
    pg.mouse.move(bx['x']+60, bx['y']+80); pg.mouse.down()
    for x,y in [(bx['x']+330,bx['y']+80),(bx['x']+330,bx['y']+180),(bx['x']+60,bx['y']+180),(bx['x']+60,bx['y']+85)]:
        pg.mouse.move(x,y)
    pg.mouse.up(); time.sleep(0.8)
    ok('el lazo selecciona', pg.locator('.sel-bar').count() == 1, pg.locator('.sel-box').count())
    ok('la barra tiene el botón de leer', pg.locator('.sel-bar button[aria-label="Leer la selección"]').count() == 1)
    print('ERRS', errs[:3])
    print(f'SUMMARY {P} / {P+F}')
    b.close()
