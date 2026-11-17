import re
import threading, http.server, socketserver, functools, time, json, datetime, sys, re
from playwright.sync_api import sync_playwright
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4197/'
if URL.startswith('http'):
    srv = Q(('127.0.0.1', 4197), functools.partial(http.server.SimpleHTTPRequestHandler, directory='/tmp/tc/dist')); threading.Thread(target=srv.serve_forever, daemon=True).start()
res, errs = {}, []
def ok(n, c, x=''):
    res[n] = bool(c); print(('PASS ' if c else 'FAIL ') + n, str(x)[:170]); sys.stdout.flush()
KV = """(k) => new Promise(r => { const q = indexedDB.open('alquimia'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(typeof g.result === 'string' ? JSON.parse(g.result) : g.result ?? null); }; })"""
start = (datetime.date(2026, 11, 13) - datetime.timedelta(days=40)).isoformat()

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1368, 'height': 912}, accept_downloads=True); pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 13, 9, 0))
    pg.on('dialog', lambda d: d.accept())
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_selector('.setup')
    ok('no «Novedades» on a fresh install', pg.locator('.news-list').count() == 0)
    pg.fill('.setup input[type=date] >> nth=0', start); pg.fill('.setup input[type=number] >> nth=0', '60'); time.sleep(0.2)
    pg.click('button:has-text("Crear mi plan")'); pg.wait_for_selector('.day-card')
    ok('lesson-of-the-day ring', pg.locator('.day-card .ring svg').count() == 1 and pg.locator('.day-card .up-next').count() == 1)

    # ---------- atajos ----------
    pg.mouse.click(700, 400); pg.keyboard.press('Shift+Slash'); time.sleep(0.2)
    ok('«?» opens shortcuts', pg.locator('.keys-table').count() == 1 and 'Vista de Guardia' in pg.inner_text('.keys-table'))
    pg.keyboard.press('Escape'); time.sleep(0.2)
    pg.keyboard.press('g'); time.sleep(0.2)
    ok('«G» opens Vista de Guardia', pg.locator('.guard-quick').count() == 1)
    pg.keyboard.press('Escape'); time.sleep(0.2)

    # ---------- Preferencias → IA ----------
    pg.click('.rail-btn:has-text("Ajustes")'); pg.click('.rail-pop button:has-text("Preferencias")'); pg.wait_for_selector('.prefs')
    ver = re.search(r"APP_VERSION = '([^']+)'", open('/home/claude/quiron_codex/src/version.ts').read()).group(1)
    ok('version shown', ver in pg.inner_text('.prefs'), ver)
    pg.fill('.prefs input[aria-label^="API key de Claude"]', 'sk-ant-abcd1234'); pg.click('.prefs button:has-text("Guardar")'); time.sleep(0.2)
    ok("API key saved in Preferencias", "guardada (…1234)" in pg.inner_text(".prefs"))
    pg.keyboard.press('Escape'); time.sleep(0.8)
    ok('API key persisted', pg.evaluate("() => JSON.parse(localStorage.getItem('alq:settings')).apiKey") == 'sk-ant-abcd1234')

    # ---------- PDF con anotaciones ----------
    pg.click('.rail-btn:has-text("Herramientas")'); pg.click('.rail-pop button:has-text("GPC")'); pg.wait_for_selector('.temario')
    pg.fill('.temario input', 'neumonia adquirida'); pg.click('.temario-list li >> nth=0 >> button'); pg.wait_for_selector('.topic-sheet')
    pg.set_input_files('.topic-sheet input[type=file]', ['/tmp/tc/043GER_Neumonia.pdf']); pg.wait_for_selector('.att'); time.sleep(0.6)
    tid = [k for k, v in pg.evaluate(KV, 'topics')['info'].items() if v['attachments']][0]
    pg.click('.att button:has-text("Abrir")'); pg.wait_for_function("[...document.querySelectorAll('.pdf-page > canvas')].some(c => c.width > 0)", timeout=15000); time.sleep(0.6)
    pg.click('.pdf-workspace [data-more-toggle]'); pg.wait_for_selector('.more-menu')
    ok('«⋯» menu: AI and cloze disabled without highlights', pg.locator('.more-menu button:has-text("Flashcards de huecos")').is_disabled() and pg.locator('.more-menu button:has-text("Preguntas con IA")').is_disabled())
    pg.keyboard.press('Escape'); time.sleep(0.1)
    ok('menu closes with Esc', pg.locator('.more-menu').count() == 0)
    box = pg.locator('.pdf-page[data-page="1"]').bounding_box()
    pg.click('button[aria-label="Resaltar área"]')
    pg.mouse.move(box['x'] + box['width'] * 0.08, box['y'] + box['height'] * 0.08); pg.mouse.down()
    pg.mouse.move(box['x'] + box['width'] * 0.92, box['y'] + box['height'] * 0.45, steps=6); pg.mouse.up(); time.sleep(0.6)
    pg.click('button[aria-label="Subrayar"]')
    uy = box['y'] + box['height'] * 0.3
    pg.mouse.move(box['x'] + box['width'] * 0.1, uy); pg.mouse.down(); pg.mouse.move(box['x'] + box['width'] * 0.8, uy, steps=6); pg.mouse.up(); time.sleep(0.6)
    pg.click('button[aria-label="Escribir / dibujar"]')
    pg.mouse.move(box['x'] + 100, box['y'] + box['height'] * 0.5); pg.mouse.down()
    pg.mouse.move(box['x'] + 260, box['y'] + box['height'] * 0.55, steps=10); pg.mouse.up(); time.sleep(0.4)
    pg.click('button[aria-label="Post-it"]'); pg.mouse.click(box['x'] + box['width'] * 0.7, box['y'] + box['height'] * 0.52); time.sleep(0.4)
    pg.wait_for_selector('textarea.sticky-text', timeout=5000)
    pg.fill('textarea.sticky-text >> nth=0', 'Revisar criterios de hospitalización (CURB-65)'); time.sleep(0.2)
    pg.click('button[aria-label="Navegar"]'); pg.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + 20)
    pg.keyboard.press('b'); time.sleep(1.2)
    lib = pg.evaluate(KV, 'library'); did = [d for d in lib['docs']][0]['id']
    n_hl = len(lib['highlights'].get(did, [])); n_ink = len(lib['inks'].get(did, [])); n_st = len([s for s in lib['stickies'].get(did, []) if s['text'].strip()])
    print('HL', [h['text'][:50] for h in lib['highlights'].get(did, [])]); ok('annotations created', n_hl == 2 and n_ink >= 1 and n_st == 1 and len(lib['bookmarks'].get(did, [])) == 1, (n_hl, n_ink, n_st))

    # ---------- PDF anotado ----------
    pg.click('.pdf-workspace [data-more-toggle]'); pg.wait_for_selector('.more-menu'); pg.screenshot(path='/tmp/tc/shots/v6-more.png')
    with pg.expect_download() as dl:
        pg.click('.more-menu button:has-text("Exportar PDF anotado")')
    path = dl.value.path(); data = open(path, 'rb').read()
    orig = open('/tmp/tc/043GER_Neumonia.pdf', 'rb').read()
    import pypdf, io
    ro, ra = pypdf.PdfReader(io.BytesIO(orig)), pypdf.PdfReader(io.BytesIO(data))
    ok('annotated PDF downloaded', data[:4] == b'%PDF' and dl.value.suggested_filename == '043GER_Neumonia (anotado).pdf', dl.value.suggested_filename)
    ok('bookmark index page appended', len(ra.pages) == len(ro.pages) + 1 and 'Marcadores' in ra.pages[-1].extract_text(), (len(ro.pages), len(ra.pages)))
    c0, c1 = ro.pages[0].get_contents().get_data(), ra.pages[0].get_contents().get_data()
    ok('annotations drawn into page 1', len(c1) > len(c0) + 500 and b' l' in c1, (len(c0), len(c1)))
    ok('post-it text in the PDF', 'CURB-65' in ra.pages[0].extract_text())
    ok('original pages kept', ra.pages[1].extract_text()[:40] == ro.pages[1].extract_text()[:40])
    time.sleep(0.3)
    ok('export toast', 'PDF anotado listo: 2 resaltados' in (pg.inner_text('.toast') if pg.locator('.toast').count() else ''))

    # ---------- Huecos desde los subrayados ----------
    pg.click('.pdf-workspace [data-more-toggle]'); pg.click('.more-menu button:has-text("Flashcards de huecos")'); pg.wait_for_selector('.cloze-list')
    pg.screenshot(path='/tmp/tc/shots/v6-cloze.png')
    items = pg.locator('.cloze-list li').count()
    expect = len([h for h in pg.evaluate(KV, 'library')['highlights'][did] if len(h['text'].split()) >= 3])
    ok('cloze lists highlights with 3+ words', items == expect and items >= 1, (items, expect))
    ok('a blank is suggested', pg.locator('.cloze-list li >> nth=0 >> .cw.hidden').count() >= 1 and '_____' in pg.inner_text('.cloze-list li >> nth=0 >> .cloze-preview'))
    ok('topic preselected from the attached GPC', pg.input_value('.modal-foot select, .modal select[aria-label="Tema"]') == tid)
    # cambia el hueco del primero: quita la sugerencia y esconde la 3.ª palabra
    li0 = '.cloze-list li >> nth=0'
    for i in range(pg.locator(f'{li0} >> .cw.hidden').count()):
        pg.locator(f'{li0} >> .cw.hidden').first.click()
    w3 = pg.inner_text(f'{li0} >> .cw >> nth=3')
    pg.click(f'{li0} >> .cw >> nth=3')
    ok('punctuation is not clickable', pg.locator(f'{li0} >> span.cw-punct').count() >= 1)
    for k in range(1, items): pg.uncheck(f'.cloze-list li >> nth={k} >> input[type=checkbox]')
    ok('one card selected', 'Crear 1 flashcard' in pg.inner_text('.modal button.primary'))
    pg.click('.modal button:has-text("Crear 1 flashcard")'); time.sleep(1.0)
    cards = pg.evaluate(KV, 'cards')['cards']
    c = cards[0] if cards else {}
    ok('cloze card saved', len(cards) == 1 and '_____' in c['front'] and w3.strip('.,;:()«»') in c['back'] and w3 not in c['front'].split() and c['source']['page'] == 1 and c['topicId'] == tid, (c.get('front', '')[:60], c.get('back', '')[:40]))

    # ---------- Huecos desde una selección (menú de perlas) ----------
    pg.locator('.pdf-page[data-page="1"]').scroll_into_view_if_needed(); time.sleep(0.4)
    sel = '.pdf-page[data-page="1"] .textLayer span'
    pg.wait_for_function(f"() => [...document.querySelectorAll('{sel}')].filter(s => s.textContent.split(' ').length > 4).length > 0", timeout=10000)
    idx = pg.evaluate(f"() => [...document.querySelectorAll('{sel}')].findIndex((s, i) => i > 3 && s.textContent.trim().split(/\\s+/).length > 4)")
    bb = pg.locator(sel).nth(idx).bounding_box()
    pg.mouse.move(bb['x'] + 2, bb['y'] + bb['height'] / 2); pg.mouse.down()
    pg.mouse.move(bb['x'] + bb['width'] * 0.95, bb['y'] + bb['height'] / 2, steps=8); pg.mouse.up(); time.sleep(0.6)
    if pg.locator('.pearl-menu').count():
        pg.click('.pearl-menu button:has-text("Huecos")'); pg.wait_for_selector('.cloze-list')
        ok('cloze from a text selection', pg.locator('.cloze-list li').count() == 1 and 'p. 1' in pg.inner_text('.cloze-check'))
        pg.click('.modal button.primary'); time.sleep(0.8)
        ok('second cloze card', len(pg.evaluate(KV, 'cards')['cards']) == 2)
    else:
        ok('cloze from a text selection', False, 'no pearl menu')

    # repaso: el hueco se ve en el frente
    pg.click('.rail-btn:has-text("Inicio")'); pg.click('.fc-card button:has-text("Repasar")'); pg.wait_for_selector('.flashcard')
    ok('cloze card in review', '_____' in pg.inner_text('.flashcard .fc-front'))
    pg.keyboard.press('Escape'); time.sleep(0.3)

    # ---------- Novedades para quien ya usaba la app ----------
    pg.evaluate("localStorage.setItem('qc:seenVersion', '0.5.2')"); pg.reload(); pg.wait_for_selector('.rail'); time.sleep(1.0)
    ok('«Novedades» after updating', pg.locator('.news-list').count() == 1 and len(pg.inner_text('.news-list')) > 80)
    pg.click('.modal button:has-text("Entendido")'); time.sleep(0.2)
    pg.reload(); pg.wait_for_selector('.rail'); time.sleep(1.0)
    ok('shown only once', pg.locator('.news-list').count() == 0)

    real = [e for e in errs if 'favicon' not in e]
    print('errors', real[:5]); ok('no console errors', not real)
    print(f'SUMMARY {sum(res.values())} / {len(res)}')
    b.close()
