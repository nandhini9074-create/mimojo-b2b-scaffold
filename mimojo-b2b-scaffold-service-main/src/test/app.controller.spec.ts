import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHello: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
    jest.clearAllMocks();
  });

  it('should return hello message', () => {
    (service.getHello as jest.Mock).mockReturnValue('Hello World');
    const result = controller.getHello();
    expect(service.getHello).toHaveBeenCalledTimes(1);
    expect(result).toBe('Hello World');
  });
});
