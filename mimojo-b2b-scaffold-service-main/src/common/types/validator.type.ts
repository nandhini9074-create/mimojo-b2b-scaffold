import { CustomPinoLogger } from '../../logger/custom-logger.service';

export type ValidatorLogger = {
  logger: CustomPinoLogger;
  logSource: string;
  logContext: string;
};
