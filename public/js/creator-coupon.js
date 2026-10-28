'use strict';
/** A small purchase-only coupon tray; never inserted into the recipient's invitation. */
(function () {
  // Only these checkout codes are safe to turn into coupon guidance. Never
  // display arbitrary backend messages (or mask unrelated checkout failures).
  window.PaigaamCouponError = function (error) {
    var code = typeof error === 'string' ? error : error && (error.code || error.error || error.message);
    if (code === 'coupon_minimum') return 'This order does not meet the coupon minimum spend. Remove the coupon or choose another coupon or an eligible template, then try again.';
    if (code === 'invalid_coupon') return 'This coupon is invalid, disabled or expired. Remove it or choose another coupon, then try again.';
    if (code === 'unsupported_currency') return 'Creator coupons apply to INR purchases only. Remove the coupon to continue with this currency.';
    return '';
  };
  var p = location.pathname;
  if (!(/^\/(create|preview)\//.test(p) || /^\/magazines\/(?!m\/)[a-z0-9-]+$/.test(p) || /^\/magazines\/m\//.test(p))) return;
  if (/^\/magazines\/m\//.test(p) && !document.getElementById('magPay')) return;
  if (document.getElementById('partner-coupon')) return;
  var box = document.createElement('details'); box.id='partner-coupon'; box.className='partner-coupon';
  box.innerHTML='<summary>Have a creator coupon?</summary><div class="partner-coupon__body"><label for="partner-coupon-code">Creator coupon</label><div class="partner-coupon__row"><input id="partner-coupon-code" maxlength="32" autocomplete="off" autocapitalize="characters" placeholder="Enter code"><button type="button" id="partner-coupon-apply">Apply</button></div><button type="button" id="partner-coupon-clear" hidden>Remove coupon</button><p role="status" aria-live="polite" id="partner-coupon-status">Checking coupon…</p><small>One code per checkout. Discount applies before payment; the final total appears in the payment window. <a href="/privacy" target="_blank" rel="noopener noreferrer">Referral privacy</a></small></div>';
  document.body.appendChild(box);
  var input=box.querySelector('input'), apply=box.querySelector('#partner-coupon-apply'), clear=box.querySelector('#partner-coupon-clear'), status=box.querySelector('#partner-coupon-status'), csrf='';
  apply.disabled=true;
  function money(paise) {return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(paise || 0)/100);}
  function discountText(data) {
    var text=data.discount_type==='flat' ? 'Up to '+money(data.discount_flat_paise)+' off' : (data.discount_bps/100)+'% off';
    if(data.discount_type!=='flat' && data.discount_max_paise)text+=' (maximum '+money(data.discount_max_paise)+')';
    if(data.discount_min_paise)text+=' · minimum order '+money(data.discount_min_paise);
    if(data.coupon_expires_at)text+=' · ends '+new Date(data.coupon_expires_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST';
    return text+' · Minimum payable ₹1.';
  }
  function paint(data) {
    csrf=data.csrf || csrf; input.value=data.code || ''; clear.hidden=!data.code;
    status.textContent=data.code ? (data.valid ? data.code+' applied · '+discountText(data) : 'This coupon is no longer active. Remove it or use another before paying.') : 'Enter your creator’s coupon for a discount.';
    if (data.code && !data.valid) box.open=true;
  }
  function change(code) {
    apply.disabled=true;clear.disabled=true; status.textContent='Saving coupon…';
    return fetch('/api/creator-coupon',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code,csrf:csrf})}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error==='invalid_coupon'?'That coupon is invalid or inactive.':'Could not save. Reload and try again.');return d;});}).then(paint).catch(function(e){status.textContent=e.message;}).finally(function(){apply.disabled=false;clear.disabled=false;});
  }
  apply.addEventListener('click',function(){change(input.value.trim());});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();apply.click();}});
  clear.addEventListener('click',function(){change('');});
  fetch('/api/creator-coupon',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(data){paint(data);apply.disabled=false;}).catch(function(){status.textContent='Coupon service unavailable. Reload to try again.';});
})();
