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