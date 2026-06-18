import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { validate } from 'env.validation';
import { appConfig, grafanaCredentials, databaseConfig, kafkaConfig, servicesURLs } from '../config/server.config';
import { databaseBuilder } from '././common/helpers/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './common/errors/catch-all-errors';
import { GenericHttpModule } from './http/http.module';
import { PINO_LOGGER_OPTIONS_TOKEN, PinoLoggerInterceptor } from './logger/logger.interceptor';
import { LoggerModule, PinoLogger } from 'nestjs-pino';
import { CustomLoggerModule } from './logger/logger.module';
import { SampleModule } from './sample/sample.module';
import { KafkaModule } from './kafka/kafka.module';
import { ScaffoldModule } from './scaffold/scaffold.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, databaseConfig, grafanaCredentials, servicesURLs, kafkaConfig],
      cache: true,
      isGlobal: true,
      validate,
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return databaseBuilder(config);
      },
    }),
    LoggerModule.forRoot(),
    CustomLoggerModule,
    SampleModule,
    GenericHttpModule,
    KafkaModule,
    ScaffoldModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PinoLogger,
    {
      provide: PINO_LOGGER_OPTIONS_TOKEN,
      useValue: {
        logRequests: true,
        logResponseBody: true,
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PinoLoggerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
