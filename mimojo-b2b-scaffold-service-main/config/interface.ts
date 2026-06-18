import { EnvironmentEnum } from 'env.validation';
import { Dialect } from 'sequelize/types';

export interface IAppConfig {
  SERVER_HTTP_HOST: string;
  SERVER_HTTP_PORT: number;
  NODE_ENV: EnvironmentEnum;
  IS_SWAGGER_ENABLED: boolean;
}

export interface IDatabaseConfig {
  DB_DIALECT: Dialect;
  DB_PORT: number;
  DB_DATABASE: string;
  DB_AUTO_LOAD_MODELS: boolean;
  DB_SYNC: boolean;
  DB_FORCE: boolean;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  DB_LOGGING: boolean;
  DB_UNDERSCORED: boolean;
  DB_HOST: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
}
export interface IKafkaConfig {
  KAFKA_CONSUMER_BROKERS: string;
  KAFKA_PRODUCER_BROKERS: string;
  KAFKA_ALLOW_AUTO_TOPIC_CREATION: boolean;
  KAFKA_AUTO_COMMIT: boolean;
  KAFKA_FROM_BEGINING: boolean;
  KAFKA_CLIENT_ID: string;
  KAFKA_AUDIT_LOG_TOPIC: string;
}

export interface IServicesURLs {
  GRAVITEE_ENDPOINT: string;
  CONSUMER_IDENTITY_SERVICE_URL: string;
}

export interface IGrafanaConfig {
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  SERVICE_NAME: string;
}
