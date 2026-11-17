import threading, http.server, socketserver, functools, time, json, urllib.request
from urllib.parse import urljoin
BASE = 'http://127.0.0.1:4232/'
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.extensions_map['.webmanifest']='application/manifest+json'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4232),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

man = json.loads(urllib.request.urlopen(urljoin(BASE, 'manifest.webmanifest')).read())
ok('el manifiesto tiene nombre y nombre corto', man['name'] == 'Quirón Codex' and man['short_name'] == 'Quirón', man.get('name'))
ok('se abre como aplicación', man['display'] == 'standalone', man.get('display'))
ok('los colores son los del pack Códice', man['theme_color'] == '#17130f' and man['background_color'] == '#17130f')
ok('trae los tres iconos (192, 512 y maskable)', len(man['icons']) == 3 and any(i.get('purpose') == 'maskable' for i in man['icons']))
for i in man['icons']:
    r = urllib.request.urlopen(urljoin(BASE, i['src']))
    ok(f"el icono {i['sizes']} existe", r.status == 200 and int(r.headers['content-length']) > 1000)
ok('el manifiesto usa rutas relativas (sirve bajo un subdirectorio)',
   man['start_url'].startswith('.') and man['scope'].startswith('.') and all(i['src'].startswith('.') for i in man['icons']),
   [man['start_url'], man['scope']])
sw = urllib.request.urlopen(urljoin(BASE, 'sw.js')).read().decode()
ok('el service worker no toca peticiones de fuera', "url.origin !== self.location.origin" in sw)
ok('la red va primero (no te quedas con la versión de ayer)', sw.index('fetch(req)') < sw.index('caches.match(req)'))

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1200,'height':900}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4232/'); pg.wait_for_selector('.setup'); time.sleep(1.5)
    ok('la página enlaza el manifiesto', pg.locator('link[rel=manifest]').count() == 1)
    reg = pg.evaluate("() => navigator.serviceWorker.getRegistrations().then(r => r.length)")
    ok('el service worker queda registrado en 127.0.0.1', reg >= 1, reg)
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
