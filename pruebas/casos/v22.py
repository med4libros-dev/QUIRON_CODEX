import threading, http.server, socketserver, functools, time, datetime
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4264),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
# Sin showDirectoryPicker: así se ve un iPad por dentro
SIN_CARPETAS = "delete window.showDirectoryPicker;"
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':834,'height':1194}, has_touch=True, is_mobile=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(SIN_CARPETAS)
    pg.goto('http://127.0.0.1:4264/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.5)

    ok('avisa que aquí no hay respaldo', pg.locator('.file-backup-bar').count() == 1, pg.inner_text('body')[:80].replace('\n',' '))
    txt = pg.inner_text('.file-backup-bar')
    ok('dice que aquí no se puede automático', 'no se puede automático' in txt or 'no hay respaldo' in txt, txt.replace('\n',' ')[:120])

    # El mensaje de la carpeta ya no manda a Chrome, que en iPad no existe de verdad
    pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>/Ajustes/.test(x.textContent)); b&&b.click(); }"); time.sleep(0.4)
    pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>/Respaldo/.test(x.textContent)); b&&b.click(); }"); time.sleep(0.8)
    m = pg.inner_text('.modal')
    ok('explica el porqué en iPad', 'todos usan Safari por dentro' in m, m[:120].replace('\n',' '))
    ok('no manda a instalar Chrome', 'Usa Microsoft Edge o Chrome' not in m)
    ok('sigue ofreciendo descargar el archivo', 'Descargar' in m)
    pg.keyboard.press('Escape'); time.sleep(0.5)

    # Descargar marca el respaldo y la barra se va
    with pg.expect_download(timeout=20000) as dl:
        pg.click('.file-backup-bar button:has-text("Descargar respaldo")')
    f = dl.value
    ok('descarga un archivo con tu progreso', f.suggested_filename.endswith('.json'), f.suggested_filename)
    time.sleep(1.0)
    ok('tras respaldar, el aviso desaparece', pg.locator('.file-backup-bar').count() == 0)
    ok('queda registrado cuándo fue', pg.evaluate("() => !!localStorage.getItem('qc:fileBackupAt')"))

    # A los 5 días vuelve a avisar
    pg.evaluate("() => localStorage.setItem('qc:fileBackupAt', String(Date.now() - 6*86400000))")
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.5)
    ok('a los 6 días vuelve a avisar', pg.locator('.file-backup-bar').count() == 1)
    ok('dice cuántos días van', 'días sin respaldar' in pg.inner_text('.file-backup-bar'))

    # «Mañana» lo calla un día, no para siempre
    pg.click('.file-backup-bar .icon-btn'); time.sleep(0.5)
    ok('se puede posponer', pg.locator('.file-backup-bar').count() == 0)
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.5)
    ok('y sigue callado al recargar', pg.locator('.file-backup-bar').count() == 0)
    pg.evaluate("() => localStorage.setItem('qc:fileBackupSnooze', String(Date.now() - 1000))")
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.5)
    ok('pero vuelve al día siguiente', pg.locator('.file-backup-bar').count() == 1)

    # Donde sí hay carpetas, no estorba
    ctx2 = b.new_context(viewport={'width':1300,'height':900}); pg2 = ctx2.new_page()
    pg2.goto('http://127.0.0.1:4264/'); pg2.wait_for_selector('.setup')
    pg2.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat())
    pg2.click('button:has-text("Crear mi plan")'); pg2.wait_for_selector('.day-card'); time.sleep(1.5)
    ok('en escritorio con carpetas no aparece', pg2.locator('.file-backup-bar').count() == 0)
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
