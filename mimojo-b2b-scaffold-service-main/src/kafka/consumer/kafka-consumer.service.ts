import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { IKafkaConfig } from 'config/interface';
import { Consumer, ConsumerRunConfig, ConsumerSubscribeTopics, Kafka } from 'kafkajs';
import { kafkaConfig } from '../../../config/server.config';
import { CustomPinoLogger } from '../../logger/custom-logger.service';

@Injectable()
export class KafkaConsumerService implements OnApplicationShutdown {
  private readonly kafka: Kafka;
  private readonly config: IKafkaConfig;
  private readonly consumers: Consumer[] = [];

  constructor(private readonly logger: CustomPinoLogger) {
    this.config = kafkaConfig();

    const brokers = this.config.KAFKA_CONSUMER_BROKERS.split(',');
    const kafkaInitConfig = { clientId: this.config.KAFKA_CLIENT_ID, brokers };

    this.kafka = new Kafka(kafkaInitConfig);
  }

  async consume(topic: ConsumerSubscribeTopics, config: ConsumerRunConfig, groupId: string) {
    try {
      const consumer = this.kafka.consumer({ groupId });
      await consumer.subscribe(topic);
      await consumer.connect();
      await consumer.run(config);
      this.consumers.push(consumer);
      this.logger.info(`KafkaConsumerService.consume - kafka consumer initialized`, { topic, config });
    } catch (ex) {
      this.logger.error(`KafkaConsumerService.consume - exception`, { topic, config, ex });
      throw ex;
    }
  }

  async onApplicationShutdown() {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }
}
