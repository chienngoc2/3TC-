import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - now;
          this.logger.log(`[${method}] ${url} - completed in ${elapsed}ms`);
        },
        error: (err) => {
          const elapsed = Date.now() - now;
          const status = err?.status || err?.statusCode || 500;
          this.logger.error(`[${method}] ${url} - failed (${status}) in ${elapsed}ms: ${err?.message}`);
        },
      }),
    );
  }
}
