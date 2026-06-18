import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../app.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

describe('AppService', () => {
  let service: AppService;
  let logger: jest.Mocked<CustomPinoLogger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: CustomPinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AppService);
    logger = module.get(CustomPinoLogger);
  });

  it('should return "Hello World!" and log message', () => {
    const result = service.getHello();

    expect(result).toBe('Hello World!');

    expect(logger.info).toHaveBeenCalledWith('Returning Hello World message', { service: 'AppService' });
  });
});
