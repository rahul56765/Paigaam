'use strict';
(function () {
  window.PaigaamCouponError = function (error) {
    var code = typeof error === 'string' ? error : error && (error.code || error.error || error.message);
    if (code === 'coupon_minimum') return 'This order does not meet the coupon minimum spend. Remove the coupon or choose another coupon or an eligible template, then try again.';
    if (code === 'invalid_coupon') return 'This coupon is invalid, disabled or expired. Remove it or choose another coupon, then try again.';
    if (code === 'unsupported_currency') return 'Coupon codes apply to INR purchases only. Remove the coupon to continue with this currency.';
    return '';
  };
  var money = function (paise, currency) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:2}).format(Number(paise||0)/100); };
  function esc(value){return String(value||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function api(url,method,data){return fetch(url,{method:method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(data):undefined}).then(function(r){return r.json().catch(function(){return{};}).then(function(b){if(!r.ok)throw{code:b.error||'request_failed',status:r.status};return b;});});}
  function priceMarkup(q){return '<dl class="pc-checkout-totals"><div><dt>Subtotal</dt><dd>'+money(q.gross_paise,q.currency)+'</dd></div><div><dt>Discount</dt><dd>'+(Number(q.discount_paise)?'−'+money(q.discount_paise,q.currency):money(0,q.currency))+'</dd></div>'+(q.coupon_code?'<div class="pc-checkout-applied"><dt>Applied code</dt><dd><strong>'+esc(q.coupon_code)+'</strong></dd></div>':'')+'<div class="pc-checkout-total" id="pc-checkout-total"><dt>Total to pay</dt><dd>'+money(q.amount_paise,q.currency)+'</dd></div></dl>';}
  function open(ctx){
    ctx=ctx||{};
    var initialOrder=ctx.order||{}, gatewayId=initialOrder.orderId||ctx.gateway_order_id||'';
    var productId=ctx.product_id||ctx.id||(window.PaigaamPay&&window.PaigaamPay.paigaamId&&window.PaigaamPay.paigaamId())||'';
    var productType=ctx.product_type||(/\/api\/magazines\//.test(ctx.orderEndpoint||'')?'magazine':'paigaam');
    if(!gatewayId&&!productId)return Promise.resolve({continue:true,skip:true});
    var quoteParams={gateway_order_id:gatewayId,product_id:productId,product_type:productType};
    var state={code:'',offer:null,quote:null,blocked:false,csrf:'',notice:'',result:null,resolved:false};
    var dialog=document.createElement('dialog');dialog.className='pc-checkout-dialog';dialog.setAttribute('aria-labelledby','pc-checkout-title');
    dialog.innerHTML='<form method="dialog" class="pc-checkout-sheet"><header><p class="pc-eyebrow">SECURE CHECKOUT · RAZORPAY</p><h2 id="pc-checkout-title">Review your price.</h2><p class="pc-checkout-lede">Your invitation stays private. Nothing is charged until you finish with Razorpay.</p></header><div id="pc-checkout-price" role="status" aria-live="polite"><p>Checking your price…</p></div><details class="pc-checkout-code" id="pc-checkout-code"><summary>Have a coupon code?</summary><div class="pc-checkout-code__body"><label for="pc-checkout-input">Coupon code</label><div class="pc-checkout-code__row"><input id="pc-checkout-input" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter your code"><button id="pc-checkout-apply" class="pc-button" type="button">Apply</button></div><button id="pc-checkout-remove" class="pc-text-link" type="button" hidden>Remove code</button><p id="pc-checkout-status" role="status" aria-live="polite"></p></div></details><p class="pc-checkout-safety">One coupon per order. A creator referral may still earn commission. The final amount is confirmed in Razorpay; applying a coupon does not charge you.</p><footer><button class="pc-button" id="pc-checkout-cancel" type="button">Cancel</button><button class="pc-button pc-button--primary" id="pc-checkout-continue" type="button" disabled>Continue to payment</button></footer></form>';
    document.body.appendChild(dialog);
    var priceBox=dialog.querySelector('#pc-checkout-price'),codePanel=dialog.querySelector('#pc-checkout-code'),input=dialog.querySelector('#pc-checkout-input'),apply=dialog.querySelector('#pc-checkout-apply'),remove=dialog.querySelector('#pc-checkout-remove'),status=dialog.querySelector('#pc-checkout-status'),go=dialog.querySelector('#pc-checkout-continue');
    var oldOverflow=document.body.style.overflow;
    function finish(result){if(state.resolved)return;state.resolved=true;state.result=result;if(dialog.open)dialog.close();else cleanup();}
    function cleanup(){if(dialog.isConnected)dialog.remove();document.body.style.overflow=oldOverflow;if(ctx.trigger&&ctx.trigger.focus)ctx.trigger.focus();}
    return new Promise(function(resolve,reject){
      dialog.addEventListener('close',function(){cleanup();resolve(state.result||{continue:false});},{once:true});
      function setQuote(q){if(q.alreadyPaid){finish({continue:true,alreadyPaid:true,url:q.url||''});return;}state.quote=q;state.blocked=false;priceBox.innerHTML=priceMarkup(q);go.disabled=false;go.textContent='Pay '+money(q.amount_paise,q.currency)+' with Razorpay';if(q.coupon_code){status.textContent=(q.coupon_label||'Coupon')+' applied.';remove.hidden=false;codePanel.open=true;}else if(state.notice)status.textContent=window.PaigaamCouponError(state.notice);else if(!state.code)status.textContent='';}
      function quote(code,ignoreSaved){return api('/api/creator-coupon/quote','POST',{csrf:state.csrf,...quoteParams,code:code||'',ignore_saved_coupon:ignoreSaved===true});}
      function removeCode(message){return api('/api/creator-coupon','POST',{csrf:state.csrf,code:''}).then(function(r){state.code='';state.offer=r;state.notice='';input.value='';remove.hidden=true;return quote('').then(function(q){setQuote(q);status.textContent=message||'Coupon removed.';});});}
      function handleCouponError(e){var message=window.PaigaamCouponError(e)||'That code could not be applied. Try another code or remove it.';state.blocked=true;go.disabled=true;remove.hidden=false;status.textContent=message;if(e.code==='coupon_minimum'){quote('',true).then(function(q){priceBox.innerHTML=priceMarkup(q);}).catch(function(){});} }
      dialog.querySelector('#pc-checkout-cancel').addEventListener('click',function(){finish({continue:false});});
      dialog.addEventListener('cancel',function(e){e.preventDefault();finish({continue:false});});
      apply.addEventListener('click',function(){var code=input.value.trim().toUpperCase();apply.disabled=true;go.disabled=true;state.blocked=true;status.textContent='Checking coupon…';api('/api/creator-coupon','POST',{csrf:state.csrf,code:code}).then(function(r){state.code=r.code;state.offer=r;state.notice='';input.value=r.code;remove.hidden=!r.code;return quote(r.code);}).then(function(q){setQuote(q);}).catch(handleCouponError).finally(function(){apply.disabled=false;});});
      input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();apply.click();}});
      remove.addEventListener('click',function(){remove.disabled=true;apply.disabled=true;go.disabled=true;status.textContent='Removing coupon…';removeCode('').catch(handleCouponError).finally(function(){remove.disabled=false;apply.disabled=false;});});
      go.addEventListener('click',function(){if(go.disabled||state.blocked||!state.quote)return;finish({continue:true,quote:state.quote,product_id:productId,product_type:productType,gateway_order_id:gatewayId,code:state.code});});
      try{dialog.showModal();document.body.style.overflow='hidden';}catch(e){cleanup();reject({code:'coupon_dialog_unavailable'});return;}
      api('/api/creator-coupon','GET').then(function(r){state.csrf=r.csrf;state.code=r.code||'';state.offer=r;state.notice=r.notice||'';input.value=state.code;if(state.code)codePanel.open=true;remove.hidden=!state.code;if(!r.valid){state.blocked=true;status.textContent='That saved coupon has expired or is disabled. Remove it or choose another before paying.';go.disabled=true;return quote('').then(function(q){priceBox.innerHTML=priceMarkup(q);});}return quote(state.code).then(setQuote).catch(function(e){handleCouponError(e);});}).catch(function(e){status.textContent=window.PaigaamCouponError(e)||'Price check unavailable. Close and try again.';go.disabled=true;});
    });
  }
  var inlineState=null;
  function mountInline(ctx){
    ctx=ctx||{};
    var panel=document.getElementById('pc-inline-checkout'),button=document.getElementById('payPublish');
    if(!panel||!button)return null;
    var input=panel.querySelector('#pc-inline-input'),apply=panel.querySelector('#pc-inline-apply'),remove=panel.querySelector('#pc-inline-remove'),status=panel.querySelector('#pc-inline-status'),priceBox=panel.querySelector('#pc-inline-price');
    var productId=ctx.product_id||button.getAttribute('data-paigaam-id')||(window.PaigaamPay&&window.PaigaamPay.paigaamId&&window.PaigaamPay.paigaamId())||'';
    var state={code:'',quote:null,csrf:'',blocked:true,loading:true};
    function setQuote(q){if(q.alreadyPaid){state.quote=q;return;}state.quote=q;state.blocked=false;state.loading=false;priceBox.innerHTML=priceMarkup(q);button.disabled=false;button.textContent='Pay '+money(q.amount_paise,q.currency)+' with Razorpay & publish';if(q.coupon_code){status.textContent=(q.coupon_label||'Coupon')+' applied.';remove.hidden=false;}else if(!state.code){status.textContent='No coupon applied. You can continue securely to Razorpay.';remove.hidden=true;}}
    function quote(code,ignoreSaved){return api('/api/creator-coupon/quote','POST',{csrf:state.csrf,product_id:productId,product_type:'paigaam',code:code||'',ignore_saved_coupon:ignoreSaved===true});}
    function clearCoupon(message){return api('/api/creator-coupon','POST',{csrf:state.csrf,code:''}).then(function(){state.code='';input.value='';remove.hidden=true;return quote('').then(function(q){setQuote(q);status.textContent=message||'Coupon removed. You can continue at the amount shown.';});});}
    function applyCoupon(){var code=input.value.trim().toUpperCase();if(!code){status.textContent='Enter a coupon code, or continue without one.';return;}apply.disabled=true;button.disabled=true;state.blocked=true;state.loading=true;status.textContent='Checking coupon…';api('/api/creator-coupon','POST',{csrf:state.csrf,code:code}).then(function(r){state.code=r.code;input.value=r.code;return quote(r.code);}).then(setQuote).catch(function(e){state.blocked=true;state.loading=false;remove.hidden=false;status.textContent=window.PaigaamCouponError(e)||'That coupon could not be applied. Remove it or try another code.';if(e.code==='coupon_minimum')quote('',true).then(function(q){priceBox.innerHTML=priceMarkup(q);state.quote=q;}).catch(function(){});}).finally(function(){apply.disabled=false;button.disabled=state.blocked||!state.quote;});}
    apply.addEventListener('click',applyCoupon);input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();applyCoupon();}});
    remove.addEventListener('click',function(){remove.disabled=true;apply.disabled=true;button.disabled=true;status.textContent='Removing coupon…';clearCoupon().catch(function(e){status.textContent=window.PaigaamCouponError(e)||'Could not remove that coupon. Please try again.';}).finally(function(){remove.disabled=false;apply.disabled=false;button.disabled=state.blocked||!state.quote;});});
    function restoreButton(){button.disabled=state.blocked||!state.quote;button.textContent=state.quote?'Pay '+money(state.quote.amount_paise,state.quote.currency)+' with Razorpay & publish':'Continue to checkout';}
    api('/api/creator-coupon','GET').then(function(r){state.csrf=r.csrf;state.code=r.code||'';input.value=state.code;remove.hidden=!state.code;if(!r.valid&&state.code){state.blocked=true;status.textContent='That saved coupon has expired or is disabled. Remove it to continue.';return quote('',true).then(function(q){state.quote=q;state.loading=false;priceBox.innerHTML=priceMarkup(q);button.disabled=true;});}return quote(state.code).then(setQuote).catch(function(e){state.blocked=true;state.loading=false;button.disabled=true;status.textContent=window.PaigaamCouponError(e)||'We could not confirm your price. Please refresh and try again.';});}).catch(function(e){state.blocked=true;state.loading=false;button.disabled=true;status.textContent=window.PaigaamCouponError(e)||'We could not confirm your price. Please refresh and try again.';});
    inlineState={confirm:function(){if(state.blocked||state.loading||!state.quote)return Promise.reject({code:'price_unavailable'});return Promise.resolve({continue:true,quote:state.quote,product_id:productId,product_type:'paigaam',code:state.code});},restoreButton:restoreButton};
    return inlineState;
  }
  function confirmInline(){if(!inlineState)return Promise.reject({code:'price_unavailable'});return inlineState.confirm();}
  function restoreInlineButton(){if(inlineState)inlineState.restoreButton();}
  if(typeof document!=='undefined'&&document.getElementById){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){mountInline({});},{once:true});else mountInline({});}
  window.PaigaamCouponFlow={open:open,confirmInline:confirmInline,restoreInlineButton:restoreInlineButton};
})();
