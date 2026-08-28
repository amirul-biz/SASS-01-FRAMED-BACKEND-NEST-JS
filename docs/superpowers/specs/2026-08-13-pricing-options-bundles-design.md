# Pricing Options & Pricing Bundles — Design Spec

## Context

Framed is a freelance photography/image platform (event photo delivery — riders browse an event's photo gallery and buy the ones they want). Two admin screens exist in the FE (`picsweep-fe`) with no backend behind them yet:

- **Pricing Options** — per-photo delivery formats a photographer offers (e.g. 30MP JPEG, RAW), each with its own price. This is the source-of-truth price for a single photo.
- **Pricing Bundles** — reusable bulk-purchase presets a photographer defines once and attaches to any number of events (e.g. "5+ photos for RM30 flat").

The FE (`src/app/pricing/pricing-options.service.ts`, `pricing-bundles.service.ts`, `pricing.util.ts`) currently runs entirely on in-memory mock data (`signal<...>`) — no HTTP calls exist yet. Those files define the exact data shapes and CRUD operations this backend must support; a teammate will later swap the mock signals for real HTTP calls against these endpoints.

Checkout-time price calculation (`pricing.util.ts:calculatePricing`) is explicitly **out of scope** — built after this module. Note for whoever builds it: the FE's current mock formula spreads a flat-tier rate across *all* selected photos (`photoCount * (tier.value / tier.minQuantity)`), but the actual business rule (per the photographer, confirmed in this design conversation) is "flat rate for the first N photos, remainder at original per-photo price." These disagree and will need reconciling — not addressed here.

Auth is being built separately by a teammate and hasn't landed in this repo. This design stubs the current-photographer resolution behind a single decorator so the swap later touches one file.

## Scope

In scope: full CRUD for Pricing Options and Pricing Bundles, each scoped to the calling photographer. A minimal `Event` model and `EventPricingBundle` join table — just enough to enforce "can't delete a bundle an event still uses."

Out of scope: Event module (create/edit/list events), assigning bundles to events, checkout calculation, real auth (stubbed via header).

## Data model

```prisma
model PricingOption {
  id             String   @id @default(uuid())
  photographerId String   @map("photographer_id")
  label          String
  price          Decimal  @db.Decimal(10, 2)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([photographerId], map: "idx_pricing_options_photographer")
  @@map("pricing_options")
}

enum BundleModel {
  FLAT_TIER
  PERCENT_TIER
  NONE

  @@map("bundle_model")
}

model PricingBundle {
  id                 String      @id @default(uuid())
  photographerId     String      @map("photographer_id")
  name               String
  basePrice          Decimal     @db.Decimal(10, 2) @map("base_price")
  bundleModel        BundleModel @map("bundle_model")
  bundleTiers        Json        @map("bundle_tiers")
  fullGalleryEnabled Boolean     @default(false) @map("full_gallery_enabled")
  fullGalleryPrice   Decimal     @default(0) @db.Decimal(10, 2) @map("full_gallery_price")
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")

  events EventPricingBundle[]

  @@index([photographerId], map: "idx_pricing_bundles_photographer")
  @@map("pricing_bundles")
}

model Event {
  id             String   @id @default(uuid())
  photographerId String   @map("photographer_id")
  name           String
  createdAt      DateTime @default(now()) @map("created_at")

  pricingBundles EventPricingBundle[]

  @@map("events")
}

model EventPricingBundle {
  eventId         String @map("event_id")
  pricingBundleId String @map("pricing_bundle_id")

  event         Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  pricingBundle PricingBundle @relation(fields: [pricingBundleId], references: [id], onDelete: Restrict)

  @@id([eventId, pricingBundleId])
  @@map("event_pricing_bundles")
}
```

`bundleTiers` is a JSON column (`[{ minQuantity, value }]`) rather than a relational table: the FE always replaces the whole tier array in one save (`pricing-bundle-form.component.ts:106-108`), never edits a single tier via API, so a join table would add transaction complexity with no query benefit. `price`/`basePrice`/`fullGalleryPrice` use `Decimal`, not `Float`, to avoid floating-point rounding on currency. `onDelete: Restrict` on `EventPricingBundle.pricingBundle` makes the DB itself the backstop; the app-level count check turns that into a friendly 409 before the constraint would fire.

## API surface

**Pricing Options** (`src/pricing-options/`):

| Method | Path | Behavior |
|---|---|---|
| GET | `/pricing-options` | list current photographer's options |
| POST | `/pricing-options` | create; body `{ label, price }`; `photographerId` derived, never from body |
| PATCH | `/pricing-options/:id` | update; 404 if missing or owned by a different photographer |
| DELETE | `/pricing-options/:id` | unconditional delete — matches FE, which has no usage guard here |

**Pricing Bundles** (`src/pricing-bundles/`):

| Method | Path | Behavior |
|---|---|---|
| GET | `/pricing-bundles` | list current photographer's bundles, each with `eventsUsingCount` |
| GET | `/pricing-bundles/:id` | single bundle (edit-form load) |
| POST | `/pricing-bundles` | create; body `{ name, basePrice, bundleModel, bundleTiers[], fullGalleryEnabled, fullGalleryPrice }` |
| PATCH | `/pricing-bundles/:id` | whole-object replace, matching the FE form's save pattern |
| DELETE | `/pricing-bundles/:id` | 409 if `eventsUsingCount > 0`; else delete |

Ownership check on PATCH/DELETE for both resources: fetch by id; not found or wrong photographer → **404** (not 403 — avoids revealing that a record exists under another photographer).

## Auth stand-in

`@CurrentPhotographerId()` param decorator reads the `x-photographer-id` header and returns it; throws `BadRequestException` if missing. It is the single seam that changes when the real Firebase guard lands — controllers and services never read the header directly, so nothing else needs to change at that point.

## Validation

Following `src/photographer/photographer.dto.ts` conventions (class-validator + `@ApiProperty`):

- `PricingOption`: `label` non-empty string; `price` positive number.
- `PricingBundle`: `name` non-empty string; `basePrice`, `fullGalleryPrice` non-negative numbers; `bundleModel` restricted to the `BundleModel` enum; `bundleTiers` validated as a nested array (`@ValidateNested({ each: true })`) of `{ minQuantity: positive int, value: positive number }`.

## Module structure

Mirrors the existing `controller → service → repository` pattern (see `src/photographer/`):

```
src/pricing-options/
  pricing-options.controller.ts
  pricing-options.service.ts
  pricing-options.repository.ts
  pricing-options.dto.ts
  pricing-options.module.ts
src/pricing-bundles/
  pricing-bundles.controller.ts
  pricing-bundles.service.ts
  pricing-bundles.repository.ts
  pricing-bundles.dto.ts
  pricing-bundles.module.ts
src/common/decorators/current-photographer-id.decorator.ts
```

## Testing

Unit tests per service/repository, following the pattern established for `FirebaseAuthGuard` (mocked Prisma, no real DB). Ownership-check paths (404 on wrong photographer) and the bundle-delete 409 path are the highest-value cases to cover explicitly.
