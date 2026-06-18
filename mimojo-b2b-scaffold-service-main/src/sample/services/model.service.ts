import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../entities/sample.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { ErrorMessages } from 'src/common/errors/error-messages';

@Injectable()
export class ModelService {
  private readonly serviceName = 'ModelService';

  constructor(
    @InjectModel(User)
    private readonly model: typeof User,
    private readonly logger: CustomPinoLogger
  ) {}

  async findOne(where: any): Promise<void> {
    const methodName = 'findOne';
    try {
      this.logger.info(`${this.serviceName}.${methodName} has been called`, { where });
      await this.model.findOne({ where });
      this.logger.info(`${this.serviceName}.${methodName} completed`);
    } catch (error) {
      this.logger.error(`${this.serviceName}.${methodName} exception`, { error });
      throw new HttpException(
        error?.response?.message?.data ?? error?.response ?? ErrorMessages.auth.invalidCredentials,
        error?.response?.status ?? error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
