// Original text-only editors keep their UI; bind publish to the save response.
(function(){
  'use strict';
  var nativeFetch=window.fetch.bind(window),snapshots=new Map(),sending=false,frozen=[];
  function lock(){document.querySelectorAll('#wizard input,#wizard textarea,#wizard select,#wizard button').forEach(function(el){if(el.id!=='publish'&&!el.disabled){el.disabled=true;frozen.push(el);}});}
  function unlock(){frozen.forEach(function(el){el.disabled=false;});frozen=[];sending=false;}
  document.addEventListener('click',function(e){
    var button=e.target.closest&&e.target.closest('#publish');
    if(!button||button.disabled)return;
    sending=true;lock();
    // Editors may reject locally before issuing a request.
    setTimeout(function(){if(sending==='validating')unlock();},0);
    sending='validating';
  },true);
  window.fetch=function(input,options){
    var url=new URL(typeof input==='string'?input:input.url,location.href),opts=options||{};
    var match=url.origin===location.origin&&/^\/api\/(maafi|saalgirah|lavender-bloom|valentine-say-yes|love-awaits)\/(draft|publish)$/.exec(url.pathname);
    if(!match||!opts.body||typeof opts.body!=='string')return nativeFetch(input,options);
    var body;try{body=JSON.parse(opts.body);}catch{return nativeFetch(input,options);}
    if(sending)sending=true;
    if(match[2]==='publish'){body.expected_snapshot=snapshots.get(match[1]+':'+body.id)||null;opts=Object.assign({},opts,{body:JSON.stringify(body)});}
    return nativeFetch(input,opts).then(function(response){
      if(!response.ok&&sending)unlock();
      if(match[2]==='draft'&&response.ok)return response.clone().json().then(function(saved){snapshots.set(match[1]+':'+saved.id,saved.snapshot);return response;},function(err){if(sending)unlock();throw err;});
      if(match[2]==='publish'&&response.ok)return response.clone().json().then(function(body){
        var target;try{target=new URL(body.url,location.href);}catch{}
        if(!body||typeof body.url!=='string'||!target||target.origin!==location.origin||!target.pathname.startsWith('/p/'))throw new Error('invalid_publish_response');
        sending=false;frozen=[];return response;
      }).catch(function(err){unlock();throw err;});
      return response;
    },function(err){if(sending)unlock();throw err;});
  };
})();
