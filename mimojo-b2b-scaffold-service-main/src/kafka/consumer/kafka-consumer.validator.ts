import { Injectable } from '@nestjs/common';
import { KafkaMessagePayloadData } from '../types/kafka-consumer.type';
import { CustomPinoLogger } from '../../logger/custom-logger.service';

@Injectable()
export class KafkaConsumerValidator {
  constructor() {}

  validate(logger: CustomPinoLogger, logSource: string, payloadData: KafkaMessagePayloadData) {
    const { key, value } = payloadData;

    if (!key || !value) {
      const vars = !key && !value ? 'key and value' : !key ? 'key' : 'value';
      logger.error(`${logSource} - invalid message; missing: ${vars}`, { key, value });
      return false;
    }
    return true;
  }
}
