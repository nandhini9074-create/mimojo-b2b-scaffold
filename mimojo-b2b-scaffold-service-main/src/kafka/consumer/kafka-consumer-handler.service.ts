import { Injectable } from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaConsumerValidator } from './kafka-consumer.validator';
import { kafkaConfig } from '../../../config/server.config';
import { CustomPinoLogger } from '../../logger/custom-logger.service';
import parseUtils from 'src/common/utils/parse.utils';
import logUtils from 'src/common/utils/log.utils';

type TKafkaHandler<TValue = unknown, TResult = unknown> = (value: TValue) => Promise<TResult>;
type TKafkaHandlers<TValue = unknown, TResult = unknown> = Record<string, TKafkaHandler<TValue, TResult>>;

@Injectable()
export class KafkaConsumerHandlerService {
  private readonly topicHandlers: TKafkaHandlers;

  constructor(
    private readonly logger: CustomPinoLogger,
    private readonly kafkaConsumerValidator: KafkaConsumerValidator
  ) {
    this.topicHandlers = this.mapHandlers();
  }

  private mapHandlers() {
    const kafkaConf = kafkaConfig();
    const topicHandlers = {
      // [kafkaConf.KAFKA_POS_EVENT_TOPIC]: this.orderPosService.posEventHandler.bind(this.orderPosService),
    };
    return topicHandlers;
  }

  async defaultHandler(payload: EachMessagePayload): Promise<void> {
    const payloadData = parseUtils.parseKafkaPayload(payload);
    const { topic, key, value } = payloadData;

    const { logSource, logContext } = logUtils.logMeta('KafkaConsumerHandlerService.defaultHandler', { topic, key });

    this.logger.info(`${logSource} - processing message; ${logContext}`, { ...payloadData });

    if (!this.kafkaConsumerValidator.validate(this.logger, logSource, payloadData)) return;

    const topicHandler = this.topicHandlers[topic];
    if (!topicHandler) {
      this.logger.warn(`${logSource} - no handler found; ${logContext}`, { ...payloadData });
      return;
    }

    try {
      const result = await topicHandler(value);
      this.logger.info(`${logSource} - processed message; ${logContext}`, { ...payloadData, result });
    } catch (ex) {
      this.logger.error(`${logSource} - exception; ${logContext}`, { ...payloadData, ex });
    }
  }
}
