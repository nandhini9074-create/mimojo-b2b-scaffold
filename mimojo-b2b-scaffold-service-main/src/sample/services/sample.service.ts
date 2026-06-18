import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ExampleDto } from '../dto/example';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { ErrorMessages } from 'src/common/errors/error-messages';
import { ModelService } from './model.service';

@Injectable()
export class SampleService {
  private readonly serviceName = 'SampleService';

  constructor(
    private readonly modelService: ModelService,
    private readonly logger: CustomPinoLogger
  ) {}

  async sampleMethod(exampleDto: ExampleDto): Promise<void> {
    const methodName = 'sampleMethod';
    try {
      this.logger.info(`${this.serviceName}.${methodName} has been called`, { exampleDto });
      await this.modelService.findOne({ id: exampleDto.id });
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
