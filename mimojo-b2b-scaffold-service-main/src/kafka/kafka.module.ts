import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './consumer/kafka-consumer.service';
import { KafkaConsumerInitService } from './consumer/kafka-consumer-init.service';
import { KafkaConsumerConfigService } from './consumer/kafka-consumer-config.service';
import { KafkaConsumerHandlerService } from './consumer/kafka-consumer-handler.service';
import { KafkaConsumerValidator } from './consumer/kafka-consumer.validator';
import { CustomLoggerModule } from '../logger/logger.module';

@Module({
  imports: [CustomLoggerModule],
  providers: [
    KafkaConsumerService,
    KafkaConsumerInitService,
    KafkaConsumerConfigService,
    KafkaConsumerHandlerService,
    KafkaConsumerValidator,
  ],
  exports: [KafkaConsumerService],
})
export class KafkaModule {}
