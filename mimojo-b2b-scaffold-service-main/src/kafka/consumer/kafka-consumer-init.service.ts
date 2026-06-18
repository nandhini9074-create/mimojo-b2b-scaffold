import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerConfigService } from './kafka-consumer-config.service';

@Injectable()
export class KafkaConsumerInitService implements OnModuleInit {
  constructor(private readonly kafkaConsumerConfigService: KafkaConsumerConfigService) {}

  async onModuleInit() {
    await this.kafkaConsumerConfigService.defaultConsumer();
  }
}
