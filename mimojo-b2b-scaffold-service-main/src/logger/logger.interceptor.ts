import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, Optional } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

interface PinoLoggerOptions {
  logRequests?: boolean;
  logResponseBody?: boolean;
}

export const PINO_LOGGER_OPTIONS_TOKEN = 'PINO_LOGGER_OPTIONS_TOKEN';

/** Mutable HTTP log object built in constructHTTPLog and augmented in logHTTPResponse. */
interface HttpLogMeta {
  timestamp: number;
  duration: number;
  fullUrl: string;
  http: Record<string, unknown>;
  usr: Record<string, unknown>;
  network: { client: Record<string, unknown> };
  error?: unknown;
}

/** Non-Error values sometimes passed into error logging (HTTP / framework error shapes). */
interface LoggableNonError {
  statusCode?: number;
  status?: number;
  message?: string;
  name?: string;
  stack?: string;
}

@Injectable()
export class PinoLoggerInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(PINO_LOGGER_OPTIONS_TOKEN)
    protected readonly options?: PinoLoggerOptions
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const methodLabel = `${className}.${methodName}`;

    try {
      if (context.getType() === 'http') {
        context.switchToHttp().getRequest().startedAt = startedAt;
      }

      if (this.options?.logRequests) {
        this.logRequest(context, methodLabel);
      }
    } catch (ex) {
      console.error('Error in logging request', ex);
    }

    return next.handle().pipe(
      tap({
        next: data => {
          try {
            if (this.options?.logResponseBody) {
              this.logResponse(context, methodLabel, data, 'info');
            }
          } catch (ex) {
            console.error('Error in logging response', ex);
          }
        },
        error: err => {
          try {
            this.errorLog(context, err, methodLabel);
          } catch (ex) {
            console.error('Error in logging error', ex);
          }
        },
      })
    );
  }

  protected errorLog(context: ExecutionContext, err: unknown, methodLabel: string): void {
    this.logResponse(context, methodLabel, err, 'error');
  }

  protected logResponse(
    context: ExecutionContext,
    methodLabel: string,
    responseBody?: unknown,
    level: 'info' | 'error' = 'info'
  ): void {
    try {
      this.logHTTPResponse(context, methodLabel, responseBody, level);
    } catch (err) {
      console.error('Log response failed', err);
    }
  }

  private logHTTPRequest(context: ExecutionContext, methodLabel: string): void {
    const meta = this.constructHTTPLog(context);
    if (!meta) return;
    this.logger.info(meta, `${methodLabel} method called`);
  }

  private logHTTPResponse(
    context: ExecutionContext,
    methodLabel: string,
    responseBody?: unknown,
    level: 'info' | 'error' = 'info'
  ): void {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const meta = this.constructHTTPLog(context);

    if (!meta) return;

    const startedAt = req.startedAt;
    if (startedAt) {
      const duration = Date.now() - startedAt;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      meta.duration = duration * 1_000_000;
    } else {
      meta.duration = 0;
    }

    if (level === 'error') {
      const errBody = responseBody as LoggableNonError | undefined;
      meta.http.status_code = errBody?.statusCode ?? errBody?.status ?? 500;
      meta.error =
        responseBody instanceof Error
          ? { message: responseBody.message, name: responseBody.name, stack: responseBody.stack }
          : {
              message: errBody?.message,
              name: errBody?.name,
              stack: errBody?.stack,
            };
    } else {
      meta.http.status_code = res?.statusCode ?? 200;
    }

    if (!(responseBody instanceof Error)) {
      meta.http.responseBody = this.cleanBody(this.safeClone(responseBody));
      meta.http.rawResponseBody = this.safeStringify(responseBody);
    }
    meta.http.rawResponseHeaders = this.safeStringify(res.getHeaders());

    const message = `${methodLabel} method ${level === 'error' ? 'failed' : 'completed'}`;
    this.logger[level](meta, message);
  }

  private constructHTTPLog(context: ExecutionContext): HttpLogMeta | null {
    const req = context.switchToHttp().getRequest();
    const { originalUrl = '', method = '', headers, body = {}, user: usr, ip } = req;
    const user = usr || {};

    if (originalUrl.endsWith('heartbeat') || method.toLowerCase() === 'options') {
      return null;
    }

    const originalHost = headers['host'];
    const originalReqUrl = req['url'];
    const fullUrl = `${originalHost}${originalReqUrl}`;

    return {
      timestamp: Date.now(),
      duration: 0,
      fullUrl,
      http: {
        method,
        url: originalUrl,
        headers,
        useragent_details: {
          device: {
            family: headers['x-device-platform'],
          },
        },
        body: this.cleanBody(body),
        rawBody: this.safeStringify(body),
        rawHeaders: this.safeStringify(headers),
      },
      usr: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      network: {
        client: { ip },
      },
    };
  }

  private cleanBody(body: unknown): Record<string, unknown> {
    return Object.entries((body || {}) as Record<string, unknown>).reduce(
      (acc, [key, value]) => {
        acc[key] = ['pin', 'password', 'otp'].includes(key) ? '***' : value;
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '[Unserializable body]';
    }
  }

  private safeClone<T>(obj: T): T | string {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return '[Unserializable response]';
    }
  }

  private logRequest(context: ExecutionContext, methodLabel: string): void {
    this.logHTTPRequest(context, methodLabel);
  }
}
