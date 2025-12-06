import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from '../../modules/monitoring/monitoring.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(
    @Inject(MonitoringService)
    private readonly monitoringService: MonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - start;
        
        // Add to monitoring service
        this.monitoringService.addLog({
          timestamp: new Date().toISOString(),
          level: responseTime > 1000 ? 'WARN' : 'INFO',
          method,
          url,
          duration: responseTime,
          message: `${method} ${url}`,
        });
        
        // Log slow queries
        if (responseTime > 1000) {
          this.logger.warn(`[SLOW] ${method} ${url} - ${responseTime}ms`);
        }
        
        // Log all requests in production
        this.logger.log(`${method} ${url} - ${responseTime}ms`);
      }),
    );
  }
}
