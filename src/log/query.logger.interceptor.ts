import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getTraceId } from './request.namespace';
import { WinstonLoggerService } from './winston.logger.service';
import { JwtUser } from '../types/jtw-user';

@Injectable()
export class QueryLoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: WinstonLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // 监控路由排除打印
    const excludedRoutes = ['/metrics'];
    if (excludedRoutes.includes(request.url)) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse();
    const user = request.user as JwtUser | undefined;
    const userId = user?.sub;
    const startTime = Date.now();
    return next.handle().pipe(
      tap(() => {
        // 请求处理完成时执行
        const duration = Date.now() - startTime;
        const traceId = getTraceId();
        const logContent = this.log(
          traceId,
          request.path,
          request.url,
          userId,
          duration,
          request.method,
          response.statusCode
        );
        this.logger.logQuery(logContent);
      }),
    );
  }

  log(traceId: string, request_path: string, request_url: string, user_id: string | undefined, totalTime: number, method: string, statusCode: number) {
    const logContent = `TRACE_ID: ${traceId} TIME: ${new Date().toISOString()} REQUEST_PATH: ${request_path} REQUEST_URL: ${request_url} USER_ID: ${user_id || 'N/A'} TOTAL_TIME: ${totalTime}ms REQUEST_METHOD: ${method} STATUS_CODE: ${statusCode}`;
    return logContent;
  }
}