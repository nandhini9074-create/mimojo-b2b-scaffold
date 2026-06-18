import { registerAs } from '@nestjs/config';
import { EnvironmentEnum } from 'env.validation';
import { EnvKeysEnum } from './env.enum';
import { IAppConfig, IDatabaseConfig, IGrafanaConfig, IKafkaConfig, IServicesURLs } from './interface';
import { Dialect } from 'sequelize/types';

export const appConfig = registerAs(
  'app',
  (): IAppConfig => ({
    NODE_ENV: process.env[EnvKeysEnum.NODE_ENV] as EnvironmentEnum,
    SERVER_HTTP_PORT: Number.parseInt(process.env[EnvKeysEnum.SERVER_HTTP_PORT], 10),
    SERVER_HTTP_HOST: process.env[EnvKeysEnum.SERVER_HTTP_HOST],
    IS_SWAGGER_ENABLED: JSON.parse(process.env[EnvKeysEnum.IS_SWAGGER_ENABLED]),
  })
);

export const databaseConfig = registerAs(
  'database',
  (): IDatabaseConfig => ({
    DB_DIALECT: process.env[EnvKeysEnum.DB_DIALECT] as Dialect,
    DB_PORT: Number.parseInt(process.env[EnvKeysEnum.DB_PORT]),
    DB_DATABASE: process.env[EnvKeysEnum.DB_DATABASE],
    DB_HOST: process.env[EnvKeysEnum.DB_HOST],
    DB_USERNAME: process.env[EnvKeysEnum.DB_USERNAME],
    DB_PASSWORD: process.env[EnvKeysEnum.DB_PASSWORD],
    DB_AUTO_LOAD_MODELS: JSON.parse(process.env[EnvKeysEnum.DB_AUTO_LOAD_MODELS]),
    DB_SYNC: JSON.parse(process.env[EnvKeysEnum.DB_SYNC]),
    DB_FORCE: JSON.parse(process.env[EnvKeysEnum.DB_FORCE]),
    DB_POOL_MIN: Number.parseInt(process.env[EnvKeysEnum.DB_POOL_MIN]),
    DB_POOL_MAX: Number.parseInt(process.env[EnvKeysEnum.DB_POOL_MAX]),
    DB_LOGGING: JSON.parse(process.env[EnvKeysEnum.DB_LOGGING]),
    DB_UNDERSCORED: JSON.parse(process.env[EnvKeysEnum.DB_UNDERSCORED]),
    DB_SSL: JSON.parse(process.env[EnvKeysEnum.DB_SSL]),
  })
);

export const kafkaConfig = registerAs(
  'kafka',
  (): IKafkaConfig => ({
    KAFKA_ALLOW_AUTO_TOPIC_CREATION: JSON.parse(process.env[EnvKeysEnum.KAFKA_ALLOW_AUTO_TOPIC_CREATION]),
    KAFKA_AUTO_COMMIT: JSON.parse(process.env[EnvKeysEnum.KAFKA_AUTO_COMMIT]),
    KAFKA_PRODUCER_BROKERS: process.env[EnvKeysEnum.KAFKA_PRODUCER_BROKERS],
    KAFKA_CONSUMER_BROKERS: process.env[EnvKeysEnum.KAFKA_CONSUMER_BROKERS],
    KAFKA_FROM_BEGINING: JSON.parse(process.env[EnvKeysEnum.KAFKA_FROM_BEGINING]),
    KAFKA_CLIENT_ID: process.env[EnvKeysEnum.KAFKA_CLIENT_ID],
    KAFKA_AUDIT_LOG_TOPIC: process.env[EnvKeysEnum.KAFKA_AUDIT_LOG_TOPIC],
  })
);

export const servicesURLs = registerAs(
  'servicesURLs',
  (): IServicesURLs => ({
    GRAVITEE_ENDPOINT: process.env[EnvKeysEnum.GRAVITEE_ENDPOINT],
    CONSUMER_IDENTITY_SERVICE_URL: process.env[EnvKeysEnum.CONSUMER_IDENTITY_SERVICE_URL],
  })
);

export const grafanaCredentials = registerAs(
  'grafanaCredentials',
  (): IGrafanaConfig => ({
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env[EnvKeysEnum.OTEL_EXPORTER_OTLP_ENDPOINT] ?? '',
    SERVICE_NAME: process.env[EnvKeysEnum.SERVICE_NAME] ?? '',
  })
);
