# Pricing Options & Pricing Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note:** the human is implementing this by hand to learn NestJS. Do not execute it on their behalf unless they ask.

**Goal:** Backend CRUD for Pricing Options (per-photo delivery formats) and Pricing Bundles (bulk-purchase presets), scoped per photographer, matching the exact data shapes the FE already defines in its (currently mock) `pricing-options.service.ts` / `pricing-bundles.service.ts`.

**Architecture:** Two new domain modules following the existing `controller → service → repository` pattern from `src/photographer/`. A minimal `Event` + `EventPricingBundle` join table is added solely to make "can't delete a bundle an event still uses" a real, DB-backed check. Since the real auth guard isn't in this repo yet, a `@CurrentPhotographerId()` decorator reads a temporary `x-photographer-id` header — the single seam that changes when real auth lands.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), class-validator, Jest 30 + ts-jest, supertest 7, Swagger.

**Spec:** `docs/superpowers/specs/2026-08-13-pricing-options-bundles-design.md`

## Global Constraints

- **Tests live beside source as `*.spec.ts`**, `rootDir: src` per `package.json:68-84`. No `test/` directory.
- **No path aliases** — relative imports only (`tsconfig.json` has no `paths`).
- **`isolatedModules: true`** — type-only imports use `import type`.
- **Money is `Decimal` in Prisma, `number` on the wire.** Prisma's `Decimal` serializes to a *string* via its own `toJSON`, not a number — every response DTO must explicitly convert with `Number(decimalValue)` or the FE gets `"12.00"` instead of `12`.
- **`bundleModel` is a Prisma enum (`FLAT_TIER` / `PERCENT_TIER` / `NONE`) internally, but the wire format the FE requires is lowercase-hyphenated (`'flat-tier'` / `'percent-tier'` / `'none'`)** — confirmed against `picsweep-fe/src/app/pricing/pricing.util.ts:1`. This plan includes an explicit mapping layer; do not expose the Prisma enum names directly in any response.
- **`PrismaModule` is `@Global()`** (`prisma.module.ts:4`) — inject `PrismaService` anywhere, no import needed. New modules in this plan don't need `FirebaseModule`.
- **No response envelope yet** (`{success,message,data}` wrapping is a separate, not-yet-built phase) — controllers here return DTOs/arrays directly, matching how `photographer.controller.ts` and `sample.controller.ts` currently behave.
- **Ownership check returns 404, not 403**, on both "record doesn't exist" and "record belongs to a different photographer" — avoids leaking existence of another photographer's data.
- Run all tests: `npm test`. Run one file: `npx jest src/path/to/file.spec.ts`.

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | **Modify.** Add `PricingOption`, `BundleModel`, `PricingBundle`, `Event`, `EventPricingBundle`. |
| `src/common/decorators/current-photographer-id.decorator.ts` | **Create.** Reads `x-photographer-id` header; throws if missing. The one seam that changes when real auth lands. |
| `src/pricing-options/pricing-options.dto.ts` | **Create.** Request/response DTOs. |
| `src/pricing-options/pricing-options.repository.ts` | **Create.** Thin Prisma wrapper — no dedicated unit tests, mirrors `PhotographerRepository`, which also has none. |
| `src/pricing-options/pricing-options.service.ts` | **Create.** Ownership checks, Decimal→number mapping. |
| `src/pricing-options/pricing-options.controller.ts` | **Create.** Routes. |
| `src/pricing-options/pricing-options.module.ts` | **Create.** |
| `src/pricing-bundles/pricing-bundles.dto.ts` | **Create.** Includes `bundleModel` wire-format mapping and nested `bundleTiers` validation. |
| `src/pricing-bundles/pricing-bundles.repository.ts` | **Create.** Includes the `eventsUsingCount` aggregation. |
| `src/pricing-bundles/pricing-bundles.service.ts` | **Create.** Ownership checks, 409-on-delete-in-use, enum mapping. |
| `src/pricing-bundles/pricing-bundles.controller.ts` | **Create.** Routes. |
| `src/pricing-bundles/pricing-bundles.module.ts` | **Create.** |
| `src/app.module.ts` | **Modify.** Register both new modules. |

---

## Task 1: Prisma schema — new models and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma Client types `PricingOption`, `PricingBundle`, `BundleModel` (enum), `Event`, `EventPricingBundle` — every later task's repository imports these from `../../generated/prisma/client`.

No tests in this task — it's schema + migration, verified by the generated client compiling.

- [ ] **Step 1: Add the models**

Append to `prisma/schema.prisma`, after the existing `AdminProfile` model:

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

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_pricing_options_bundles`
Expected: a new folder under `prisma/migrations/`, and the command ends with `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate the client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client (7.9.1) to .\generated`. This is what makes `PricingOption`, `PricingBundle`, `BundleModel`, `Event` importable in Task 2 onward.

- [ ] **Step 4: Verify the client has the new types**

Run: `npx tsc --noEmit -p tsconfig.json` (or just open `generated/models.ts` and confirm `PricingOption` and `PricingBundle` are present).
Expected: no errors related to missing Prisma types.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(pricing): add PricingOption, PricingBundle, Event schema"
```

---

## Task 2: `@CurrentPhotographerId()` decorator

**Files:**
- Create: `src/common/decorators/current-photographer-id.decorator.ts`
- Test: `src/common/decorators/current-photographer-id.decorator.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CurrentPhotographerId` param decorator and exported `currentPhotographerIdFactory(data, context)` — returns the `x-photographer-id` header value as a string, throws `BadRequestException` if absent or blank.

**Why a header, not a real lookup:** the real Firebase guard isn't in this repo yet (built separately by a teammate). This decorator is a placeholder with the same call shape a real one would have (`@CurrentPhotographerId() id: string` in a controller signature) — swapping its internals later doesn't touch any controller.

- [ ] **Step 1: Write the failing test**

Create `src/common/decorators/current-photographer-id.decorator.spec.ts`:

```ts
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { currentPhotographerIdFactory } from './current-photographer-id.decorator';

function makeContext(headers: Record<string, string> = {}) {
  const request = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('currentPhotographerIdFactory', () => {
  it('returns the header value when present', () => {
    const context = makeContext({ 'x-photographer-id': 'photographer-1' });

    expect(currentPhotographerIdFactory(undefined, context)).toBe('photographer-1');
  });

  it('throws BadRequestException when the header is missing', () => {
    const context = makeContext();

    expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when the header is blank', () => {
    const context = makeContext({ 'x-photographer-id': '   ' });

    expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/common/decorators/current-photographer-id.decorator.spec.ts`
Expected: FAIL — cannot find module `./current-photographer-id.decorator`.

- [ ] **Step 3: Write minimal implementation**

Create `src/common/decorators/current-photographer-id.decorator.ts`:

```ts
import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const currentPhotographerIdFactory = (
  _data: unknown,
  context: ExecutionContext,
): string => {
  const request = context.switchToHttp().getRequest();
  const header = request.headers?.['x-photographer-id'];

  if (typeof header !== 'string' || header.trim() === '') {
    throw new BadRequestException(
      'Missing x-photographer-id header (temporary stand-in until real auth is wired up)',
    );
  }

  return header;
};

export const CurrentPhotographerId = createParamDecorator(
  currentPhotographerIdFactory,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/common/decorators/current-photographer-id.decorator.spec.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/common/decorators/current-photographer-id.decorator.ts src/common/decorators/current-photographer-id.decorator.spec.ts
git commit -m "feat(pricing): add temporary CurrentPhotographerId header decorator"
```

---

## Task 3: Pricing Options module

**Files:**
- Create: `src/pricing-options/pricing-options.dto.ts`
- Create: `src/pricing-options/pricing-options.repository.ts`
- Create: `src/pricing-options/pricing-options.service.ts`
- Test: `src/pricing-options/pricing-options.service.spec.ts`
- Create: `src/pricing-options/pricing-options.controller.ts`
- Test: `src/pricing-options/pricing-options.controller.spec.ts`
- Create: `src/pricing-options/pricing-options.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `CurrentPhotographerId` (Task 2), `PrismaService` (`src/config/database/prisma.service.ts`, global).
- Produces: `PricingOptionsModule`; routes `GET/POST /pricing-options`, `PATCH/DELETE /pricing-options/:id`.

**Why the service holds ownership logic, not the repository:** the repository does raw Prisma calls only (`findMany`, `findUnique`, `create`, `update`, `delete`). The service is where "does this record belong to the calling photographer" gets decided — that's business logic, not data access, and it's the part worth unit-testing in isolation with a mocked repository.

- [ ] **Step 1: Write the DTOs**

Create `src/pricing-options/pricing-options.dto.ts`:

```ts
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePricingOptionDto {
  @ApiProperty({ example: '30MP JPEG' })
  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  label!: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than zero' })
  price!: number;
}

export class UpdatePricingOptionDto {
  @ApiProperty({ example: '30MP JPEG', required: false })
  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  label?: string;

  @ApiProperty({ example: 12, required: false })
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than zero' })
  price?: number;
}

export class PricingOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() label!: string;
  @ApiProperty() price!: number;
}
```

Note `UpdatePricingOptionDto` fields are optional but, unlike a typical PATCH DTO, are not wrapped in `Partial<>` from the create DTO — both are spelled out so `@IsNotEmpty`/`@IsPositive` still run when a field *is* sent, while `@IsOptional()` would be needed to allow omission. Add `@IsOptional()` above each decorator pair so a PATCH can send just one field:

```ts
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
```

```ts
export class UpdatePricingOptionDto {
  @ApiProperty({ example: '30MP JPEG', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  label?: string;

  @ApiProperty({ example: 12, required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than zero' })
  price?: number;
}
```

- [ ] **Step 2: Write the repository**

Create `src/pricing-options/pricing-options.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';

@Injectable()
export class PricingOptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForPhotographer(photographerId: string) {
    return this.prisma.pricingOption.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.pricingOption.findUnique({ where: { id } });
  }

  create(data: { photographerId: string; label: string; price: number }) {
    return this.prisma.pricingOption.create({ data });
  }

  update(id: string, data: { label?: string; price?: number }) {
    return this.prisma.pricingOption.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.pricingOption.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Write the failing service test**

Create `src/pricing-options/pricing-options.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { PricingOptionsService } from './pricing-options.service';

describe('PricingOptionsService', () => {
  let repository: {
    findAllForPhotographer: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let service: PricingOptionsService;

  const option = {
    id: 'option-1',
    photographerId: 'photographer-1',
    label: '30MP JPEG',
    price: { toString: () => '12.00' } as any,
  };

  beforeEach(() => {
    repository = {
      findAllForPhotographer: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new PricingOptionsService(repository as any);
  });

  describe('list', () => {
    it('returns options mapped with price as a number', async () => {
      repository.findAllForPhotographer.mockResolvedValue([option]);

      const result = await service.list('photographer-1');

      expect(result).toEqual([
        { id: 'option-1', photographerId: 'photographer-1', label: '30MP JPEG', price: 12 },
      ]);
      expect(repository.findAllForPhotographer).toHaveBeenCalledWith('photographer-1');
    });
  });

  describe('create', () => {
    it('creates an option owned by the calling photographer', async () => {
      repository.create.mockResolvedValue(option);

      const result = await service.create('photographer-1', { label: '30MP JPEG', price: 12 });

      expect(repository.create).toHaveBeenCalledWith({
        photographerId: 'photographer-1',
        label: '30MP JPEG',
        price: 12,
      });
      expect(result.price).toBe(12);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the option does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('photographer-1', 'missing-id', { price: 20 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the option belongs to a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...option, photographerId: 'someone-else' });

      await expect(
        service.update('photographer-1', 'option-1', { price: 20 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates the option when it belongs to the calling photographer', async () => {
      repository.findById.mockResolvedValue(option);
      repository.update.mockResolvedValue({ ...option, price: { toString: () => '20.00' } });

      const result = await service.update('photographer-1', 'option-1', { price: 20 });

      expect(repository.update).toHaveBeenCalledWith('option-1', { price: 20 });
      expect(result.price).toBe(20);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the option belongs to a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...option, photographerId: 'someone-else' });

      await expect(service.remove('photographer-1', 'option-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes the option when it belongs to the calling photographer', async () => {
      repository.findById.mockResolvedValue(option);

      await service.remove('photographer-1', 'option-1');

      expect(repository.delete).toHaveBeenCalledWith('option-1');
    });
  });
});
```

The mock `price` uses `{ toString: () => '12.00' }` to stand in for a Prisma `Decimal` without importing the real class — `Number()` calls `toString()` under the hood, so this is a faithful substitute.

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/pricing-options/pricing-options.service.spec.ts`
Expected: FAIL — cannot find module `./pricing-options.service`.

- [ ] **Step 5: Write minimal implementation**

Create `src/pricing-options/pricing-options.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PricingOptionsRepository } from './pricing-options.repository';
import { PricingOptionResponseDto } from './pricing-options.dto';

@Injectable()
export class PricingOptionsService {
  constructor(private readonly repository: PricingOptionsRepository) {}

  async list(photographerId: string): Promise<PricingOptionResponseDto[]> {
    const options = await this.repository.findAllForPhotographer(photographerId);
    return options.map((option) => this.toResponse(option));
  }

  async create(
    photographerId: string,
    input: { label: string; price: number },
  ): Promise<PricingOptionResponseDto> {
    const option = await this.repository.create({
      photographerId,
      label: input.label,
      price: input.price,
    });
    return this.toResponse(option);
  }

  async update(
    photographerId: string,
    id: string,
    changes: { label?: string; price?: number },
  ): Promise<PricingOptionResponseDto> {
    await this.assertOwnedByPhotographer(photographerId, id);
    const option = await this.repository.update(id, changes);
    return this.toResponse(option);
  }

  async remove(photographerId: string, id: string): Promise<void> {
    await this.assertOwnedByPhotographer(photographerId, id);
    await this.repository.delete(id);
  }

  private async assertOwnedByPhotographer(photographerId: string, id: string): Promise<void> {
    const option = await this.repository.findById(id);
    if (!option || option.photographerId !== photographerId) {
      throw new NotFoundException('Pricing option not found');
    }
  }

  private toResponse(option: {
    id: string;
    photographerId: string;
    label: string;
    price: { toString(): string };
  }): PricingOptionResponseDto {
    return {
      id: option.id,
      photographerId: option.photographerId,
      label: option.label,
      price: Number(option.price),
    };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/pricing-options/pricing-options.service.spec.ts`
Expected: PASS — 6 tests.

- [ ] **Step 7: Write the failing controller test**

Create `src/pricing-options/pricing-options.controller.spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PricingOptionsController } from './pricing-options.controller';
import { PricingOptionsService } from './pricing-options.service';

describe('PricingOptionsController', () => {
  let app: INestApplication;
  let service: { list: jest.Mock; create: jest.Mock; update: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    service = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [PricingOptionsController],
      providers: [{ provide: PricingOptionsService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /pricing-options passes the photographer id from the header to the service', async () => {
    service.list.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/pricing-options')
      .set('x-photographer-id', 'photographer-1')
      .expect(200);

    expect(service.list).toHaveBeenCalledWith('photographer-1');
  });

  it('GET /pricing-options without the header returns 400', async () => {
    await request(app.getHttpServer()).get('/pricing-options').expect(400);
    expect(service.list).not.toHaveBeenCalled();
  });
});
```

This exercises the real `CurrentPhotographerId` decorator (not stubbed) — it's a plain function reading the request, so no override is needed the way a guard would need one.

- [ ] **Step 8: Run test to verify it fails**

Run: `npx jest src/pricing-options/pricing-options.controller.spec.ts`
Expected: FAIL — cannot find module `./pricing-options.controller`.

- [ ] **Step 9: Write the controller**

Create `src/pricing-options/pricing-options.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PricingOptionsService } from './pricing-options.service';
import {
  CreatePricingOptionDto,
  PricingOptionResponseDto,
  UpdatePricingOptionDto,
} from './pricing-options.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';

@ApiTags('pricing-options')
@Controller('pricing-options')
@UsePipes(new ValidationPipe({ transform: true }))
export class PricingOptionsController {
  constructor(private readonly service: PricingOptionsService) {}

  @Get()
  list(@CurrentPhotographerId() photographerId: string): Promise<PricingOptionResponseDto[]> {
    return this.service.list(photographerId);
  }

  @Post()
  create(
    @CurrentPhotographerId() photographerId: string,
    @Body() dto: CreatePricingOptionDto,
  ): Promise<PricingOptionResponseDto> {
    return this.service.create(photographerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePricingOptionDto,
  ): Promise<PricingOptionResponseDto> {
    return this.service.update(photographerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.remove(photographerId, id);
  }
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx jest src/pricing-options/pricing-options.controller.spec.ts`
Expected: PASS — 2 tests.

- [ ] **Step 11: Wire the module**

Create `src/pricing-options/pricing-options.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PricingOptionsController } from './pricing-options.controller';
import { PricingOptionsService } from './pricing-options.service';
import { PricingOptionsRepository } from './pricing-options.repository';

@Module({
  controllers: [PricingOptionsController],
  providers: [PricingOptionsService, PricingOptionsRepository],
})
export class PricingOptionsModule {}
```

No `imports` needed — `PrismaModule` is `@Global()`.

In `src/app.module.ts`, add the import and register it:

```ts
import { PricingOptionsModule } from './pricing-options/pricing-options.module';
```

```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SampleModule,
    PhotographerModule,
    PricingOptionsModule,
  ],
```

(If Task 4 of the auth plan already added `AuthModule` here, add `PricingOptionsModule` alongside it — don't remove `AuthModule`.)

- [ ] **Step 12: Full-suite check and commit**

Run: `npm test`
Expected: PASS — all specs, including the 6 + 2 new here.

```bash
git add src/pricing-options src/app.module.ts
git commit -m "feat(pricing): add Pricing Options CRUD module"
```

---

## Task 4: Pricing Bundles module

**Files:**
- Create: `src/pricing-bundles/pricing-bundles.dto.ts`
- Create: `src/pricing-bundles/pricing-bundles.repository.ts`
- Create: `src/pricing-bundles/pricing-bundles.service.ts`
- Test: `src/pricing-bundles/pricing-bundles.service.spec.ts`
- Create: `src/pricing-bundles/pricing-bundles.controller.ts`
- Test: `src/pricing-bundles/pricing-bundles.controller.spec.ts`
- Create: `src/pricing-bundles/pricing-bundles.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `CurrentPhotographerId` (Task 2), `PrismaService`, the `BundleModel` Prisma enum (Task 1).
- Produces: `PricingBundlesModule`; routes `GET /pricing-bundles`, `GET /pricing-bundles/:id`, `POST /pricing-bundles`, `PATCH /pricing-bundles/:id`, `DELETE /pricing-bundles/:id`.

**The wire-format mapping, spelled out:** the FE's `BundleModel` type (`pricing.util.ts:1`) is `'flat-tier' | 'percent-tier' | 'none'`. Prisma enum members can't contain hyphens, so the Prisma enum is `FLAT_TIER | PERCENT_TIER | NONE`. Two small lookup functions translate between them at the service boundary — this is the only place that conversion happens.

- [ ] **Step 1: Write the DTOs**

Create `src/pricing-bundles/pricing-bundles.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type WireBundleModel = 'flat-tier' | 'percent-tier' | 'none';
export const WIRE_BUNDLE_MODELS: WireBundleModel[] = ['flat-tier', 'percent-tier', 'none'];

export class BundleTierDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  minQuantity!: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(0)
  value!: number;
}

export class CreatePricingBundleDto {
  @ApiProperty({ example: 'Standard Bundle' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiProperty({ example: 'flat-tier', enum: WIRE_BUNDLE_MODELS })
  @IsIn(WIRE_BUNDLE_MODELS)
  bundleModel!: WireBundleModel;

  @ApiProperty({ type: [BundleTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleTierDto)
  bundleTiers!: BundleTierDto[];

  @ApiProperty({ example: false })
  @IsBoolean()
  fullGalleryEnabled!: boolean;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  fullGalleryPrice!: number;
}

export class UpdatePricingBundleDto {
  @ApiProperty({ example: 'Standard Bundle', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name?: string;

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({ example: 'flat-tier', enum: WIRE_BUNDLE_MODELS, required: false })
  @IsOptional()
  @IsIn(WIRE_BUNDLE_MODELS)
  bundleModel?: WireBundleModel;

  @ApiProperty({ type: [BundleTierDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleTierDto)
  bundleTiers?: BundleTierDto[];

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  fullGalleryEnabled?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fullGalleryPrice?: number;
}

export class PricingBundleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty({ enum: WIRE_BUNDLE_MODELS }) bundleModel!: WireBundleModel;
  @ApiProperty({ type: [BundleTierDto] }) bundleTiers!: BundleTierDto[];
  @ApiProperty() fullGalleryEnabled!: boolean;
  @ApiProperty() fullGalleryPrice!: number;
  @ApiProperty() eventsUsingCount!: number;
}
```

- [ ] **Step 2: Write the repository**

Create `src/pricing-bundles/pricing-bundles.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import { BundleModel, Prisma } from '../../generated/prisma/client';

@Injectable()
export class PricingBundlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPhotographer(photographerId: string) {
    const bundles = await this.prisma.pricingBundle.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(bundles.map((bundle) => this.withEventsUsingCount(bundle)));
  }

  async findById(id: string) {
    const bundle = await this.prisma.pricingBundle.findUnique({ where: { id } });
    if (!bundle) return null;
    return this.withEventsUsingCount(bundle);
  }

  create(data: {
    photographerId: string;
    name: string;
    basePrice: number;
    bundleModel: BundleModel;
    bundleTiers: Prisma.InputJsonValue;
    fullGalleryEnabled: boolean;
    fullGalleryPrice: number;
  }) {
    return this.prisma.pricingBundle.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      basePrice: number;
      bundleModel: BundleModel;
      bundleTiers: Prisma.InputJsonValue;
      fullGalleryEnabled: boolean;
      fullGalleryPrice: number;
    }>,
  ) {
    return this.prisma.pricingBundle.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.pricingBundle.delete({ where: { id } });
  }

  countEventsUsing(pricingBundleId: string): Promise<number> {
    return this.prisma.eventPricingBundle.count({ where: { pricingBundleId } });
  }

  private async withEventsUsingCount<T extends { id: string }>(bundle: T) {
    const eventsUsingCount = await this.countEventsUsing(bundle.id);
    return { ...bundle, eventsUsingCount };
  }
}
```

`Prisma.InputJsonValue` is the type Prisma expects for writing to a `Json` column — plain `object`/`array` types aren't accepted directly by `create`/`update`.

- [ ] **Step 3: Write the failing service test**

Create `src/pricing-bundles/pricing-bundles.service.spec.ts`:

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PricingBundlesService } from './pricing-bundles.service';

describe('PricingBundlesService', () => {
  let repository: {
    findAllForPhotographer: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    countEventsUsing: jest.Mock;
  };
  let service: PricingBundlesService;

  const bundle = {
    id: 'bundle-1',
    photographerId: 'photographer-1',
    name: 'Standard Bundle',
    basePrice: { toString: () => '15.00' } as any,
    bundleModel: 'FLAT_TIER' as const,
    bundleTiers: [{ minQuantity: 5, value: 30 }],
    fullGalleryEnabled: false,
    fullGalleryPrice: { toString: () => '0.00' } as any,
    eventsUsingCount: 0,
  };

  beforeEach(() => {
    repository = {
      findAllForPhotographer: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countEventsUsing: jest.fn(),
    };
    service = new PricingBundlesService(repository as any);
  });

  describe('list', () => {
    it('maps bundleModel to wire format and money fields to numbers', async () => {
      repository.findAllForPhotographer.mockResolvedValue([bundle]);

      const [result] = await service.list('photographer-1');

      expect(result.bundleModel).toBe('flat-tier');
      expect(result.basePrice).toBe(15);
      expect(result.fullGalleryPrice).toBe(0);
      expect(result.eventsUsingCount).toBe(0);
    });
  });

  describe('create', () => {
    it('maps the wire bundleModel to the Prisma enum before saving', async () => {
      repository.create.mockResolvedValue({ ...bundle, eventsUsingCount: 0 });

      await service.create('photographer-1', {
        name: 'Standard Bundle',
        basePrice: 15,
        bundleModel: 'flat-tier',
        bundleTiers: [{ minQuantity: 5, value: 30 }],
        fullGalleryEnabled: false,
        fullGalleryPrice: 0,
      });

      expect(repository.create).toHaveBeenCalledWith({
        photographerId: 'photographer-1',
        name: 'Standard Bundle',
        basePrice: 15,
        bundleModel: 'FLAT_TIER',
        bundleTiers: [{ minQuantity: 5, value: 30 }],
        fullGalleryEnabled: false,
        fullGalleryPrice: 0,
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when owned by a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...bundle, photographerId: 'someone-else' });

      await expect(
        service.update('photographer-1', 'bundle-1', { name: 'Renamed' }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws ConflictException when an event still uses the bundle', async () => {
      repository.findById.mockResolvedValue({ ...bundle, eventsUsingCount: 2 });

      await expect(service.remove('photographer-1', 'bundle-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when owned by a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...bundle, photographerId: 'someone-else' });

      await expect(service.remove('photographer-1', 'bundle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes when owned by the caller and unused', async () => {
      repository.findById.mockResolvedValue({ ...bundle, eventsUsingCount: 0 });

      await service.remove('photographer-1', 'bundle-1');

      expect(repository.delete).toHaveBeenCalledWith('bundle-1');
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/pricing-bundles/pricing-bundles.service.spec.ts`
Expected: FAIL — cannot find module `./pricing-bundles.service`.

- [ ] **Step 5: Write minimal implementation**

Create `src/pricing-bundles/pricing-bundles.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingBundlesRepository } from './pricing-bundles.repository';
import {
  BundleTierDto,
  PricingBundleResponseDto,
  WireBundleModel,
} from './pricing-bundles.dto';
import { BundleModel } from '../../generated/prisma/client';

const TO_PRISMA_MODEL: Record<WireBundleModel, BundleModel> = {
  'flat-tier': BundleModel.FLAT_TIER,
  'percent-tier': BundleModel.PERCENT_TIER,
  none: BundleModel.NONE,
};

const TO_WIRE_MODEL: Record<BundleModel, WireBundleModel> = {
  [BundleModel.FLAT_TIER]: 'flat-tier',
  [BundleModel.PERCENT_TIER]: 'percent-tier',
  [BundleModel.NONE]: 'none',
};

interface BundleInput {
  name: string;
  basePrice: number;
  bundleModel: WireBundleModel;
  bundleTiers: BundleTierDto[];
  fullGalleryEnabled: boolean;
  fullGalleryPrice: number;
}

@Injectable()
export class PricingBundlesService {
  constructor(private readonly repository: PricingBundlesRepository) {}

  async list(photographerId: string): Promise<PricingBundleResponseDto[]> {
    const bundles = await this.repository.findAllForPhotographer(photographerId);
    return bundles.map((bundle) => this.toResponse(bundle));
  }

  async findOne(photographerId: string, id: string): Promise<PricingBundleResponseDto> {
    const bundle = await this.assertOwnedByPhotographer(photographerId, id);
    return this.toResponse(bundle);
  }

  async create(
    photographerId: string,
    input: BundleInput,
  ): Promise<PricingBundleResponseDto> {
    const bundle = await this.repository.create({
      photographerId,
      name: input.name,
      basePrice: input.basePrice,
      bundleModel: TO_PRISMA_MODEL[input.bundleModel],
      bundleTiers: input.bundleTiers,
      fullGalleryEnabled: input.fullGalleryEnabled,
      fullGalleryPrice: input.fullGalleryPrice,
    });
    return this.toResponse({ ...bundle, eventsUsingCount: 0 });
  }

  async update(
    photographerId: string,
    id: string,
    changes: Partial<BundleInput>,
  ): Promise<PricingBundleResponseDto> {
    const existing = await this.assertOwnedByPhotographer(photographerId, id);
    const bundle = await this.repository.update(id, {
      name: changes.name,
      basePrice: changes.basePrice,
      bundleModel: changes.bundleModel ? TO_PRISMA_MODEL[changes.bundleModel] : undefined,
      bundleTiers: changes.bundleTiers,
      fullGalleryEnabled: changes.fullGalleryEnabled,
      fullGalleryPrice: changes.fullGalleryPrice,
    });
    return this.toResponse({ ...bundle, eventsUsingCount: existing.eventsUsingCount });
  }

  async remove(photographerId: string, id: string): Promise<void> {
    const bundle = await this.assertOwnedByPhotographer(photographerId, id);
    if (bundle.eventsUsingCount > 0) {
      throw new ConflictException(
        `Cannot delete: ${bundle.eventsUsingCount} event(s) still use this bundle`,
      );
    }
    await this.repository.delete(id);
  }

  private async assertOwnedByPhotographer(photographerId: string, id: string) {
    const bundle = await this.repository.findById(id);
    if (!bundle || bundle.photographerId !== photographerId) {
      throw new NotFoundException('Pricing bundle not found');
    }
    return bundle;
  }

  private toResponse(bundle: {
    id: string;
    photographerId: string;
    name: string;
    basePrice: { toString(): string };
    bundleModel: BundleModel;
    bundleTiers: unknown;
    fullGalleryEnabled: boolean;
    fullGalleryPrice: { toString(): string };
    eventsUsingCount: number;
  }): PricingBundleResponseDto {
    return {
      id: bundle.id,
      photographerId: bundle.photographerId,
      name: bundle.name,
      basePrice: Number(bundle.basePrice),
      bundleModel: TO_WIRE_MODEL[bundle.bundleModel],
      bundleTiers: bundle.bundleTiers as BundleTierDto[],
      fullGalleryEnabled: bundle.fullGalleryEnabled,
      fullGalleryPrice: Number(bundle.fullGalleryPrice),
      eventsUsingCount: bundle.eventsUsingCount,
    };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/pricing-bundles/pricing-bundles.service.spec.ts`
Expected: PASS — 6 tests.

- [ ] **Step 7: Write the failing controller test**

Create `src/pricing-bundles/pricing-bundles.controller.spec.ts`:

```ts
import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PricingBundlesController } from './pricing-bundles.controller';
import { PricingBundlesService } from './pricing-bundles.service';

describe('PricingBundlesController', () => {
  let app: INestApplication;
  let service: {
    list: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PricingBundlesController],
      providers: [{ provide: PricingBundlesService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /pricing-bundles passes the photographer id to the service', async () => {
    service.list.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/pricing-bundles')
      .set('x-photographer-id', 'photographer-1')
      .expect(200);

    expect(service.list).toHaveBeenCalledWith('photographer-1');
  });

  it('DELETE /pricing-bundles/:id returns 409 when the service throws ConflictException', async () => {
    service.remove.mockRejectedValue(new ConflictException('in use'));

    await request(app.getHttpServer())
      .delete('/pricing-bundles/bundle-1')
      .set('x-photographer-id', 'photographer-1')
      .expect(409);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx jest src/pricing-bundles/pricing-bundles.controller.spec.ts`
Expected: FAIL — cannot find module `./pricing-bundles.controller`.

- [ ] **Step 9: Write the controller**

Create `src/pricing-bundles/pricing-bundles.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PricingBundlesService } from './pricing-bundles.service';
import {
  CreatePricingBundleDto,
  PricingBundleResponseDto,
  UpdatePricingBundleDto,
} from './pricing-bundles.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';

@ApiTags('pricing-bundles')
@Controller('pricing-bundles')
@UsePipes(new ValidationPipe({ transform: true }))
export class PricingBundlesController {
  constructor(private readonly service: PricingBundlesService) {}

  @Get()
  list(@CurrentPhotographerId() photographerId: string): Promise<PricingBundleResponseDto[]> {
    return this.service.list(photographerId);
  }

  @Get(':id')
  findOne(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<PricingBundleResponseDto> {
    return this.service.findOne(photographerId, id);
  }

  @Post()
  create(
    @CurrentPhotographerId() photographerId: string,
    @Body() dto: CreatePricingBundleDto,
  ): Promise<PricingBundleResponseDto> {
    return this.service.create(photographerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePricingBundleDto,
  ): Promise<PricingBundleResponseDto> {
    return this.service.update(photographerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.remove(photographerId, id);
  }
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx jest src/pricing-bundles/pricing-bundles.controller.spec.ts`
Expected: PASS — 2 tests.

- [ ] **Step 11: Wire the module**

Create `src/pricing-bundles/pricing-bundles.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PricingBundlesController } from './pricing-bundles.controller';
import { PricingBundlesService } from './pricing-bundles.service';
import { PricingBundlesRepository } from './pricing-bundles.repository';

@Module({
  controllers: [PricingBundlesController],
  providers: [PricingBundlesService, PricingBundlesRepository],
})
export class PricingBundlesModule {}
```

In `src/app.module.ts`:

```ts
import { PricingBundlesModule } from './pricing-bundles/pricing-bundles.module';
```

```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SampleModule,
    PhotographerModule,
    PricingOptionsModule,
    PricingBundlesModule,
  ],
```

- [ ] **Step 12: Full-suite check and commit**

Run: `npm test`
Expected: PASS — all specs.

Run: `npm run build`
Expected: compiles clean.

```bash
git add src/pricing-bundles src/app.module.ts
git commit -m "feat(pricing): add Pricing Bundles CRUD module"
```

---

## Task 5: End-to-end verification

**Files:** none — manual verification only.

- [ ] **Step 1: Boot the app**

Run: `npm run start:dev`
Expected: Nest logs mapped routes for `/pricing-options` and `/pricing-bundles` (GET/POST/PATCH/DELETE), no `UnknownDependenciesException`.

- [ ] **Step 2: Create a pricing option**

```bash
curl -X POST http://localhost:3001/pricing-options \
  -H "Content-Type: application/json" \
  -H "x-photographer-id: photographer-1" \
  -d '{"label":"30MP JPEG","price":12}'
```
Expected: `201`, JSON with `price: 12` (a number, not `"12.00"`).

- [ ] **Step 3: Create a pricing bundle**

```bash
curl -X POST http://localhost:3001/pricing-bundles \
  -H "Content-Type: application/json" \
  -H "x-photographer-id: photographer-1" \
  -d '{"name":"Standard Bundle","basePrice":15,"bundleModel":"flat-tier","bundleTiers":[{"minQuantity":5,"value":30}],"fullGalleryEnabled":false,"fullGalleryPrice":0}'
```
Expected: `201`, `bundleModel: "flat-tier"` (lowercase-hyphenated, not `"FLAT_TIER"`), `eventsUsingCount: 0`.

- [ ] **Step 4: Verify ownership isolation**

Repeat step 3's `GET /pricing-bundles` with a different header value:

```bash
curl http://localhost:3001/pricing-bundles -H "x-photographer-id: someone-else"
```
Expected: `200`, empty array `[]` — the bundle from Step 3 belongs to `photographer-1` and must not appear.

- [ ] **Step 5: Verify the delete-in-use guard**

This requires a manual DB row — no `Event` endpoints exist yet. Open `npx prisma studio`, find the bundle created in Step 3, and insert one row into `event_pricing_bundles` referencing it (you'll need an `events` row too — insert one manually with any `photographer_id`/`name`).

Then:

```bash
curl -i -X DELETE http://localhost:3001/pricing-bundles/<bundle-id> -H "x-photographer-id: photographer-1"
```
Expected: `409` with a message mentioning the bundle is still in use.

Delete the `event_pricing_bundles` row in Prisma Studio, retry the same curl.
Expected: `204`.

- [ ] **Step 6: Full suite one more time**

```bash
npm test
npm run build
```
Expected: all green.
