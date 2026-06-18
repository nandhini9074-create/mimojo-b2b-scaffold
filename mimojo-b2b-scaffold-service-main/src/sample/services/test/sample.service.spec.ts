import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SampleService } from '../sample.service';
import { ModelService } from '../model.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { ExampleDto } from 'src/sample/dto/example';

describe('SampleService', () => {
  let service: SampleService;
  let modelService: jest.Mocked<ModelService>;
  let logger: jest.Mocked<CustomPinoLogger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SampleService,
        {
          provide: ModelService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CustomPinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SampleService);
    modelService = module.get(ModelService);
    logger = module.get(CustomPinoLogger);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  it('should log and call modelService.findOne successfully', async () => {
    const dto: ExampleDto = { id: '123' } as any;
    modelService.findOne.mockResolvedValue();

    await service.sampleMethod(dto);

    expect(logger.info).toHaveBeenCalledWith('SampleService.sampleMethod has been called', { exampleDto: dto });

    expect(modelService.findOne).toHaveBeenCalledWith({ id: '123' });

    expect(logger.info).toHaveBeenCalledWith('SampleService.sampleMethod completed');
  });

  // ─────────────────────────────────────────────
  it('should log error and throw HttpException on failure', async () => {
    const dto: ExampleDto = { id: 'err' } as any;

    const error = {
      response: {
        message: { data: 'Invalid credentials' },
        status: HttpStatus.UNAUTHORIZED,
      },
    };

    modelService.findOne.mockRejectedValue(error);

    await expect(service.sampleMethod(dto)).rejects.toThrow(
      new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED)
    );

    expect(logger.error).toHaveBeenCalledWith('SampleService.sampleMethod exception', { error });
  });

  // ─────────────────────────────────────────────
  it('should fallback to default error message and status', async () => {
    const dto: ExampleDto = { id: 'err' } as any;
    const error = new Error('unexpected');

    modelService.findOne.mockRejectedValue(error);

    await expect(service.sampleMethod(dto)).rejects.toThrow(
      new HttpException(ErrorMessages.auth.invalidCredentials, HttpStatus.INTERNAL_SERVER_ERROR)
    );

    expect(logger.error).toHaveBeenCalledWith('SampleService.sampleMethod exception', { error });
  });
});
