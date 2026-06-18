import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IKafkaConfig } from 'config/interface';
import { KafkaProducerService } from 'src/kafka/producer/kafka-producer.service';

@Injectable()
export class DataOperationsProducer {
  private readonly config: IKafkaConfig;

  constructor(
    private readonly producerService: KafkaProducerService,
    private readonly configService: ConfigService
  ) {
    this.config = this.configService.get('kafka');
  }

  async pushToAuditLogService(transReference: string, notification: any, headers: any) {
    if (notification)
      await this.producerService.produce({
        topic: this.config.KAFKA_AUDIT_LOG_TOPIC,
        messages: [
          {
            key: transReference,
            value: JSON.stringify(notification),
            headers,
          },
        ],
      });
  }
}
