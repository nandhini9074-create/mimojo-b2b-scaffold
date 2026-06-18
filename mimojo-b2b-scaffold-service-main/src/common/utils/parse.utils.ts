import { EachMessagePayload, IHeaders, KafkaMessage } from 'kafkajs';
import { KafkaMessageParsedData, KafkaMessagePayloadData } from '../../kafka/types/kafka-consumer.type';

const parseUtils = {
  bufferToJSON(buffer: unknown): unknown {
    if (!buffer) return null;

    if (!Buffer.isBuffer(buffer)) {
      console.warn('utils.bufferToJSON - input is not a Buffer');
      return null;
    }

    try {
      const messageRawValue = buffer.toString('utf-8');
      return JSON.parse(messageRawValue);
    } catch (ex) {
      console.error('utils.bufferToJSON - exception', { ex });
      return null;
    }
  },

  stringToJSON(string: string) {
    if (!string) return null;

    if (typeof string !== 'string') {
      console.warn('utils.stringToJSON - input is not a string');
      return null;
    }

    try {
      return JSON.parse(string);
    } catch (ex) {
      console.error('utils.stringToJSON - exception', { ex, string });
      return null;
    }
  },

  bufferToString(buffer: unknown): string | null {
    if (!buffer) return null;

    if (!Buffer.isBuffer(buffer)) {
      console.warn('utils.bufferToString - input is not a Buffer');
      return null;
    }

    try {
      return buffer.toString('utf-8');
    } catch (ex) {
      console.error('utils.bufferToString - exception', { ex });
      return null;
    }
  },

  parseKafkaPayload(payload: EachMessagePayload): KafkaMessagePayloadData {
    const { topic, partition, message } = payload;
    const parsedMessage = this.parseKafkaMessage(message);
    const payloadData: KafkaMessagePayloadData = { topic, partition, ...parsedMessage };
    return payloadData;
  },

  parseKafkaMessage(message: KafkaMessage): KafkaMessageParsedData {
    const { key: keyBuffer, value: valueBuffer, headers: headersBuffer, offset, timestamp } = message || {};
    const key = this.bufferToString(keyBuffer);
    const value = this.bufferToJSON(valueBuffer);
    const headers = this.parseKafkaHeaders(headersBuffer);

    const messageData: KafkaMessageParsedData = { key, value, headers, offset, timestamp };
    return messageData;
  },

  parseKafkaHeaders(headers?: IHeaders): Record<string, string | null> {
    if (!headers) return {};

    return Object.entries(headers).reduce(
      (acc, [key, value]) => {
        acc[key] = this.bufferToString(value);
        return acc;
      },
      {} as Record<string, string | null>
    );
  },

  stringifyAndParse(value: unknown): unknown {
    if (!value) return null;

    try {
      const stringValue = JSON.stringify(value);
      return JSON.parse(stringValue);
    } catch (ex) {
      console.error('utils.stringifyAndParse - exception', { ex });
      return null;
    }
  },

  bearerToken(authorizationHeader: string): string | null {
    if (!authorizationHeader) return null;

    const match = authorizationHeader.match(/^Bearer (.+)$/);
    return match ? match[1] : null;
  },
};

export default parseUtils;
