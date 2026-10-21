# Paigaam Magazines (Canva Autofill)

Readers pick a design, fill in the fields, upload photos, and Paigaam builds a personalised magazine through
**Canva Connect REST (Autofill + Exports)**. They preview it on Paigaam and download a PDF (PNG too, for single-page designs).
Readers never need a Canva account. One Paigaam-owned Canva Pro account owns the master Brand Templates and all generated designs.
The feature is isolated from greeting templates and publishing. **Pricing uses the same Razorpay rail as greeting templates**
(see *Payments* below): each design can be free (₹0, the default) or priced, and priced magazines generate only after payment settles.
Multi-page templates also get a fictional Canva Autofill sample so readers can flip through the actual layout before choosing it.

Changelog:
- 20 Oct 2026 — paywall shipped (PR #45): per-design pricing in admin, Razorpay checkout before generation, mark-paid settlement.
- 21 Oct 2026 — deployed after the Railway deploy pause lifted.
