import { Injectable } from '@nestjs/common';
import { CustomPinoLogger } from './logger/custom-logger.service';

@Injectable()
export class AppService {
  constructor(private readonly logger: CustomPinoLogger) {}
  getHello(): string {
    this.logger.info('Returning Hello World message', { service: 'AppService' });
    return 'Hello World!';
  }
}
