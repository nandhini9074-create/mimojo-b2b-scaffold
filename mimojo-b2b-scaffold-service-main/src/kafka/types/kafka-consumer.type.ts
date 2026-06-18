export type KafkaMessagePayloadData = KafkaMessageParsedData & {
  topic: string;
  partition: number;
};

export type KafkaMessageParsedData = {
  key: string | null;
  value: unknown | null;
  headers: Record<string, string | null>;
  offset: string;
  timestamp: string;
};
