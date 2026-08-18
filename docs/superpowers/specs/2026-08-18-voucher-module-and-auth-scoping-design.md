# Voucher module + real photographer-scoping — Design

Date: 2026-08-18
Repos: `C:\projects\picsweep` (BE, NestJS/Prisma), `C:\projects\picsweep-fe` (FE, Angular)

## Problem

Two related asks:

1. **Nav + new Voucher feature.** Hide "Earnings" in the studio nav. Group Pricing
   Bundles/Options/Vouchers under a collapsible "Pricing" sub-nav. Add a new,
   reusable Voucher entity: a photographer defines a discount (flat-rate "all-in"
   price or percent-off) with one or more photo-count *ranges* (e.g. "3-5 photos:
   50% off", "10+ photos: 40% off"). Vouchers are created once and attached to
   any number of pricing bundles via checkbox at bundle-creation time.

2. **Photographer-scoping is broken.** Confirmed while building this: logging in
   as Sam and creating a bundle, then logging in as Alex, still shows Sam's
   bundle. Root cause is two-layered:
   - FE: `auth.service.ts:41` hardcodes `demoPhotographerId = 'alex-rivers'` —
     every pricing-domain HTTP call uses this literal string via an
     `x-photographer-id` header, regardless of who is actually logged in.
   - BE: `current-photographer-id.decorator.ts` trusts that client-supplied
     header outright (its own comment: *"temporary stand-in until real auth is
     wired up"*) — there is no guard verifying the header matches the
     authenticated user at all. Any client can currently read/write any
     photographer's pricing data by sending an arbitrary header value.

   Real Firebase-token-derived auth already exists and works correctly
   elsewhere (`photographer.controller.ts`'s `GET /photographer/profile` uses
   `FirebaseAuthGuard` + `@CurrentUser()`). The fix is to bring pricing-domain
   endpoints onto that same, already-proven path — not to patch the FE's
   hardcoded string in isolation, which would leave the server-side trust gap
   in place.

Both pieces of work touch the same endpoints (pricing-bundles, pricing-options,
and the new vouchers module), so they're being designed and built together.

## Part A — Real photographer scoping

### Backend

`FirebaseAuthGuard` (`src/common/guards/firebase-auth.guard.ts`) currently loads:
```ts
const dbUser = await this.prisma.user.findUnique({
  where: { firebaseId: decoded.uid },
  include: { userPlatforms: true },
});
```
Extend the include to pull the nested profile:
```ts
include: { userPlatforms: { include: { photographerProfile: true } } }
```

Replace `current-photographer-id.decorator.ts`'s header-trusting body with one
that reads `request.dbUser` (populated by `FirebaseAuthGuard`, which must now
run first on every route using this decorator):
```ts
export const currentPhotographerIdFactory = (_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest();
  const dbUser = request.dbUser as (User & { userPlatforms: (UserPlatform & { photographerProfile: PhotographerProfile | null })[] }) | undefined;
  const photographerId = dbUser?.userPlatforms.find((p) => p.role === 'PHOTOGRAPHER')?.photographerProfile?.id;
  if (!photographerId) {
    throw new ForbiddenException('This account has no photographer profile');
  }
  return photographerId;
};
```

`pricing-bundles.controller.ts`, `pricing-options.controller.ts`, and the new
`vouchers.controller.ts` all add `@UseGuards(FirebaseAuthGuard, RolesGuard)` +
`@Roles(UserRole.PHOTOGRAPHER)` at the controller level (mirroring
`photographer.controller.ts`'s existing `getMyProfile`/`updateMyProfile`), so
`@CurrentPhotographerId()` is now guaranteed a verified, guard-derived value —
never client input.

### Frontend

- Delete `demoPhotographerId` from `auth.service.ts`. The authenticated user's
  real photographer id needs to be available after login — reuse the existing
  `GET /photographer/profile` call (already correctly guarded) to populate it
  into `AuthService`'s current-user state at login time, the same place
  `GET /users/current-user` already populates the rest of the session.
- `pricing-options.service.ts` and `pricing-bundles.service.ts` (and the new
  `vouchers.service.ts`) stop taking a `photographerId` parameter and stop
  setting the `x-photographer-id` header by hand — the Bearer token (already
  attached by `auth.interceptor.ts`) is now sufficient, since the BE derives
  scoping itself. Every call site that currently passes
  `this.auth.demoPhotographerId` drops that argument.
- Existing demo data note: bundles/options created under the literal string
  `'alex-rivers'` during earlier manual testing won't be visible to either real
  demo account once this ships (their `photographer_id` doesn't match a real
  profile id). That's expected cleanup, not data to migrate — this is
  pre-launch test data.

## Part B — Voucher module

### Schema

```prisma
enum VoucherDiscountType {
  FLAT_TIER
  PERCENT_TIER

  @@map("voucher_discount_type")
}

model Voucher {
  id             String              @id @default(uuid())
  photographerId String              @map("photographer_id")
  name           String
  discountType   VoucherDiscountType @map("discount_type")
  conditions     Json                @map("conditions") // VoucherCondition[]: {minPhotos, maxPhotos: number|null, value}[]
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  bundles BundleVoucher[]

  @@index([photographerId], map: "idx_vouchers_photographer")
  @@map("vouchers")
}

model BundleVoucher {
  pricingBundleId String @map("pricing_bundle_id")
  voucherId       String @map("voucher_id")

  pricingBundle PricingBundle @relation(fields: [pricingBundleId], references: [id], onDelete: Cascade)
  voucher       Voucher       @relation(fields: [voucherId], references: [id], onDelete: Restrict)

  @@id([pricingBundleId, voucherId])
  @@map("bundle_vouchers")
}
```

`PricingBundle` drops `bundleModel` and `bundleTiers`; gains `vouchers
BundleVoucher[]`. `BundleModel` is only referenced inside the pricing-bundles
module being rewritten here, so it becomes fully unused — rename it in place
to `VoucherDiscountType` (dropping the `NONE` variant, which doesn't apply to
a standalone voucher that always has an actual discount) rather than define a
second, parallel enum.

`onDelete: Restrict` on the voucher side of `BundleVoucher` means Postgres
itself blocks deleting a voucher that's still attached — same integrity
pattern as `EventPricingBundle`'s existing guard. The service layer still does
its own pre-check (mirroring `PricingBundlesService.remove()`) so the API
returns a clean `409 Conflict` with a "used by N bundle(s)" message instead of
surfacing a raw DB constraint error.

### Backend module (`src/vouchers/`)

Mirrors `src/pricing-bundles/` file-for-file: `vouchers.controller.ts`,
`.service.ts`, `.repository.ts`, `.dto.ts`, `.module.ts`.

- `GET /vouchers` — list photographer's vouchers (each with a computed
  `bundlesUsingCount`, same shape as bundles' `eventsUsingCount`)
- `GET /vouchers/:id`
- `POST /vouchers` — `{name, discountType, conditions: {minPhotos, maxPhotos, value}[]}`
- `PATCH /vouchers/:id`
- `DELETE /vouchers/:id` — `409` if `bundlesUsingCount > 0`

`pricing-bundles.dto.ts`'s create/update payloads gain `voucherIds: string[]`.
`pricing-bundles.repository.ts`'s create/update methods sync `BundleVoucher`
rows inside the existing transaction: diff current attached ids vs. requested,
delete the removed, create the added (`createMany`/`deleteMany`, same shape as
how event↔bundle linking already works). `PricingBundleResponseDto` returns
`vouchers: VoucherSummaryDto[]` instead of `bundleModel`/`bundleTiers`.

### Frontend

- New `studio/vouchers/` module mirroring `studio/pricing-bundles/`:
  `vouchers-list` + `voucher-form` components, `vouchers.service.ts` (same
  async-HTTP-with-signal-cache pattern as `pricing-bundles.service.ts`).
- Voucher form: name, a flat/percent toggle (reusing the existing toggle UI
  pattern from today's bundle form), and a repeatable condition-row list (min
  photos, max photos — blank means "and up" — and the discount value).
- Bundle form (`pricing-bundle-form.component.*`): remove the current
  bundleModel/bundleTiers editing UI; replace with a checkbox list fetched
  from `VouchersService`, writing `voucherIds: string[]` onto the draft.
- `pricing.util.ts`: `IEventPricing` swaps `bundleModel`/`bundleTiers` for
  `vouchers: IVoucher[]`. `bestQualifyingTier`/`qualifyingTiers` are rewritten
  to flatten every attached voucher's conditions, match `minPhotos ≤ count ≤
  (maxPhotos ?? Infinity)` (at most one condition per voucher, possibly zero),
  and — across all matching conditions from all attached vouchers — keep the
  existing "pick whichever gives the lowest total" reconciliation.
- `selection.service.ts`: `VoucherOffer` becomes `{voucher, condition}` (bundle
  grouping is no longer the organizing concept — vouchers are shared across
  bundles). `order-summary.component.html`'s voucher-row label changes from
  "{{bundle.name}}: {{tier.minQuantity}}+ photos" to
  "{{voucher.name}}: {{condition.minPhotos}}-{{condition.maxPhotos}} photos" or
  "...{{condition.minPhotos}}+ photos" when `maxPhotos` is null. The
  percent-vs-flat display split built earlier this session
  (`% off each` vs `RM.../photo`) carries over unchanged, keyed off
  `voucher.discountType` instead of `bundle.bundleModel`.

### Nav (bounded)

`studio-shell.component.html`: remove the "Earnings" link. Wrap
Bundles/Options/Vouchers in a collapsible "Pricing" group (a `signal<boolean>`
for expanded/collapsed, auto-expanded via `routerLinkActive` when the current
route is one of the three children).

## Testing

- BE: unit tests for `VouchersService`/`.repository.ts` (mirroring
  `pricing-bundles.service.spec.ts`), plus a scoping-guard test proving a
  request with a forged/mismatched identity can't read another photographer's
  bundles/options/vouchers — this directly covers the bug that motivated Part A.
- FE: `vouchers.service.spec.ts` (HTTP-mocked, mirrors
  `pricing-bundles.service.spec.ts`), `pricing.util.spec.ts` additions for
  range-matching edge cases (gap between ranges, unbounded top range,
  multiple vouchers on one bundle).
- Manual E2E: log in as Sam, create a voucher + bundle; log in as Alex, confirm
  neither is visible; log back in as Sam, confirm they are.
