import { ConfigService } from '@nestjs/config';
import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { IDatabaseConfig } from 'config/interface';

export const databaseBuilder = (configService: ConfigService): SequelizeModuleOptions => {
  const {
    DB_DIALECT,
    DB_PORT,
    DB_DATABASE,
    DB_HOST,
    DB_USERNAME,
    DB_PASSWORD,
    DB_AUTO_LOAD_MODELS,
    DB_POOL_MAX,
    DB_POOL_MIN,
    DB_LOGGING,
    DB_UNDERSCORED,
    DB_SSL,
  } = configService.get<IDatabaseConfig>('database');

  return {
    dialect: DB_DIALECT,
    port: DB_PORT,
    database: DB_DATABASE,
    autoLoadModels: DB_AUTO_LOAD_MODELS,
    host: DB_HOST,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    ssl: DB_SSL,
    dialectOptions: {
      ssl: DB_SSL ?? { require: false },
    },
    sync: {
      force: false,
    },
    pool: {
      min: DB_POOL_MIN,
      max: DB_POOL_MAX,
    },
    benchmark: true,
    logQueryParameters: true,
    logging: DB_LOGGING
      ? (query, time) => {
          console.log(query + '\n' + time + 'ms\n');
        }
      : false,
    define: {
      underscored: DB_UNDERSCORED,
    },
  };
};
