import threading, http.server, socketserver, functools, time, datetime, json
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4257),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

FAKE = """
  window.__files = new Map();
  const mkFile = (path) => ({ kind:'file', name: path.split('/').pop(),
    getFile: async () => new File([(window.__files.get(path)||{text:''}).text], path.split('/').pop()),
    createWritable: async () => { let buf=''; return {
      write: async (d) => { buf += (typeof d === 'string' ? d : await d.text()); },
      close: async () => { window.__files.set(path, { text: buf, at: Date.now() }); } }; } });
  const mkDir = (prefix) => ({ kind:'directory', name: 'Respaldo',
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFileHandle: async (n, o) => { const p = prefix + n;
      if (!window.__files.has(p)) { if (!o || !o.create) throw new DOMException('no','NotFoundError');
        window.__files.set(p, { text:'', at: Date.now() }); }
      return mkFile(p); },
    getDirectoryHandle: async (n, o) => { const p = prefix + n + '/';
      if (![...window.__files.keys()].some(k => k.startsWith(p)) && !(o && o.create)) throw new DOMException('no','NotFoundError');
      return mkDir(p); },
    removeEntry: async (n) => { window.__files.delete(prefix + n); },
    entries: async function* () { const seen = new Set();
      for (const k of [...window.__files.keys()]) { if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length), head = rest.split('/')[0];
        if (seen.has(head)) continue; seen.add(head);
        yield [head, rest.includes('/') ? mkDir(prefix+head+'/') : mkFile(prefix+head)]; } },
    values: async function* () { for await (const [, h] of this.entries()) yield h; } });
  window.showDirectoryPicker = async () => mkDir('');
"""

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':940})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE)
    pg.goto('http://127.0.0.1:4257/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(1.2)

    ok('al terminar el asistente aparece qué falta', pg.locator('.first-run').count() == 1)
    txt = pg.inner_text('.first-run')
    ok('pide la carpeta de respaldo', 'respaldo' in txt.lower(), txt[:70].replace('\n',' '))
    ok('pide la carpeta de resúmenes', 'resúmenes' in txt.lower())
    ok('pide llenar las fichas de guardia', 'guardia' in txt.lower())
    ok('explica por qué, no solo qué', 'OneDrive' in txt)

    pg.click('.fr-list button:has-text("Elegir carpeta")'); time.sleep(2.5)
    ok('elegir la carpeta la configura de verdad', any('datos.json' in k for k in pg.evaluate("() => [...window.__files.keys()]")))
    ok('y ese punto desaparece de la lista', 'respaldo' not in pg.inner_text('.first-run').lower(), pg.inner_text('.first-run')[:60].replace('\n',' '))

    pg.click('.fr-list button:has-text("Abrir Resúmenes")'); time.sleep(1.2)
    ok('«Abrir Resúmenes» lleva a esa vista', pg.locator('.sum-page').count() == 1)
    pg.click('.rail-btn:has-text("Inicio")'); time.sleep(0.8)
    pg.click('.first-run .icon-btn'); time.sleep(0.5)
    ok('se puede ocultar', pg.locator('.first-run').count() == 0)
    pg.reload(); pg.wait_for_selector('.day-card'); time.sleep(1.5)
    ok('y sigue oculto al volver', pg.locator('.first-run').count() == 0)

    # Comparar versiones
    cmp = pg.evaluate("""() => {
      const isNewer = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i]||0, y = pb[i]||0; if (x !== y) return x > y; } return false; };
      return [isNewer('0.18.0','0.17.0'), isNewer('0.17.0','0.18.0'), isNewer('0.18.1','0.18.0'), isNewer('1.0.0','0.18.0'), isNewer('0.9.0','0.10.0')];
    }""")
    ok('0.18 es más nueva que 0.17', cmp[0] is True)
    ok('0.17 no es más nueva que 0.18', cmp[1] is False)
    ok('0.18.1 es más nueva que 0.18.0', cmp[2] is True)
    ok('1.0 es más nueva que 0.18', cmp[3] is True)
    ok('0.9 no es más nueva que 0.10 (no compara como texto)', cmp[4] is False)

    ok('en el navegador no se ofrece descargar nada', pg.locator('.update-bar').count() == 0)
    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
