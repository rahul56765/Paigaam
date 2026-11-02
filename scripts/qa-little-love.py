#!/usr/bin/env python3
"""Browser QA against real PAIGAAM family routes in a disposable SQLite fixture.
Dev-only: pip install playwright==1.58.0; python3 -m playwright install chromium
Run: python3 scripts/qa-little-love.py
Does not install/replace application dependencies, contact production, or test payments.
"""
import io, json, os, re, subprocess, tempfile, time, urllib.request, urllib.parse, wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-output/little-love'
OUT.mkdir(parents=True, exist_ok=True)
results = []
def passed(name):
    results.append(name)
    print('PASS ' + name, flush=True)
def data_url(base, data):
    return base + '/little-love/preview-frame?d=' + urllib.parse.quote(json.dumps(data))
def settled(page):
    expect(page.locator('[data-go="0"]')).to_be_enabled()
def go(page, number):
    page.locator('[data-go="%d"]' % number).click()
    settled(page)
    expect(page.locator('[data-current]')).to_have_text(str(number + 1))
def shot(page, name):
    page.screenshot(path=str(OUT / (name + '.png')), full_page=True)
with tempfile.TemporaryDirectory(prefix='little-love-browser-') as temporary:
    env = dict(os.environ, DATA_DIR=temporary, PAIGAAM_LITTLE_LOVE_QA='1', PORT='4002')
    log = open(OUT / 'fixture.log', 'w')
    process = subprocess.Popen(['node', str(ROOT / 'tests/fixtures/little-love-browser.cjs')], cwd=ROOT, env=env, stdout=log, stderr=log)
    base = 'http://127.0.0.1:4002'
    try:
        for _ in range(100):
            if process.poll() is not None: raise RuntimeError('Fixture exited: ' + (OUT / 'fixture.log').read_text())
            try:
                if urllib.request.urlopen(base + '/little-love/demo', timeout=1).status == 200: break
            except Exception: time.sleep(.1)
        else: raise RuntimeError('Fixture did not start')
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width':1440, 'height':1000})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/little-love/demo')
            page.evaluate('document.fonts.ready')
            expect(page.locator('[data-current]')).to_have_text('1')
            assert page.locator('.ll-page.is-current').count() == 1
            assert page.evaluate('document.querySelectorAll(".ll-page[inert]").length') == 4
            assert page.evaluate('document.getElementById("llSongAudio").paused && document.getElementById("llMemoryAudio").paused')
            shot(page, 'desktop-1-cover')
            passed('initial state, all art loaded, no autoplay, inactive pages inert')
            page.locator('[data-open]').first.click()
            expect(page.locator('#llCard')).to_have_class(re.compile('is-turning'))
            assert page.locator('[data-next]').is_disabled()
            settled(page)
            assert page.locator('.ll-page.is-current').get_attribute('data-page') == '1'
            shot(page, 'desktop-2-letter')
            page.locator('[data-next]').click()
            expect(page.locator('#llCard')).to_have_class(re.compile('is-sliding'))
            settled(page)
            shot(page, 'desktop-3-memories')
            passed('cover shrink/Y-flip and inner horizontal slide both execute and unlock')
            page.locator('[data-play="memory"]').click()
            page.wait_for_function('document.getElementById("llMemoryAudio").currentTime > .15')
            expect(page.locator('[data-play="memory"]')).to_have_attribute('aria-pressed', 'true')
            seek = page.locator('[data-seek="memory"]')
            seek.fill('550'); seek.dispatch_event('input')
            assert page.evaluate('document.getElementById("llMemoryAudio").currentTime') > 12
            page.keyboard.press('ArrowRight')
            assert page.locator('[data-current]').inner_text() == '3', 'range arrow must not turn page'
            go(page, 3)
            assert page.evaluate('document.getElementById("llMemoryAudio").paused')
            page.locator('.ll-song-transport [data-play="song"]').click()
            page.wait_for_function('document.getElementById("llSongAudio").currentTime > .15')
            shot(page, 'desktop-4-song')
            go(page, 4)
            assert page.evaluate('document.getElementById("llSongAudio").paused')
            shot(page, 'desktop-5-closing')
            page.locator('[data-replay]').click(); settled(page)
            expect(page.locator('[data-current]')).to_have_text('1')
            passed('real MP3 playback, actual duration/seek, range keyboard safety, exclusive pause and replay')
            page.locator('[data-disc]').click()
            expect(page.locator('#llPlaylist')).to_be_visible()
            assert page.evaluate('document.getElementById("llSongAudio").paused')
            shot(page, 'desktop-playlist')
            page.keyboard.press('Escape')
            expect(page.locator('#llPlaylist')).to_be_hidden()
            expect(page.locator('[data-disc]')).to_be_focused()
            passed('record opens playlist without autoplay, Escape closes and restores focus')
            audio = (ROOT / 'public/little-love/little-melody.mp3').read_bytes()
            page.route('https://media.example.test/second.mp3', lambda route: route.fulfill(body=audio, content_type='audio/mpeg'))
            page.goto(data_url(base, {'senderName':'One','recipientName':'Two','playlist':[{'title':'A second song','url':'https://media.example.test/second.mp3'}]}))
            go(page, 3)
            page.locator('[data-track-step="1"]').click()
            expect(page.locator('.ll-song-title')).to_have_text('A second song')
            page.wait_for_function('document.getElementById("llSongAudio").currentTime > .1')
            page.locator('[data-track-step="-1"]').click()
            expect(page.locator('.ll-song-title')).to_have_text('listen to this :)')
            passed('previous/next select actual playlist tracks; browser receives controlled audio fixture')
            # This validates provider selection/mounting, not live YouTube playback availability.
            page.route('https://www.youtube-nocookie.com/**', lambda route: route.fulfill(body='<html><body>Controlled provider shell for routing test</body></html>', content_type='text/html'))
            page.goto(data_url(base, {'senderName':'One','recipientName':'Two','playlist':[{'title':'A video song','url':'https://m.youtube.com/watch?v=dQw4w9WgXcQ'}]}))
            go(page,3);page.locator('[data-track-step="1"]').click()
            expect(page.locator('[data-youtube-host] iframe')).to_have_attribute('src',re.compile('/embed/dQw4w9WgXcQ'))
            page.locator('[data-track-step="-1"]').click()
            assert page.locator('[data-youtube-host] iframe').count() == 0
            passed('additional mobile-host YouTube song mounts on gesture and switching back removes it; provider network mocked')
            # All frame geometry/real images checked in desktop, tablet, narrow portrait and landscape.
            page.emulate_media(reduced_motion='reduce')
            for width,height in [(390,844),(320,640),(768,1024),(844,390)]:
                page.set_viewport_size({'width':width,'height':height})
                for n in range(5):
                    go(page,n)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'horizontal overflow at {width}x{height} page{n}'
                    assert page.evaluate('Array.from(document.querySelectorAll(".ll-page.is-current img")).every(i=>i.complete && i.naturalWidth>0)')
                    shot(page, f'{width}x{height}-page-{n+1}')
            passed('all five pages: loaded media and no horizontal overflow at four mobile/tablet/landscape sizes')
            long_letter = ('A long letter with treasured memories and little moments. ' * 30)[:900]
            page.set_viewport_size({'width':390,'height':844})
            page.goto(data_url(base, {'senderName':'One','recipientName':'Two','loveLetter':long_letter,'letterHeading':'A very long heading filled with our favourite words'}))
            go(page,1)
            assert page.locator('.ll-letter-copy').inner_text() == long_letter
            assert page.evaluate('parseFloat(getComputedStyle(document.querySelector(".ll-letter-copy")).fontSize) >= 11.5')
            assert page.evaluate('document.querySelector("[data-fit]").scrollHeight >= document.querySelector("[data-fit]").clientHeight')
            shot(page, 'mobile-max-letter')
            page.locator('#llCard').dispatch_event('pointerdown', {'clientX':280,'clientY':450,'pointerId':7,'isPrimary':True})
            page.locator('#llCard').dispatch_event('pointerup', {'clientX':100,'clientY':455,'pointerId':7,'isPrimary':True})
            expect(page.locator('[data-current]')).to_have_text('3')
            page.locator('[data-next]').focus();page.keyboard.press('End')
            expect(page.locator('[data-current]')).to_have_text('5')
            page.keyboard.press('Home');expect(page.locator('[data-current]')).to_have_text('1')
            passed('900-character letter remains complete/readable; swipe, Home/End and reduced motion work')
            nojs = browser.new_context(java_script_enabled=False,viewport={'width':1280,'height':900})
            nojs_page = nojs.new_page();nojs_page.goto(base+'/little-love/demo')
            assert nojs_page.locator('.ll-page:visible').count() == 5
            assert nojs_page.locator('.ll-page[aria-hidden="true"]').count() == 0
            nojs.close();passed('no-JavaScript fallback exposes all five pages visually and semantically')
            # The actual shared field-driven editor, autosave, upload and publish, against disposable data.
            page.set_viewport_size({'width':1440,'height':1000})
            page.goto(base+'/create/little-love')
            page.locator('#f-senderName').fill('QA Sender')
            page.locator('#f-recipientName').fill('QA Recipient')
            page.locator('#next').click()
            page.locator('#f-loveLetter').fill('A browser-tested personal letter.')
            expect(page.frame_locator('#liveFrame').locator('.ll-letter-copy')).to_contain_text('A browser-tested personal letter.')
            page.locator('#next').click()
            recording = io.BytesIO()
            with wave.open(recording,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*800)
            page.locator('[data-audio="musicUpload"] input[type=file]').set_input_files({'name':'memory.wav','mimeType':'audio/wav','buffer':recording.getvalue()})
            expect(page.locator('[data-audio="musicUpload"]')).to_contain_text('Song added and saved.')
            page.locator('#next').click();page.locator('#f-songTitle').fill('Our browser-tested song')
            page.locator('#next').click();page.locator('#f-closingTitle').fill('All our love')
            page.locator('#next').click();expect(page.locator('#publish')).to_be_visible()
            page.locator('#publish').click()
            expect(page.locator('#publishedUrl')).to_have_value(re.compile('/p/'))
            published=page.locator('#publishedUrl').input_value()
            page.goto(published)
            expect(page.locator('[data-current]')).to_have_text('1')
            assert '/bfday/uploads/' in page.locator('#llMemoryAudio').get_attribute('src')
            assert page.locator('.ll-letter-copy').inner_text() == 'A browser-tested personal letter.'
            shot(page,'published-instance')
            passed('real editor live preview, draft autosave, voice upload, free publish and published rendering')
            assert not errors, errors
            passed('no uncaught browser JavaScript errors')
            context.close();browser.close()
        (OUT/'results.json').write_text(json.dumps({'scope':'Real family routes in disposable SQLite fixture; not full server, payments or production','passed':results,'count':len(results)},indent=2)+'\n')
        print(f'{len(results)} browser scenarios passed; screenshots: {OUT}')
    finally:
        process.terminate()
        try:process.wait(timeout=8)
        except subprocess.TimeoutExpired:process.kill();process.wait()
        log.close()
