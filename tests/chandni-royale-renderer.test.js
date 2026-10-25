'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const C=require('../public/shaadi-paigaam/chandni-royale-core'),R=require('../templates/chandni-royale/renderer');
const root=path.join(__dirname,'..');
test('renderer owns visual assets and emits safe data, no legacy visuals or eager media',()=>{
 const d=JSON.parse(JSON.stringify(C.SAMPLE));d.couple.groom.first='</script><script>alert(1)</script>';d.welcome.text='</script> & <img onerror=bad>';
 const html=R.renderInvitation(d,{mode:'preview',openingVideo:true,noindex:true});
 assert.ok(html.includes('/chandni-royale/invite.css?v=1'));assert.ok(html.includes('id="cr-boot"'));assert.ok(!html.includes('/shaadi-paigaam/invite.js'));assert.ok(!html.includes('/shaadi-paigaam/art.js'));assert.ok(!html.includes('/suvarna-vivah/'));
 const json=html.match(/<script id="cr-boot" type="application\/json">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json).data.welcome.text,d.welcome.text);assert.ok(!json.includes('<'));assert.ok(!json.includes('&'));
 assert.ok(!/<video|<audio/.test(html));assert.ok(!/<link[^>]+as="video"/.test(html));assert.ok(!/<script>alert\(1\)<\/script>/.test(html));
 const runtime=fs.readFileSync(path.join(root,'public/chandni-royale/invite.js'),'utf8');new vm.Script(runtime);assert.ok(runtime.includes("film.src=cfg.videoUrl"));assert.ok(runtime.includes("film.preload='none'"));assert.ok(runtime.includes("audio.preload='none'"));assert.ok(!runtime.includes('autoplay'));
});
test('private and ended screens use only the new visual system and do not include data',()=>{
 const d=JSON.parse(JSON.stringify(C.SAMPLE)),gate=R.renderGate(d,{action:'/chandni-royale/unlock/id',wrong:true}),ended=R.renderEnded(d);
 assert.ok(gate.includes('name="passcode"'));assert.ok(gate.includes('role="alert"'));assert.ok(!gate.includes('cr-boot'));assert.ok(!gate.includes(d.venue.address));assert.ok(!gate.includes('/shaadi-paigaam/'));assert.ok(!ended.includes('/shaadi-paigaam/'));
});
test('original media pack decodes to exact checksummed web images and intentionally contains no film',()=>{
 const dir=path.join(root,'assets/chandni-royale'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 assert.equal(Object.keys(manifest).length,5);assert.ok(!manifest['opener.mp4']);
 for(const [name,spec]of Object.entries(manifest)){
  assert.match(name,/^[a-z0-9-]+\.webp$/);let b64='';for(let i=1;i<=spec.parts;i++)b64+=fs.readFileSync(path.join(dir,name+'.b64.part'+String(i).padStart(2,'0')),'utf8').trim();
  const bytes=Buffer.from(b64,'base64');assert.equal(bytes.length,spec.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),spec.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 assert.deepEqual(require('../lib/chandniRoyaleMedia').ensureChandniRoyaleMedia(),[]);
});
test('runtime has real canvas scratch, keyboard alternative and draft WhatsApp links without guest form',()=>{
 const js=fs.readFileSync(path.join(root,'public/chandni-royale/invite.js'),'utf8');
 for(const text of ["globalCompositeOperation='destination-out'",'getImageData','onpointerdown','onpointermove',"id=\"cr-reveal\"",'C.whatsappRsvpLink','C.icsFor','C.zonedToUtc',"e.source!==window.parent",'showModal()'])assert.ok(js.includes(text),text);
 assert.ok(!js.includes('<form'));assert.ok(!js.includes('rsvp/:'));assert.ok(!js.includes('fetch('));
});
