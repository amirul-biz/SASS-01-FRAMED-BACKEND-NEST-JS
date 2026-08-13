import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from 'supertest';
import {PricingOptionsController} from './pricing-options.controller';
import {PricingOptionsService} from './pricing-options.service';

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