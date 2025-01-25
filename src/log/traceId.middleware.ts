import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import requestNamespace, { setTraceId } from './request.namespace';


@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const traceId = req.headers['x-trace-id'] || randomUUID();

    requestNamespace.run(() => {
      setTraceId(traceId);
      next();
    });
  }
}