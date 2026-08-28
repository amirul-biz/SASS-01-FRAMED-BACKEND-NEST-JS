import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PricingOptionsController } from './pricing-options.controller';
import { PricingOptionsService } from './pricing-options.service';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('PricingOptionsController', () => {
  let app: INestApplication;
  let service: { list: jest.Mock; create: jest.Mock; update: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    service = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [PricingOptionsController],
      providers: [{ provide: PricingOptionsService, useValue: service }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().dbUser = {
          userPlatforms: [{ role: 'PHOTOGRAPHER', photographerProfile: { id: 'photographer-1' } }],
        };
        return true;
      } })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /pricing-options passes the guard-derived photographer id to the service', async () => {
    service.list.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/pricing-options').expect(200);

    expect(service.list).toHaveBeenCalledWith('photographer-1');
  });
});
