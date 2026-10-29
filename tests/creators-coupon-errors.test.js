'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/js/creator-coupon.js'), 'utf8');
function helper(pathname = '/p/recipient') {
  const context = { window: {}, location: { pathname } };
  vm.runInNewContext(source, context);
  return context.window.PaigaamCouponError;
}
test('coupon helper is installed before purchase-only DOM guards, including recipient and magazine routes', () => {
  for (const pathname of ['/p/recipient', '/', '/magazines']) assert.equal(typeof helper(pathname), 'function');
});
test('allowlisted coupon codes accept checkout objects, API payloads and Error messages', () => {
  const message = helper();
  for (const code of ['coupon_minimum', 'invalid_coupon', 'unsupported_currency']) {
    const expected = message(code);
    assert.ok(expected);
    for (const error of [{ code }, { error: code }, new Error(code), { code, message: '<script>untrusted</script>' }]) assert.equal(message(error), expected);
    assert.match(expected, /[Rr]emove/);
    assert.doesNotMatch(expected, /<script>/);
  }
  assert.match(message('coupon_minimum'), /minimum spend/);
  assert.match(message('coupon_minimum'), /choose another coupon/);
  assert.match(message('invalid_coupon'), /invalid, disabled or expired/);
  assert.match(message('unsupported_currency'), /INR/);
});
test('unrelated errors return empty string so existing caller fallback is preserved', () => {
  const message = helper();
  for (const error of [null, undefined, {}, 400, 'gateway_unreachable', 'dismissed', 'payments_offline', 'request_failed', 'toString', '__proto__', new Error('network'), { code: 'gateway_unreachable', message: 'coupon_minimum' }, { error: '<img src=x onerror=alert(1)>' }]) assert.equal(message(error), '');
});
test('PaigaamPay.errorMessage safely delegates when helper is present or absent', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/js/paigaam-pay.js'), 'utf8'), context);
  assert.equal(context.window.PaigaamPay.errorMessage({ code: 'coupon_minimum' }), '');
  context.window.PaigaamCouponError = helper();
  assert.match(context.window.PaigaamPay.errorMessage({ code: 'coupon_minimum' }), /minimum spend/);
  assert.equal(context.window.PaigaamPay.errorMessage({ code: 'network' }), '');
});
test('shared purchase head and standalone Ganapati head load the coupon helper', () => {
  for (const filename of ['lib/layout.js', 'pages/ganapatiCreate.js']) assert.match(fs.readFileSync(path.join(root, filename), 'utf8'), /<script src="\/js\/creator-coupon\.js\?v=5" defer><\/script>/);
});
