import { LogMeta } from '../types/utils.type';

const logUtils = {
  /**
   * Formats log metadata for consistent logging.
   *
   * @param logSource - The source of the log (e.g., ServiceName.MethodName)
   * @param logContext - Key/value pairs providing contextual information to include in the log
   * @returns {LogMeta} An object containing:
   *   - `logSource`: the original source string
   *   - `logContext`: a formatted string of key-value pairs for logging (e.g., "key1: value1 key2: value2")
   */
  logMeta(logSource: string, logContext: Record<string, string | number | boolean | null | undefined>): LogMeta {
    const formatted = Object.entries(logContext)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ');

    return { logSource: logSource, logContext: formatted };
  },
};

export default logUtils;
