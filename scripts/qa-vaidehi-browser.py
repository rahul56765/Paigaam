"""Browser verification of the real Vaidehi family render and generated editor.
Requires Python Playwright and its Chromium. Launches an isolated family QA server
unless VAIDEHI_QA_BASE is supplied. No production data or external sends are used.
"""
import json, os, socket, subprocess, tempfile, time, urllib.request, io, wave
import zxingcpp
from PIL import Image
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-output/vaidehi';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(condition,label):
    assert condition,label
    checks.append(label)
def settle(page):page.wait_for_timeout(1050)
child=None;tmp=None
base=os.environ.get('VAIDEHI_QA_BASE')
if not base:
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
    tmp=tempfile.TemporaryDirectory(prefix='vaidehi-browser-')
    child=subprocess.Popen(['node','scripts/qa-vaidehi-server.js'],cwd=ROOT,env={**os.environ,'PORT':str(port),'DATA_DIR':tmp.name},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    base=f'http://127.0.0.1:{port}'
    for _ in range(100):
        try:
            with urllib.request.urlopen(base+'/vaidehi/demo') as r:
                if r.status==200:break
        except Exception:time.sleep(.1)
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    errors=[]
    page=browser.new_page(viewport={'width':390,'height':844},has_touch=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/vaidehi/demo');page.locator('#vv-open').wait_for()
    check(page.locator('#vv-invitation').evaluate('(e)=>e.inert'),'gate keeps invitation inert until opening')
    page.locator('#vv-open').click();settle(page)
    check(not page.locator('#vv-invitation').evaluate('(e)=>e.inert'),'opening reveals the actual invitation')
    check(page.locator('.vv-navigation').is_visible(),'section navigation becomes available')
    # Layout and asset checks across phone, tablet and desktop widths.
    for w,h in [(320,740),(390,844),(430,932),(768,1024),(1366,900)]:
        page.set_viewport_size({'width':w,'height':h})
        for sec in ['cover','details','moments','welcome','blessings','schedule','countdown']:
            page.locator('#vv-'+sec).evaluate('(e)=>e.scrollIntoView({behavior:"instant"})');settle(page)
            check(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'{w}px {sec}: no horizontal overflow')
            check(page.locator('#vv-'+sec).evaluate('(e)=>[...e.querySelectorAll("h2,h3,.vv-names span")].every(x=>x.scrollWidth<=x.clientWidth+2)'),f'{w}px {sec}: no clipped heading')
            if w==390:page.screenshot(path=str(OUT/(sec+'.png')))
        check(page.evaluate('[...document.images].filter(x=>x.getAttribute("src")).every(x=>!x.complete||x.naturalWidth>0)'),f'{w}px: no broken loaded images')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#vv-moments').evaluate('(e)=>e.scrollIntoView({behavior:"instant"})');settle(page)
    page.locator('[data-vv-photo-next]').click();settle(page)
    check(page.locator('[data-vv-photo-counter]').inner_text()=='2 / 4','gallery next selects second photo and synchronises scroll')
    page.locator('.vv-polaroid.is-active').click()
    check(page.locator('#vv-lightbox').evaluate('(e)=>e.open'),'photo opens modal lightbox')
    old=page.locator('#vv-lightbox img').get_attribute('src')
    page.keyboard.press('ArrowRight')
    check(page.locator('#vv-lightbox img').get_attribute('src')!=old,'lightbox keyboard next changes photo')
    page.keyboard.press('Escape')
    check(not page.locator('#vv-lightbox').evaluate('(e)=>e.open'),'Escape closes lightbox')
    check(page.locator('.vv-polaroid.is-active').evaluate('(e)=>e===document.activeElement'),'lightbox restores keyboard focus')
    # Horizontal gallery swipe while vertical page scrolling stays native.
    page.locator('#vv-photo-stack').dispatch_event('touchstart',{'touches':[{'identifier':0,'clientX':250,'clientY':400}]})
    page.locator('#vv-photo-stack').dispatch_event('touchend',{'changedTouches':[{'identifier':0,'clientX':140,'clientY':402}]})
    settle(page)
    check(page.locator('[data-vv-photo-counter]').inner_text()=='3 / 4','horizontal swipe advances gallery')
    # Every section is reachable from the discreet nav, in both directions.
    for i,name in enumerate(['Invitation','Wedding details','Our moments','Friends and family','Blessings and venue','Wedding schedule','Countdown']):
        page.locator('.vv-navigation a').nth(i).click();settle(page)
        check(page.locator('.vv-navigation a').nth(i).get_attribute('aria-current')=='location','navigation reaches '+name)
    page.locator('[data-vv-prev]').click();settle(page)
    check(page.locator('.vv-navigation a').nth(5).get_attribute('aria-current')=='location','previous section navigation works')
    page.locator('.vv-event summary').first.click()
    check(page.locator('.vv-event details').first.get_attribute('open') is not None,'schedule card expands full venue details')
    check(page.locator('.vv-event-expanded').first.is_visible(),'expanded venue and directions are visible')
    check('Aarohi' in page.locator('.vv-event-expanded').first.inner_text(),'schedule venue is correctly populated')
    check('google.com/maps' in page.locator('.vv-map-link').first.get_attribute('href'),'Google Maps action is a real destination')
    check(page.locator('.vv-countdown-copy').evaluate('(e)=>parseFloat(getComputedStyle(e).paddingTop)>300'),'countdown typography stays below the joined-hands artwork')
    check(page.locator('.vv-qr svg').count()==1,'dynamic QR is an actual local SVG')
    decoded=zxingcpp.read_barcode(Image.open(io.BytesIO(page.locator('.vv-qr').screenshot())))
    check(decoded is not None and decoded.text==page.locator('.vv-qr').get_attribute('href'),'default QR decodes to the exact configured destination')
    # A long strict-valid URL gets more space; scan the actual 320px rendering.
    dense_url='https://example.com/'+('a'*1400)
    for width in [320,390]:
        dense={**json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./templates/vaidehi/config').demo))"],cwd=ROOT)), 'qrDestination':dense_url}
        rr=page.request.post(base+'/vaidehi/preview-frame',data={'customer_data':dense})
        qp=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
        qp.route('**/qa-dense-'+str(width),lambda route:route.fulfill(status=200,content_type='text/html',body=rr.text()))
        qp.goto(base+'/qa-dense-'+str(width)+'#vv-blessings');settle(qp)
        code=zxingcpp.read_barcode(Image.open(io.BytesIO(qp.locator('.vv-qr').screenshot())))
        check(code is not None and code.text==dense_url,str(width)+'px dense QR decodes exactly at DPR 1')
        qp.close()
    # Countdown progresses and expires without negative values.
    target=page.locator('.vv-timer[data-target]').get_attribute('data-target')
    page.evaluate('(t)=>Date.now=()=>Number(t)-5500',target);page.wait_for_timeout(1100)
    check(page.locator('[data-unit="seconds"]').inner_text()=='05','countdown uses configured target and live time')
    page.evaluate('(t)=>Date.now=()=>Number(t)+1000',target);page.wait_for_timeout(1100)
    check(page.locator('[data-unit="days"]').inner_text()=='00','expired countdown clamps to zero')
    check(page.locator('.vv-countdown-status').inner_text()=='The celebration has begun!','countdown shows celebration state')
    # Partial and maximum-length customer data through the real preview route.
    long={'groomName':'Rohan Alexander Malhotra '*3,'brideName':'Kiara Devyani Shah '*4,'weddingDate':'2028-03-12','weddingTime':'18:45','venueName':'A spacious celebration garden in Pune','venueAddress':'A long but valid venue address, Baner, Pune, Maharashtra 411045','invitationMessage':'With our heartfelt love and blessings, please join our celebration. '*25,'blessingMessage':'We welcome you with love. '*30,'events':[],'gallery':[]}
    long['groomName']=long['groomName'][:80];long['brideName']=long['brideName'][:80]
    res=page.request.post(base+'/vaidehi/preview-frame',data={'customer_data':long})
    check(res.status==200,'long customisation renders through real stateless route')
    page.route('**/qa-personalised',lambda route:route.fulfill(status=200,content_type='text/html',body=res.text()))
    page.goto(base+'/qa-personalised#vv-cover');settle(page)
    check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),'long customer names and messages do not overflow phone')
    check('2027' not in page.locator('.vv-cover-copy').inner_text(),'changed wedding date replaces sample date')
    check(page.locator('[data-vv-photo]').count()==0,'empty personal gallery does not reintroduce demo faces')
    for sec in ['welcome','blessings']:
        page.locator('#vv-'+sec).evaluate('(e)=>e.scrollIntoView({behavior:"instant"})');settle(page)
        check(not page.locator('#vv-'+sec).evaluate('(e)=>e.scrollWidth>e.clientWidth'),'long '+sec+' message stays in its section')
    # Maximum lists remain usable on the narrowest tested phone.
    demo_data=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./templates/vaidehi/config').demo))"],cwd=ROOT))
    max_data={**demo_data,'events':[{**demo_data['events'][0],'name':'Celebration '+str(i)} for i in range(20)],'gallery':[demo_data['gallery'][i%4] for i in range(12)],'couplePhoto':''}
    mr=page.request.post(base+'/vaidehi/preview-frame',data={'customer_data':max_data})
    page.route('**/qa-maximal',lambda route:route.fulfill(status=200,content_type='text/html',body=mr.text()))
    page.set_viewport_size({'width':320,'height':740});page.goto(base+'/qa-maximal#vv-schedule');settle(page)
    check(page.locator('.vv-event').count()==20,'all 20 event cards remain present on a 320px phone')
    check(page.locator('[data-vv-photo]').count()==12,'all 12 configured gallery photos remain present')
    check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),'20 events and 12 photos do not cause horizontal overflow')
    # Upload a real WAV through the shared API, then exercise actual audio.
    dr=page.request.post(base+'/api/vaidehi/draft',data={'customer_data':demo_data});check(dr.status==200,'browser creates an owned draft through the real API')
    draft_id=dr.json()['id'];buf=io.BytesIO()
    with wave.open(buf,'wb') as wf:wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(8000);wf.writeframes(b'\x00\x00'*8000)
    ar=page.request.post(base+'/api/vaidehi/upload-audio?id='+draft_id,data=buf.getvalue(),headers={'content-type':'audio/wav'})
    check(ar.status==200,'browser uploads actual WAV background music')
    music_data={**demo_data,'musicUpload':ar.json()['url']}
    ur=page.request.post(base+'/api/vaidehi/draft',data={'id':draft_id,'customer_data':music_data});check(ur.status==200,'audio reference saves to owned customer data')
    page.goto(base+'/vaidehi/preview/'+draft_id)
    check(page.locator('#vv-audio').evaluate('(e)=>e.paused'),'music is paused before the opening gesture')
    page.locator('#vv-open').click();settle(page)
    check(page.locator('#vv-music-toggle').get_attribute('aria-pressed')=='true','opening gesture starts uploaded music')
    page.locator('#vv-music-toggle').click()
    check(page.locator('#vv-audio').evaluate('(e)=>e.paused'),'music pause control actually pauses audio')
    page.locator('#vv-music-toggle').click();page.wait_for_timeout(200)
    check(not page.locator('#vv-audio').evaluate('(e)=>e.paused'),'music play control actually resumes audio')
    # Browser without JavaScript still exposes all seven panels and all photos.
    nojs=browser.new_context(java_script_enabled=False,viewport={'width':320,'height':740});np=nojs.new_page();np.goto(base+'/vaidehi/demo')
    check(np.locator('[data-vv-section]').count()==7,'no-JS invitation retains all seven panels')
    check(np.locator('.vv-polaroid').count()==4,'no-JS gallery retains every photograph')
    check(np.get_by_role('button',name='Enlarge photograph',exact=False).count()==4,'no-JS gallery exposes all four photos to assistive technology')
    check(not np.locator('#vv-gate').is_visible(),'no-JS opening never blocks content')
    # Reduced motion removes decorative animation, not functionality.
    reduced=browser.new_context(reduced_motion='reduce',viewport={'width':390,'height':844});rp=reduced.new_page();rp.goto(base+'/vaidehi/demo');rp.locator('#vv-open').click()
    check(rp.locator('.vv-garland').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none','reduced-motion stops decorative swaying')
    rp.locator('.vv-navigation a').nth(5).click()
    check(rp.locator('#vv-schedule').bounding_box()['y']<5,'reduced-motion navigation is immediate')
    check(not errors,'no uncaught browser errors: '+str(errors))
    browser.close()
 print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
 (OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2)+'\n')
finally:
 if child:child.terminate();child.wait(timeout=10)
 if tmp:tmp.cleanup()
