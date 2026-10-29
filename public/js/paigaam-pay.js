'use strict';
/** Shared Razorpay checkout. Coupon review runs on the payment action, never on browsing pages. */
(function () {
  var SDK='https://checkout.razorpay.com/v1/checkout.js',sdkLoading=null;
  function loadSdk(){if(window.Razorpay)return Promise.resolve();if(sdkLoading)return sdkLoading;sdkLoading=new Promise(function(resolve,reject){var s=document.createElement('script');s.src=SDK;s.async=true;s.onload=resolve;s.onerror=function(){sdkLoading=null;reject({code:'sdk'});};document.head.appendChild(s);});return sdkLoading;}
  function paigaamId(){var btn=document.querySelector('[data-paigaam-id]');return (btn&&btn.getAttribute('data-paigaam-id'))||(document.body&&document.body.getAttribute('data-paigaam-id'))||'';}
  function fetchOrder(endpoint,id,opts){
    if(!id)return Promise.reject({code:'not_found'});
    return fetch(endpoint||'/api/razorpay/order',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({id:id,prefillName:opts.prefillName||''})})
      .then(function(r){return r.json().catch(function(){return{};}).then(function(body){if(!r.ok)throw {code:body.error||'request_failed',message:body.message||'',status:r.status};return body;});});
  }
  function start(order,opts){
    if(order.alreadyPaid)return Promise.resolve({url:order.url,alreadyPaid:true});
    return loadSdk().then(function(){return new Promise(function(resolve,reject){var rzp=new window.Razorpay({key:order.keyId,order_id:order.orderId,name:order.name||'Paigaam',description:order.description||'Your Paigaam',theme:{color:'#8F1018'},prefill:{name:opts.prefillName||order.prefillName||''},handler:function(response){fetch('/api/razorpay/verify',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(response)}).then(function(r){return r.json().then(function(value){if(!r.ok)throw {code:value.error||'verify_failed',message:value.message||''};return value;});}).then(function(result){if(result&&result.url)return resolve({url:result.url});reject({code:'verify_failed'});}).catch(function(error){reject(error.code?error:{code:'network'});});},modal:{ondismiss:function(){reject({code:'dismissed'});}}});rzp.open();});});
  }
  function open(opts){
    opts=opts||{};var existing=opts.order||null;if(existing&&existing.alreadyPaid)return Promise.resolve({url:existing.url,alreadyPaid:true});
    var id=opts.id||paigaamId();
    var context={order:existing,id:id,product_type:opts.productType||(/\/api\/magazines\//.test(opts.orderEndpoint||'')?'magazine':'paigaam'),orderEndpoint:opts.orderEndpoint};
    var choose=window.PaigaamCouponFlow?window.PaigaamCouponFlow.open(context):Promise.resolve({continue:true,skip:true});
    return Promise.resolve(choose).then(function(choice){
      if(!choice||choice.continue===false)throw {code:'dismissed'};
      if(choice.alreadyPaid)return {url:choice.url,alreadyPaid:true};
      var finalId=id||choice.product_id;
      if(existing&&choice.quote&&choice.quote.reuse_existing_order===true&&Number(existing.amount)===Number(choice.quote.amount_paise)&&String(existing.currency||'INR')===String(choice.quote.currency))return existing;
      if(existing&&(!choice.quote||choice.skip))return existing;
      return fetchOrder(opts.orderEndpoint,finalId,opts);
    }).then(function(order){return start(order,opts);});
  }
  window.PaigaamPay={open:open,paigaamId:paigaamId,errorMessage:function(error){return window.PaigaamCouponError?window.PaigaamCouponError(error):'';}};
})();
