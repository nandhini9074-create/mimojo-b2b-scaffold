import { Injectable } from '@nestjs/common';
import { IKafkaConfig } from 'config/interface';
import { Producer, Kafka, ProducerRecord, Message } from 'kafkajs';
import { kafkaConfig } from '../../../config/server.config';
import { CustomPinoLogger } from '../../logger/custom-logger.service';

@Injectable()
export class KafkaProducerService {
  private readonly kafka: Kafka;
  private readonly config: IKafkaConfig;
  private readonly producer: Producer;

  constructor(private readonly logger: CustomPinoLogger) {
    this.config = kafkaConfig();

    const brokers = this.config.KAFKA_PRODUCER_BROKERS.split(',');
    const kafkaInitConfig = { clientId: this.config.KAFKA_CLIENT_ID, brokers };

    try {
      this.kafka = new Kafka(kafkaInitConfig);
      this.producer = this.kafka.producer();
      this.producer.connect();
      this.logger.info(`KafkaProducerService.constructor - kafka producer initialized`);
    } catch (ex) {
      this.logger.error(`KafkaProducerService.constructor - exception`, { kafkaInitConfig, ex });
      throw ex;
    }
  }

  async produce(record: ProducerRecord) {
    this.logger.info(`KafkaProducerService.produce - producing message; topic: ${record?.topic}`, { record });
    try {
      await this.producer.send(record);
    } catch (ex) {
      this.logger.error(`KafkaProducerService.produce - exception; topic: ${record?.topic}`, { record, ex });
    }
  }

  async produceOne(topic: string, message: Message) {
    const key = message?.key ?? null;
    const record: ProducerRecord = { topic, messages: [message] };
    this.logger.info(`KafkaProducerService.produceOne - producing message; topic: ${topic} key: ${key}`, { record });
    try {
      await this.producer.send(record);
    } catch (ex) {
      this.logger.error(`KafkaProducerService.produceOne - exception; topic: ${topic}`, { record, ex });
    }
  }

  async onApplicationShutdown() {
    await this.producer.disconnect();
  }
}
