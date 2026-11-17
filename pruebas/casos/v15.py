import threading, http.server, socketserver, functools, time, datetime, os
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs']='text/javascript'
http.server.SimpleHTTPRequestHandler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',4250),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/tmp/tc/dist'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
P=F=0
def ok(n,c,e=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,e)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--enable-blink-features=FileSystemAccessAPI'])
    ctx=b.new_context(viewport={'width':1400,'height':940}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4250/'); pg.wait_for_selector('.setup')
    pg.fill('.setup input[type=date] >> nth=0',(datetime.date.today()-datetime.timedelta(days=10)).isoformat()); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card'); time.sleep(0.5)
    ok('hay vista de Resúmenes en la barra', pg.locator('.rail-btn:has-text("Resúmenes")').count() == 1)
    pg.click('.rail-btn:has-text("Resúmenes")'); time.sleep(0.8)
    time.sleep(2.0)
    ok('explica que no se copia nada', 'no se copian' in pg.inner_text('.sum-page'))

    # El selector de carpeta del sistema no se puede automatizar: se inyecta un handle de prueba
    # equivalente, con la misma forma que devuelve showDirectoryPicker.
    pg.evaluate("""(tree) => {
      const mkFile = (name, bytes) => ({ kind: 'file', name, getFile: async () => new File([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], name, { type: 'application/pdf' }) });
      const mkDir = (name, entries) => ({
        kind: 'directory', name,
        values: async function* () { for (const e of entries) yield e; },
        queryPermission: async () => 'granted', requestPermission: async () => 'granted',
        getDirectoryHandle: async (n) => entries.find(e => e.kind === 'directory' && e.name === n),
        getFileHandle: async (n) => entries.find(e => e.kind === 'file' && e.name === n),
      });
      const build = (node) => node.files ? mkDir(node.name, [...node.files.map(f => mkFile(f.name, f.b64)), ...(node.dirs||[]).map(build)]) : mkDir(node.name, []);
      window.__dir = build(tree);
      window.showDirectoryPicker = async () => window.__dir;
    }""", __import__('json').loads(open('/tmp/tc/tree.json').read()))
    pg.click('button:has-text("Elegir carpeta")')
    pg.wait_for_selector('.sum-list', timeout=60000); time.sleep(1.0)

    rows = pg.locator('.sum-row').count()
    ok('indexa los cinco PDFs', rows == 5, rows)
    titles = pg.locator('.sum-title').all_inner_texts()
    ok('saca el título de la primera página', 'Cetoacidosis Diabética' in titles and 'Paciente Politraumatizado' in titles, titles)
    ok('no usa el nombre del archivo como título', not any(t.startswith('Med Interna') for t in titles), titles)
    def topic_of(title):
        return pg.get_attribute(f'select[aria-label="Tema de {title}"]', 'title') or ''
    ok('empareja «Cetoacidosis Diabética» con su tema', 'Cetoacidosis diabética' in topic_of('Cetoacidosis Diabética'), topic_of('Cetoacidosis Diabética'))
    ok('empareja aunque el tema se llame distinto', 'Fracturas frecuentes' in topic_of('Fracturas de Cadera'), topic_of('Fracturas de Cadera'))
    ok('resuelve siglas: RCP → reanimación cardiopulmonar', 'Reanimación cardiopulmonar' in topic_of('RCP Básico'), topic_of('RCP Básico'))
    ok('«politraumatizado» encuentra «traumatizado»', 'traumatizado' in topic_of('Paciente Politraumatizado'), topic_of('Paciente Politraumatizado'))
    ok('marca lo dudoso para confirmar', pg.locator('.sum-row[data-level=probable]').count() >= 1)
    ok('hay filtros por estado', pg.locator('.sum-bar [role=tab]').count() == 3)

    # el índice es pequeño y no guarda los PDFs
    idx = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const t = r.result.transaction('kv').objectStore('kv').get('summaries');
        t.onsuccess = () => res(typeof t.result === 'string' ? t.result.length : JSON.stringify(t.result||{}).length); }; })""")
    ok('el índice pesa kilobytes, no megabytes', idx < 20000, idx)
    pdfs = pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const k = r.result.transaction('pdfs').objectStore('pdfs').getAllKeys(); k.onsuccess = () => res(k.result.length); }; })""")
    ok('no se copió ningún PDF al navegador', pdfs == 0, pdfs)

    # abrir un resumen lo manda al lector de siempre
    pg.locator('.sum-row', has=pg.locator('.sum-title', has_text='Cetoacidosis')).locator('.sum-open').click(); time.sleep(2.5)
    ok('abre en el lector', pg.evaluate("document.documentElement.dataset.view") == 'study')
    pg.wait_for_function("() => [...document.querySelectorAll('.pdf-page > canvas')].some(c => c.width > 0)", timeout=30000)
    ok('el PDF se dibuja desde la carpeta', True)
    ok('sigue sin copiarse', pg.evaluate("""() => new Promise(res => { const r = indexedDB.open('alquimia');
      r.onsuccess = () => { const k = r.result.transaction('pdfs').objectStore('pdfs').getAllKeys(); k.onsuccess = () => res(k.result.length); }; })""") == 0)

    # aparece en la ficha del tema
    pg.click('.rail-btn:has-text("Inicio")'); time.sleep(0.8)
    pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find(x => /Temario/i.test(x.textContent)); b && b.click(); }"); time.sleep(0.8)
    print('ERRS', errs[:3]); print(f'SUMMARY {P} / {P+F}'); b.close()
