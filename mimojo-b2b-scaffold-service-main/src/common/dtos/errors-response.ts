interface IErrorResponse {
  statusCode?: number;
  metaData?: unknown;
  path?: string;
  timestamp?: string;
  message?: string;
  error?: string;
  exception?: unknown;
}

export class ErrorResponse implements IErrorResponse {
  public statusCode?: number;

  public metaData?: unknown;

  public message?: string;

  public path?: string;

  public timestamp?: string;

  public error?: string;

  public exception?: unknown;

  constructor(
    statusCode?: number,
    metaData?: unknown,
    message?: string,
    path?: string,
    timestamp?: string,
    error?: string,
    exception?: Error
  ) {
    this.statusCode = statusCode;
    this.metaData = metaData;
    this.message = message;
    this.path = path;
    this.timestamp = timestamp;
    this.error = error;
    this.exception = exception;
  }
}
