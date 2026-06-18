import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/** Forward to PinoLogger overloads without using `any` (see nestjs-pino `LoggerFn`). */
type ForwardLogFn = (first: unknown, ...rest: unknown[]) => void;

/** Serialize Error instances to plain objects and handle circular refs so meta is safe for JSON logs. */
function serializeMeta(meta: unknown, seen = new WeakSet<object>()): unknown {
  if (meta instanceof Error) {
    return {
      message: meta.message,
      name: meta.name,
      stack: meta.stack,
    };
  }
  if (meta !== null && typeof meta === 'object') {
    if (seen.has(meta as object)) {
      return '[Circular]';
    }
    seen.add(meta as object);
    if (Array.isArray(meta)) {
      return meta.map(item => serializeMeta(item, seen));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      out[k] = serializeMeta(v, seen);
    }
    return out;
  }
  return meta;
}

@Injectable()
export class CustomPinoLogger extends PinoLogger {
  info(msg: string, ...args: unknown[]): void;
  info(obj: unknown, msg?: string, ...args: unknown[]): void;
  info(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.info({ meta }, messageOrObj);
    } else {
      Reflect.apply(super.info as ForwardLogFn, this, [messageOrObj, ...args]);
    }
  }

  error(msg: string, ...args: unknown[]): void;
  error(obj: unknown, msg?: string, ...args: unknown[]): void;
  error(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === 'string' && args[0] instanceof Error) {
      super.error(args[0], messageOrObj);
      return;
    }
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.error({ meta }, messageOrObj);
    } else {
      Reflect.apply(super.error as ForwardLogFn, this, [messageOrObj, ...args]);
    }
  }

  warn(msg: string, ...args: unknown[]): void;
  warn(obj: unknown, msg?: string, ...args: unknown[]): void;
  warn(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.warn({ meta }, messageOrObj);
    } else {
      Reflect.apply(super.warn as ForwardLogFn, this, [messageOrObj, ...args]);
    }
  }

  debug(msg: string, ...args: unknown[]): void;
  debug(obj: unknown, msg?: string, ...args: unknown[]): void;
  debug(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === 'string' && args.length > 0) {
      const meta = serializeMeta(args[0]);
      super.debug({ meta }, messageOrObj);
    } else {
      Reflect.apply(super.debug as ForwardLogFn, this, [messageOrObj, ...args]);
    }
  }
}
