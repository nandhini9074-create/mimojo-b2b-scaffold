import { Test, TestingModule } from '@nestjs/testing';
import { SampleController } from '../sample.controller';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import * as baseResponseHelperModule from 'src/common/helpers/base-response.helper';
import { ExampleDto } from 'src/sample/dto/example';
import { SampleService } from 'src/sample/services/sample.service';

describe('SampleController', () => {
  let controller: SampleController;
  let sampleService: SampleService;
  let logger: CustomPinoLogger;

  const baseResponseHelperSpy = jest.spyOn(baseResponseHelperModule, 'baseResponseHelper');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SampleController],
      providers: [
        {
          provide: SampleService,
          useValue: {
            sampleMethod: jest.fn(),
          },
        },
        {
          provide: CustomPinoLogger,
          useValue: {
            info: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SampleController>(SampleController);
    sampleService = module.get<SampleService>(SampleService);
    logger = module.get<CustomPinoLogger>(CustomPinoLogger);

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should call service, log, and return base response', async () => {
      const dto: ExampleDto = { name: 'John' } as any;
      const id = '123';

      (sampleService.sampleMethod as jest.Mock).mockResolvedValue(id);
      baseResponseHelperSpy.mockReturnValue({ data: id });

      const result = await controller.createUser(dto);

      expect(logger.info).toHaveBeenCalledWith('SampleController.createUser has been called', { exampleDto: dto });

      expect(sampleService.sampleMethod).toHaveBeenCalledWith(dto);

      expect(logger.info).toHaveBeenCalledWith('SampleController.createUser completed', { id });

      expect(baseResponseHelperSpy).toHaveBeenCalledWith(id);
      expect(result).toEqual({ data: id });
    });
  });

  describe('getUserName', () => {
    it('should return id and name wrapped in base response', async () => {
      const id = '1';
      const name = 'Alice';

      baseResponseHelperSpy.mockReturnValue({
        data: { id, name },
      });

      const result = await controller.getUserName(id, name);

      expect(logger.info).toHaveBeenCalledWith('SampleController.getUserName has been called', { id, name });

      expect(logger.info).toHaveBeenCalledWith('SampleController.getUserName completed', { id, name });

      expect(baseResponseHelperSpy).toHaveBeenCalledWith({ id, name });
      expect(result).toEqual({ data: { id, name } });
    });
  });
});
