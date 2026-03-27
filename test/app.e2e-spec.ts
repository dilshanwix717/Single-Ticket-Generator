import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TicketsController } from '../src/tickets/tickets.controller';
import { TicketsService } from '../src/tickets/tickets.service';

describe('TicketsController (e2e, mocked service)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            generate: jest.fn().mockResolvedValue({
              ticket_no: 'NO.20250327-TEST-01',
              multiplier: 0,
              win_tier: 'NO_WIN',
              hit_count: 0,
              payout: 0,
              w_numbers: ['01', '02', '03', '04', '05'],
              y_numbers: Array.from({ length: 20 }, (_, i) =>
                (10 + i).toString().padStart(2, '0'),
              ),
              amount_layout: { amounts: Array(20).fill(1.5) },
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /tickets/generate validates body', () => {
    return request(app.getHttpServer())
      .post('/tickets/generate')
      .send({})
      .expect(400);
  });
});
