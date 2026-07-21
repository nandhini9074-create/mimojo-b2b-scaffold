/**
 * Centralized template configuration for the scaffold pipeline.
 *
 * Instead of requiring users to manually enter GitHub repo URLs and file paths
 * in the UI, this config defines which template repository and reference files
 * to use for each feature type (API vs File/Batch).
 *
 * Files are organized into three categories:
 *  - `shared`  — fetched once per scaffold run, available to ALL features
 *  - `api`     — fetched per feature of type "api"
 *  - `file`    — fetched per feature of type "file"
 *
 * To add or change templates, edit the mappings below and restart the server.
 * No frontend changes needed.
 */

export interface TemplateConfig {
  /** The GitHub repository URL (public) */
  repoUrl: string;
  /** Branch to fetch files from (default: 'main') */
  branch: string;
  /** Mapping of feature type → reference file paths in the repo */
  templates: {
    /** Files shared across all feature types — fetched once */
    shared: string[];
    /** API-specific reference files */
    api: string[];
    /** File/Batch-specific reference files */
    file: string[];
  };
}
export type TemplateName = 'enrollment' | 'transaction';

export const scaffoldTemplateRegistry: Record<TemplateName, TemplateConfig> = {
  enrollment: {
    repoUrl: `https://github.com/${process.env.GITHUB_OWNER_ENROLLMENT}/mimojo-enrollment-template-service-main`,
    branch: 'main',
    templates: {
      shared: [
        // Root-level runnable files (required for npm install & npm run start:dev)
        'package.json',
        'tsconfig.json',
        'tsconfig.build.json',
        'nest-cli.json',
        '.sequelizerc',
        '.gitignore',
        '.env.example',
        '.prettierrc',
        '.npmrc',
        'Dockerfile',
        // App bootstrap & shared infrastructure
        'src/main.ts',
        'src/app.module.ts',
        'src/app.controller.ts',
        'src/app.service.ts',
        'src/tracer.ts',
        'src/index.ts',
        'config/server.config.ts',
        'config/interface.ts',
        'config/env.enum.ts',
        'env.validation.ts',
        // Logger
        'src/logger/logger.interceptor.ts',
        'src/logger/custom-logger.service.ts',
        'src/logger/logger.module.ts',
        // Guards
        'src/guards/auth.guard.ts',
        // Common helpers & error handlers
        'src/common/errors/catch-all-errors.ts',
        'src/common/errors/exception-factory.filter.ts',
        'src/common/helpers/database.ts',
        'src/common/helpers/base-response.helper.ts',
        'src/common/enums/profile.ts',
        'src/common/utils/parse.utils.ts',
        'src/common/utils/log.utils.ts',
        'src/common/types/utils.type.ts',
        'src/common/dtos/base-response.ts',
        'src/common/dtos/errors-response.ts',
        'src/common/decorators/api-swagger.ts',
        // HTTP module
        'src/http/http.module.ts',
        'src/http/generic-http.service.ts',
        // Kafka module
        'src/kafka/kafka.module.ts',
        'src/kafka/consumer/kafka-consumer.service.ts',
        'src/kafka/consumer/kafka-consumer-init.service.ts',
        'src/kafka/consumer/kafka-consumer-config.service.ts',
        'src/kafka/consumer/kafka-consumer-handler.service.ts',
        'src/kafka/consumer/kafka-consumer.validator.ts',
        'src/kafka/types/kafka-consumer.type.ts',
      ],
      api: [
        'src/enrollment/controllers/enroll.controller.ts',
        'src/enrollment/controllers/unenroll.controller.ts',
        'src/enrollment/services/enroll.service.ts',
        'src/enrollment/services/unenroll.service.ts',
        'src/enrollment/dto/enrol-card.dto.ts',
        'src/enrollment/dto/unenroll-card.dto.ts',
        'src/enrollment/entities/customer.model.ts',
        'src/enrollment/entities/user-card.model.ts',
        'src/enrollment/entities/activityLog.model.ts',
        'src/enums/card-status.enum.ts',
      ],
      file: [
        'src/enrollment/controllers/file-upload.controller.ts',
        'src/enrollment/services/file-upload.service.ts',
        'src/enrollment/dto/file.model.ts',
        'src/enrollment/dto/file-status.dto.ts',
      ],
    },
  },
  transaction: {
    repoUrl: `https://github.com/${process.env.GITHUB_OWNER_TRANSACTION}/mimojo-transaction-template-service`,
    branch: 'main',
    templates: {
      shared: [
        // Root-level runnable files (required for npm install & npm run start:dev)
        'package.json',
        'tsconfig.json',
        'tsconfig.build.json',
        'nest-cli.json',
        '.sequelizerc',
        '.gitignore',
        '.env.example',
        '.prettierrc',
        '.npmrc',
        'Dockerfile',
        // App bootstrap & shared infrastructure
        'src/main.ts',
        'src/app.module.ts',
        'src/app.controller.ts',
        'src/app.service.ts',
        'src/tracer.ts',
        'src/index.ts',
        'config/server.config.ts',
        'config/interface.ts',
        'config/env.enum.ts',
        'env.validation.ts',
        // Logger
        'src/logger/logger.interceptor.ts',
        'src/logger/custom-logger.service.ts',
        'src/logger/logger.module.ts',
        // Guards
        'src/guards/auth.guard.ts',
        // Common helpers & error handlers
        'src/common/errors/catch-all-errors.ts',
        'src/common/errors/exception-factory.filter.ts',
        'src/common/errors/error-messages.ts',
        'src/common/service/common.service.ts',
        'src/common/helpers/database.ts',
        'src/common/helpers/base-response.helper.ts',
        'src/common/enums/profile.ts',
        'src/common/utils/parse.utils.ts',
        'src/common/utils/log.utils.ts',
        'src/common/types/utils.type.ts',
        'src/common/dtos/base-response.ts',
        'src/common/dtos/errors-response.ts',
        'src/common/decorators/api-swagger.ts',
        'src/decorators/api-swagger.ts',
        // HTTP module
        'src/http/http.module.ts',
        'src/http/generic-http.service.ts',
        // Kafka module
        'src/kafka/kafka.module.ts',
        'src/kafka/consumer/kafka-consumer.service.ts',
        'src/kafka/consumer/kafka-consumer-init.service.ts',
        'src/kafka/consumer/kafka-consumer-config.service.ts',
        'src/kafka/consumer/kafka-consumer-handler.service.ts',
        'src/kafka/consumer/kafka-consumer.validator.ts',
        'src/kafka/types/kafka-consumer.type.ts',
        // External dependencies
        'src/payout-configuration/services/payout-configuration.service.ts',
        'src/processed-payout/entities/payout.model.ts',
        'src/processed-payout/services/payday-saving.service.ts',
      ],
      api: [
        'src/transaction/controllers/transaction.controller.ts',
        'src/transaction/controllers/transaction-v2.controller.ts',
        'src/transaction/services/payout-transaction.service.ts',
        'src/transaction/dto/get-transaction.dto.ts',
        'src/transaction/dto/get-payday-transaction.dto.ts',
        'src/transaction/dto/transaction-details.dto.ts',
        'src/transaction/entities/payout-transaction.model.ts',
        'src/transaction/entities/consumer.model.ts',
        'src/transaction/entities/payout-status.model.ts',
        'src/transaction/enums/payout-status.enum.ts',
        'src/transaction/enums/payout-transaction-status.enum.ts',
        'src/transaction/enum/consumer-status.enum.ts',
        'src/transaction/dtos/appeal.dto.ts',
        'src/transaction/dtos/customer-pii-data.dto.ts',
        'src/transaction/dtos/appeal-file.dto.ts',
        'src/transaction/entities/consumer-cashback.model.ts',
        'src/transaction/entities/currency.model.ts',
        'src/transaction/entities/appeal.model.ts',
        'src/transaction/entities/payout-group.model.ts',
        'src/transaction/entities/group-transaction.model.ts',
        'src/transaction/entities/payout-merchant-outlet.model.ts',
        'src/transaction/proxies/cms-service.proxy.ts',
        'src/transaction/proxies/consumer-identity-service.proxy.ts',
        'src/transaction/proxies/merchant-adaptor-service.proxy.ts',
        'src/transaction/services/receipt.service.ts',
      ],
      file: [
        'src/transaction/controllers/transaction-v2.controller.ts',
        'src/transaction/services/payout-transaction.service.ts',
        'src/transaction/dto/get-transaction.dto.ts',
        'src/transaction/dto/get-payday-transaction.dto.ts',
        'src/transaction/dto/transaction-details.dto.ts',
        'src/transaction/entities/payout-transaction.model.ts',
        'src/transaction/entities/consumer.model.ts',
        'src/transaction/entities/payout-status.model.ts',
        'src/transaction/enums/payout-status.enum.ts',
        'src/transaction/enums/payout-transaction-status.enum.ts',
        'src/transaction/enum/consumer-status.enum.ts',
        'src/transaction/dtos/appeal.dto.ts',
        'src/transaction/dtos/customer-pii-data.dto.ts',
        'src/transaction/dtos/appeal-file.dto.ts',
        'src/transaction/entities/consumer-cashback.model.ts',
        'src/transaction/entities/currency.model.ts',
        'src/transaction/entities/appeal.model.ts',
        'src/transaction/entities/payout-group.model.ts',
        'src/transaction/entities/group-transaction.model.ts',
        'src/transaction/entities/payout-merchant-outlet.model.ts',
        'src/transaction/proxies/cms-service.proxy.ts',
        'src/transaction/proxies/consumer-identity-service.proxy.ts',
        'src/transaction/proxies/merchant-adaptor-service.proxy.ts',
        'src/transaction/services/receipt.service.ts',
      ],
    },
  },
};
