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

export const scaffoldTemplatesConfig: TemplateConfig = {
  repoUrl: 'https://github.com/mojosoln/mimojo-enrollment-template-service',
  branch: 'main',
  templates: {
    // ── Shared across both variants ──────────────────────────────────
    shared: [
      // Bootstrapping & Core Setup
      'src/main.ts',
      'src/app.module.ts',
      'src/tracer.ts',

      // Configuration & Validation
      'config/server.config.ts',
      'env.validation.ts',

      // Logging
      'src/logger/logger.interceptor.ts',
      'src/logger/custom-logger.service.ts',

      // Security
      'src/guards/auth.guard.ts',

      // HTTP Client
      'src/http/generic-http.service.ts',

      // Kafka
      'src/kafka/consumer/kafka-consumer-handler.service.ts',

      // Database helper
      'src/common/helpers/database.ts',

      // Standardized outputs
      'src/common/dtos/base-response.ts',
      'src/common/errors/catch-all-errors.ts',
      'src/common/helpers/base-response.helper.ts',

      // Feature metadata
      'src/enrollment/metadata/feature.yml',
      'src/enrollment/config/variant.config.ts',
    ],

    // ── Variant 1: auto_api — API-Based Enrollment/Unenrollment ─────
    api: [
      // Controllers
      'src/enrollment/controllers/enroll.controller.ts',
      'src/enrollment/controllers/unenroll.controller.ts',

      // Services
      'src/enrollment/services/enroll.service.ts',
      'src/enrollment/services/unenroll.service.ts',

      // DTOs
      'src/enrollment/dto/enrol-card.dto.ts',
      'src/enrollment/dto/unenroll-card.dto.ts',

      // Database Models
      'src/enrollment/entities/customer.model.ts',
      'src/enrollment/entities/user-card.model.ts',
      'src/enrollment/entities/activityLog.model.ts',

      // Enums
      'src/enums/card-status.enum.ts',
    ],

    // ── Variant 2: auto_file — File-Based Batch Processing ──────────
    file: [
      // Controller
      'src/enrollment/controllers/file-upload.controller.ts',

      // Service
      'src/enrollment/services/file-upload.service.ts',

      // DTOs
      'src/enrollment/dto/file.model.ts',
      'src/enrollment/dto/file-status.dto.ts',
    ],
  },
};
