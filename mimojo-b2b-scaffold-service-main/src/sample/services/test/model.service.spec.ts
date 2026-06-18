import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { ModelService } from '../model.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { User } from 'src/sample/entities/sample.model';

describe('ModelService', () => {
  let service: ModelService;
  let userModel: any;
  let logger: jest.Mocked<CustomPinoLogger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelService,
        {
          provide: getModelToken(User),
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

    service = module.get(ModelService);
    userModel = module.get(getModelToken(User));
    logger = module.get(CustomPinoLogger);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  it('should log and call model.findOne successfully', async () => {
    const where = { id: '123' };
    userModel.findOne.mockResolvedValue({});

    await service.findOne(where);

    expect(logger.info).toHaveBeenCalledWith('ModelService.findOne has been called', { where });

    expect(userModel.findOne).toHaveBeenCalledWith({ where });

    expect(logger.info).toHaveBeenCalledWith('ModelService.findOne completed');
  });

  // ─────────────────────────────────────────────
  it('should log error and throw HttpException with response data', async () => {
    const where = { id: 'err' };
    const error = {
      response: {
        message: { data: 'Invalid credentials' },
        status: HttpStatus.UNAUTHORIZED,
      },
    };

    userModel.findOne.mockRejectedValue(error);

    await expect(service.findOne(where)).rejects.toThrow(new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED));

    expect(logger.error).toHaveBeenCalledWith('ModelService.findOne exception', { error });
  });

  // ─────────────────────────────────────────────
  it('should fallback to default error message and status', async () => {
    const where = { id: 'err' };
    const error = new Error('unexpected');

    userModel.findOne.mockRejectedValue(error);

    await expect(service.findOne(where)).rejects.toThrow(
      new HttpException(ErrorMessages.auth.invalidCredentials, HttpStatus.INTERNAL_SERVER_ERROR)
    );

    expect(logger.error).toHaveBeenCalledWith('ModelService.findOne exception', { error });
  });
});
