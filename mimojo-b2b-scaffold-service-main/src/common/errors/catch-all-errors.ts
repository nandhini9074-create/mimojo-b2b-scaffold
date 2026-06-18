import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ErrorResponse } from '../dtos/errors-response';

@Catch()
export class AllExceptionsFilter<T = any> implements ExceptionFilter<T> {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // TODO: Log exception in the custom logger
    console.log(exception);
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const httpStatus = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody: ErrorResponse = {};
    if (exception instanceof HttpException) {
      responseBody.statusCode = httpStatus;
      responseBody.metaData = exception.getResponse();
      responseBody.error = exception.name;
      responseBody.timestamp = new Date().toISOString();
      responseBody.path = httpAdapter.getRequestUrl(ctx.getRequest());
      responseBody.message = exception.message;
      responseBody.exception = exception.cause;
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
