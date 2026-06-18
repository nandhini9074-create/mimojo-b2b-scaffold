import { Injectable } from '@nestjs/common';
import { IKafkaConfig } from 'config/interface';
import { KafkaConsumerService } from './kafka-consumer.service';
import { ConsumerRunConfig } from 'kafkajs';
import { KafkaConsumerHandlerService } from './kafka-consumer-handler.service';
import { kafkaConfig } from '../../../config/server.config';

@Injectable()
export class KafkaConsumerConfigService {
  private readonly config: IKafkaConfig;
  private readonly topicGroups: { groupId: string; topics: string[] }[] = [];
  constructor(
    private readonly consumerService: KafkaConsumerService,
    private readonly kafkaConsumerHandlerService: KafkaConsumerHandlerService
  ) {
    this.config = kafkaConfig();
    // this.topicGroups = this.mapTopics();
  }

  private mapTopics() {
    const topicGroups = [
      {
        // groupId: this.config.KAFKA_GROUP_ID,
        // topics: [this.config.KAFKA_POS_EVENT_TOPIC],
      },
    ];
    return topicGroups;
  }

  async defaultConsumer() {
    for (const topicGroup of this.topicGroups) {
      await this.configConsumer(topicGroup.topics, topicGroup.groupId);
    }
  }

  private async configConsumer(topics: string[], groupId: string) {
    const topic = { topics, fromBeginning: this.config.KAFKA_FROM_BEGINING };
    const messageHandler = this.kafkaConsumerHandlerService.defaultHandler.bind(this.kafkaConsumerHandlerService);
    const config: ConsumerRunConfig = { autoCommit: this.config.KAFKA_AUTO_COMMIT, eachMessage: messageHandler };
    await this.consumerService.consume(topic, config, groupId);
  }
}
