# Creator partners, coupons and commission accounting

Status: review implementation, 28 October 2026. Additive SQLite migrations, no production accounts or transfers created by development. Do not deploy without owner approval and the rollout checks below.

## Product

- Admin navigation → Creators (/admin/creators): create an individual username/password, display name, commission percentage, unique coupon and audience discount; edit/reset/disable; inspect conversions and record completed manual transfers.
- Separate partner sign-in /creator/login; dashboard /creator; searchable sharing catalogue /creator/templates. Published greeting templates and magazines only, never draft templates. Mobile-responsive SSR, no customer account required.
- Creator sees current coupon/rate, lifetime visits, unique browsers, attributed paid orders, charged revenue, refunds, gross/net commission, payout history and outstanding balance; 7/30/90-day activity, template breakdown and anonymized order references. No customer names, contact details, invitation URLs/content, password hashes or internal payout notes.
- Copy/WhatsApp links use /r/username?to=/templates/slug (or /magazines/slug). WhatsApp is only a share draft; site never sends a message.
- Purchase pages have a collapsible creator-coupon tray. Apply/remove before Pay & publish. Razorpay displays the final charged amount. Recipient invitations do not get the tray. Coupons persist for up to 30 days in the same browser, until removed/replaced.
- Admin payout form only records money already transferred elsewhere. It does NOT initiate a bank transfer, collect bank credentials, or verify bank receipt. Reference is visible to the partner; internal note is not rendered to them.

## Business defaults to approve

1. Last active creator link, 30 days, same browser. Opaque random referral token, server-side expiry. A valid explicit creator coupon wins over the link, even if from another creator. No stacked coupons. Referral alone earns credit but does not automatically discount.
2. Commission = ROUND(actual captured amount after coupon × commission percentage), integer paise and half-up rounding. No gateway-fee deduction. Example: ₹49 price, 10% discount → ₹44.10 captured; 20% share → ₹8.82 commission. Tax is not separately broken out by the current checkout; this uses its full captured amount.
3. Commission 0–100%; discount 0–90%; paid gateway amount must remain at least ₹1. Rates/coupon/discount/charged amount snapshotted when gateway order is created. Later admin changes do not rewrite it. Disabling stops new attribution and login, not previously captured/reserved financial history.
4. Only INR purchases participate. Non-INR checkout remains unchanged without a coupon; an explicit creator coupon on non-INR fails rather than silently charging a different amount. Free publishing, legacy WhatsApp/manual mark-paid, and non-selling wedding-video renders do not generate commission.
5. One commission per purchased product, not per payment callback or retry. Extra successful duplicate product payments remain recorded without a second commission and should be reconciled with the customer.
6. Refund commission reversals use cumulative refunded proportion, rounded against original commission; full refund reverses it exactly. If payout already happened, balance may become negative. No further payout can exceed positive outstanding balance.
7. No minimum payout threshold or automated payout schedule in this version. Admin can record partial/full positive payouts within earned outstanding balance. References/idempotency keys and immutable audit records prevent form replays from doubling payouts. Entries cannot be edited/deleted through this feature; erroneous financial records require a deliberate audited correction workflow, not database editing.
8. Counts are visits, browser visitors and paid orders, NOT identified physical people. Known crawlers, HEAD and prefetch are excluded but clicks are not fraud-proof. Coupon-only buyers can convert with no tracked click; conversion rates can therefore exceed 100%. Daily buckets use UTC, dates displayed in IST, totals are lifetime.

## Payment integration

Every existing greeting checkout calls lib/razorpay.createOrder → createOrderFor; magazines call createOrderFor with product metadata. A request-scoped AsyncLocalStorage context passes attribution without global mutable buyer state. Requests without creator cookies retain original prices and zero credit. Unknown future payment rails must provide paigaam_id/template or magazine_order_id/magazine metadata before participating.

Gateway order creation computes discount on the server, checks the gateway amount/currency, then stores an immutable partner_orders snapshot before returning checkout. Existing orders and magazine_payments still use rupees for compatibility; decimals are preserved instead of integer-truncated. Partner financial tables use integer paise exclusively. All template order responses return the actual gateway amount.

POST /api/razorpay/verify first validates HMAC and then GETs /v1/payments/:id from Razorpay, requiring captured status, exact order id, payment id, amount and currency. An authorized-only payment is not enough. POST /api/razorpay/webhook verifies raw-body HMAC; captured entity must match the same snapshot/legacy amount. Replays settle once.

Subscribe the existing Razorpay webhook to payment.captured, order.paid AND refund.processed. RAZORPAY_WEBHOOK_SECRET must be configured for refunds and tab-close reliability. Never expose it or any live API key to the browser. refund.processed must contain a processed refund id/payment id/positive integer amount. Pre-capture refunds are persisted and applied at capture. Unmatched refunds appear in Admin → Creators for reconciliation.

Creator accounting is settled independently of delivery so an interrupted legacy insert or deleted product does not lose a captured commission. partner_fulfillment records pending deliveries and marks complete when the existing publish/generation handoff succeeds. Missing fulfillment returns 503 to the webhook (rather than falsely acknowledging success), permitting retry after repair; Admin → Creators highlights pending references. A process crash between gateway order creation and snapshot insert is an existing external-transaction boundary: the client receives no checkout success, but investigate any captured payment with no local snapshot. No new background polling service is introduced.

## Security and privacy

- Separate pg_partner_session, not paigaam_creator (existing customer ownership cookie). Random 256-bit tokens stored hashed, 7-day expiry. Password scrypt with independent random salt, 12–256 characters; no plaintext persistence or recovery. Reset and disable revoke all sessions.
- HttpOnly, SameSite=Lax; Secure when BASE_URL is HTTPS. Set BASE_URL to canonical https://paigaam.cc in production. Session-bound CSRF for all console mutations, signed double-submit login CSRF, admin CSRF bound to existing admin session, origin rejection and small form bodies. Login throttles 8 attempts per IP/username and 30/IP per 15 minutes with bounded memory.
- CREATOR_TRUST_PROXY=1 is OPTIONAL and must only be set if Railway's proxy is confirmed to overwrite X-Forwarded-For. Default ignores forwarded IP headers; behind a shared proxy this may group several users under one rate-limit bucket. Do not blindly enable for arbitrary upstreams. Rate limits/signing secret are per-process; current production has one replica. This feature does not turn local SQLite into multi-replica-safe storage.
- Creator/admin pages private no-store, Vary: Cookie, noindex, frame-denied CSP. Safe escaping and allowlisted destinations; no open redirects or shared cache of personalized dashboards.
- Referral identifier is random and hashed in click records. No fingerprinting, no referral IP storage, no customer PII in financial snapshots. Referral/coupon cookies disclosed in /privacy; partner rules in /terms. Creator recommendations should be disclosed as compensated.
- No automatic hard deletion of financial records. Referral sessions are pruned on use and creator sessions at login; establish an appropriate visit retention/legal accounting policy before large-scale rollout.

## Files

lib/creators/{schema,store,tracking,routes}.js, pages/creators.js, public/{css,js}/creators.*, public/{css,js}/creator-coupon.*. Router/payment hooks in server.js and lib/razorpay.js; scoped amount changes in existing greeting rails/magazine payments. Admin navigation and public legal copy updated. wedding-video scene/render code unchanged.

## Tests

npm run test:creators covers store, portal routes, referrals/coupons, mocked gateway creation/capture/webhooks, request concurrency, rounding, password/session/CSRF isolation, partial/pre-capture refunds, payout replays/overpayment, orphan delivery and human-percentage forms. node scripts/test-razorpay.js and node scripts/test-pricing-resume.js use deterministic HTTPS preloads in child test servers, never real payments. Existing Shaadi/Suvarna/admin suites remain regression gates.

Validation update (28 October 2026, after registry access approval): npm ci --ignore-scripts installed exact lockfile dependencies, Chromium installed, and node scripts/prepare-magazine-face.js prepared the MediaPipe assets. Full npm test now PASSES with exit 0, including the existing Ganapati browser/API checks and all 14 magazine HTTP E2E groups. Creator unit/HTTP/payment tests pass 48/48.

npm run test:creators:browser runs a real local server with disposable SQLite/admin/creator/buyer sessions, Playwright Chromium, and a test-only fail-closed Razorpay HTTPS/SDK stub. Final run: 31 checks, 44 screenshots at 320/390/430/1440px, zero findings and no unexpected browser errors. It covers actual admin creation/forms/native HTML validity, separate creator login, catalogue/search/clipboard, referral cookies, coupon CSRF/validation, eight-step Noor editor, Pay & publish through real server verification, earnings, manual payout/replay, signed refund/replay, isolation, logout/reset/disable. No response-header workarounds remain. Fonts/external assets are stubbed for deterministic offline QA. This is not a physical-device benchmark or an external Razorpay test-mode integration test; no live accounts/funds were used.

Browser findings fixed: same-origin Referrer-Policy preserves real browser form Origin while suppressing cross-origin console referrers; HTML pattern hyphens escaped for Chromium v-mode; shared QR card made responsive at 320px with a cache-busted stylesheet. Magazine E2E now provides explicit captured-payment fixtures rather than assuming signature alone sufficient.

Existing dependency advisory: npm audit reports one high-severity Sharp/librsvg issue, GHSA-wq5f-xc86-pv6w / CVE-2026-96889, affecting locked sharp 0.35.4; fixed release reported as 0.35.5. This PR deliberately does not alter dependency versions. Address/test that patch separately before production release. Static review screenshots are not proof of an authenticated production walkthrough or a real gateway/bank capture/payout.

## Rollout / owner acceptance

1. Review attribution/payment defaults above; approve the branch before merging. Back up /var/data/paigaam.db with a consistent SQLite backup before release. Keep one replica and persistent DATA_DIR=/var/data.
2. Install locked dependencies, prepare normal build assets, run npm test plus local mobile/browser journey. Ensure no dependency or live template price changes entered the PR.
3. Confirm Razorpay test-mode capture and processed refund delivery, webhook secret and event subscriptions. Check exact discounted amount matches checkout/order/accounting; no real funds needed for test mode.
4. After authorized deployment, verify /healthz persistent storage, admin navigation and /creator/login. Admin creates an intentional first creator with agreed percentages, then logs in from a separate browser and shares a real published template. Do not pre-create marketing identities or default passwords in migrations.
5. Validate click, coupon application/removal and test-mode capture/refund. Record a real completed transfer only after paying outside Paigaam; verify creator receipt record. Feature never claims bank verification.
6. Monitor pending fulfillment/unmatched refunds. If rollback necessary, revert code only; keep additive partner tables/ledger and reconcile any captures/refunds received while old code is running before re-enabling. Do not delete creator or financial tables.

## Changelog

- 2026-10-28 QA follow-up: completed full test suite and unmodified authenticated Chromium journey; corrected form referrer policy, native HTML validation and mobile QR overflow; added reusable browser QA and updated magazine capture fixtures. PR67 remains draft/unmerged/undeployed; external gateway test-mode acceptance and existing Sharp advisory remain release follow-ups.
- 2026-10-28: Initial creator partner accounts, mobile dashboards, published-template/magazine sharing, 30-day referral attribution, creator coupons, captured-payment commissions, refund reversal ledger, manual payout records, admin analytics/reconciliation and security tests. Review-only; deployment requires separate authorization.
