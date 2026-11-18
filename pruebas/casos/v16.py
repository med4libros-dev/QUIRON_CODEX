import threading, http.server, socketserver, functools, time, datetime, json
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4252),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)

# Carpeta de respaldo simulada, en la propia página: handles con la misma forma que los del
# selector del sistema. No se recarga en toda la prueba, así que no necesita sobrevivir.
FAKE = """
  // El Map vive en sessionStorage para sobrevivir a las recargas que hace la app al restaurar.
  const load = () => new Map(JSON.parse(sessionStorage.getItem('__files') || '[]'));
  const save = (m) => sessionStorage.setItem('__files', JSON.stringify([...m]));
  window.__files = load();
  const put = (k, v) => { window.__files.set(k, v); save(window.__files); };
  const drop = (k) => { window.__files.delete(k); save(window.__files); };
  const mkFile = (path) => ({ kind: 'file', name: path.split('/').pop(),
    getFile: async () => { const f = window.__files.get(path);
      return new File([f.text], path.split('/').pop(), { lastModified: f.at }); },
    createWritable: async () => { let buf = ''; return {
      write: async (d) => { buf += (typeof d === 'string' ? d : await d.text()); },
      close: async () => { put(path, { text: buf, at: Date.now() }); } }; } });
  const mkDir = (prefix) => ({ kind: 'directory', name: prefix.split('/').filter(Boolean).pop() || 'Respaldo',
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFileHandle: async (n, o) => { const p = prefix + n;
      if (!window.__files.has(p)) {
        if (!o || !o.create) throw new DOMException('no', 'NotFoundError');
        put(p, { text: '', at: Date.now() });
      }
      return mkFile(p); },
    getDirectoryHandle: async (n, o) => { const p = prefix + n + '/';
      if (![...window.__files.keys()].some((k) => k.startsWith(p)) && !(o && o.create)) throw new DOMException('no', 'NotFoundError');
      return mkDir(p); },
    removeEntry: async (n) => { drop(prefix + n); },
    entries: async function* () { const seen = new Set();
      for (const k of [...window.__files.keys()]) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length), head = rest.split('/')[0];
        if (seen.has(head)) continue; seen.add(head);
        yield [head, rest.includes('/') ? mkDir(prefix + head + '/') : mkFile(prefix + head)];
      } },
    values: async function* () { for await (const [, h] of this.entries()) yield h; } });
  window.showDirectoryPicker = async () => mkDir('');
"""
KV = """async (key) => new Promise((res) => { const r = indexedDB.open('alquimia');
  r.onsuccess = () => { const t = r.result.transaction('kv').objectStore('kv').get(key);
    t.onsuccess = () => res(t.result ?? null); t.onerror = () => res(null); };
  r.onerror = () => res(null); })"""

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':940})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE)
    pg.goto('http://127.0.0.1:4252/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.6)

    pg.click('.rail-btn:has-text("Perlas HY")'); pg.wait_for_selector('.hy-page'); time.sleep(0.4)
    pg.click('.hy-add'); pg.select_option('.hy-editor select[aria-label="Tipo"]', 'triada')
    pg.fill('.hy-editor input[aria-label="Nombre"]', 'Tríada de Beck')
    pg.fill('.hy-editor textarea[aria-label="Perla"]', 'Hipotensión, ingurgitación yugular, ruidos velados')
    pg.click('.hy-editor button:has-text("Guardar")'); time.sleep(0.8)
    ok('se puede crear una perla', 'Tríada de Beck' in pg.inner_text('.hy-page'))

    def abrir_respaldo():
        pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /Ajustes/.test(x.textContent)); b && b.click(); }"); time.sleep(0.4)
        pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /Respaldo/.test(x.textContent)); b && b.click(); }"); time.sleep(0.8)
    ls = lambda: pg.evaluate("() => JSON.parse(sessionStorage.getItem('__files') || '[]').map(e => e[0]).sort()")

    abrir_respaldo()
    pg.click('button:has-text("Elegir carpeta de respaldo")'); time.sleep(3.0)
    ok('escribe el respaldo en la carpeta', 'quiron-codex-datos.json' in ls(), ls())
    ok('el respaldo trae datos de verdad', pg.evaluate("() => (new Map(JSON.parse(sessionStorage.getItem('__files')||'[]')).get('quiron-codex-datos.json')||{text:''}).text.length") > 2000)

    # Envejecer el respaldo un día: se cambia la fecha que el propio archivo declara
    pg.evaluate("""() => { const m = window.__files; const f = m.get('quiron-codex-datos.json');
      const ayer = new Date(Date.now() - 86400000).toISOString();
      f.text = f.text.replace(/"exportedAt":"[^"]+"/, '"exportedAt":"' + ayer + '"');
      m.set('quiron-codex-datos.json', f);
      sessionStorage.setItem('__files', JSON.stringify([...m])); }""")
    pg.click('button:has-text("Respaldar ahora")'); time.sleep(3.0)
    ayer = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    # La copia se escribe de forma asíncrona: se espera a que aparezca en vez de suponerlo.
    esperado = f'historial/quiron-codex-datos-{ayer}.json'
    for _ in range(20):
        if esperado in ls(): break
        time.sleep(0.5)
    ok('guarda una copia con la fecha del día anterior', esperado in ls(), ls())
    ok('el respaldo vivo sigue ahí', 'quiron-codex-datos.json' in ls())
    ok('la copia no está vacía', pg.evaluate(f"() => new Map(JSON.parse(sessionStorage.getItem('__files')||'[]')).get('historial/quiron-codex-datos-{ayer}.json').text.length") > 2000)

    pg.click('button:has-text("Respaldar ahora")'); time.sleep(2.5)
    ok('no acumula una copia por cada respaldo', len([k for k in ls() if k.startswith('historial/')]) == 1, ls())

    abrir_respaldo()
    ok('la copia aparece en «Días anteriores»', ayer in pg.inner_text('.modal'))
    ok('explica que esas copias no se sobrescriben', 'se sobrescribe' in pg.inner_text('.modal'))

    # Borrar los datos de la app (como estrenar computadora) y traerlos de la carpeta
    pg.evaluate("""async () => { const del = (s) => new Promise((res) => { const r = indexedDB.open('alquimia');
        r.onsuccess = () => { const t = r.result.transaction(s, 'readwrite'); t.objectStore(s).clear(); t.oncomplete = res; t.onerror = res; }; });
      await del('kv'); await del('ink');
      for (const k of Object.keys(localStorage)) if (k.startsWith('alq:')) localStorage.removeItem(k); }""")
    ok('se borró todo lo guardado', pg.evaluate(KV, 'hy') is None)

    pg.click('button:has-text("Traer progreso")'); time.sleep(3.5)
    hy = pg.evaluate(KV, 'hy')
    ok('la perla vuelve al restaurar desde cero', hy is not None and 'Tríada de Beck' in hy, str(hy)[:80])
    plan = pg.evaluate("() => localStorage.getItem('alq:internship')")
    ok('el plan del internado también vuelve', plan is not None and 'config' in plan, str(plan)[:60])

    # Restaurar la copia de ayer desde la lista
    pg.on('dialog', lambda d: d.accept())
    try:
        abrir_respaldo()
        # Tras restaurar en una computadora limpia, la carpeta se vuelve a elegir (el permiso no viaja en el respaldo).
        if pg.locator('button:has-text("Elegir carpeta de respaldo")').count():
            pg.click('button:has-text("Elegir carpeta de respaldo")'); time.sleep(2.5)
        pg.click('.hist-list button:has-text("Restaurar este día")', timeout=8000); time.sleep(3.0)
        ok('se puede restaurar un día anterior', pg.evaluate(KV, 'hy') is not None)
    except Exception as ex:
        ok('se puede restaurar un día anterior', False, str(ex)[:90] + ' | modal: ' + pg.inner_text('.modal')[:120].replace('\n',' '))

    print('ERRS', errs[:2]); print(f'SUMMARY {P} / {P+F}'); b.close()
