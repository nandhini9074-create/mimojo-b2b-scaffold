import { Global, Module } from '@nestjs/common';
import { CustomPinoLogger } from './custom-logger.service';

@Global()
@Module({
  providers: [CustomPinoLogger],
  exports: [CustomPinoLogger],
})
export class CustomLoggerModule {}
