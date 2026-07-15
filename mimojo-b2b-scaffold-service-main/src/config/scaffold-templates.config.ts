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
    repoUrl: `https://github.com/${process.env.GITHUB_OWNER_ENROLLMENT || 'nandhini9074-create'}/mimojo-enrollment-template-service-main`,
    branch: 'main',
    templates: {
      shared: [
        'src/main.ts',
        'src/app.module.ts',
        'src/tracer.ts',
        'config/server.config.ts',
        'env.validation.ts',
        'src/logger/logger.interceptor.ts',
        'src/logger/custom-logger.service.ts',
        'src/guards/auth.guard.ts',
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
    repoUrl: `https://github.com/${process.env.GITHUB_OWNER_TRANSACTION || 'nandhini9074-create'}/mimojo-transaction-template-service`,
    branch: 'main',
    templates: {
      shared: [
        'src/main.ts',
        'src/app.module.ts',
        'src/tracer.ts',
        'config/server.config.ts',
        'env.validation.ts',
        'src/logger/logger.interceptor.ts',
        'src/logger/custom-logger.service.ts',
        'src/guards/auth.guard.ts',
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
        'src/transaction/entities/payout-merchant-outlet.model.ts',
      ],
    },
  },
};

export const scaffoldTemplatesConfig = scaffoldTemplateRegistry.enrollment;
