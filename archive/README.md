# archive

PariBelle is a single store. The multi-vendor marketplace features (vendor
accounts, commissions and payouts, referrals, locations, bookings, the
platform/KYC flows) were removed in October 2026. Their code, plus the old
setup docs, one-off scripts and seeds, was moved here instead of deleted so
it can still be read or restored from one place.

- **Paths mirror the originals.** `archive/src/modules/vendors/...` was
  `src/modules/vendors/...`; `archive/RAZORPAY_SETUP.md` was at the repo root.
  `git log --follow` on a file here shows its full history.
- **Rewritten services keep their old copy here** (orders, products,
  invoices, reviews, homepage, hsn-codes) for reference. The live versions
  are under `src/`.
- **Nothing here is built, linted or deployed.** `archive` is excluded in
  `tsconfig.json` and `.dockerignore`, and nothing under `src/` imports from
  it. Files here may no longer compile against the current entities.

The store's own record is the single `vendors` row with id `STORE_ID`
(`src/modules/store/store.constants.ts`); see `src/modules/store`.
