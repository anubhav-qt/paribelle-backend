import { Injectable, Logger } from '@nestjs/common';

export interface LogEntry {
  timestamp: string;
  level: string;
  method?: string;
  url?: string;
  duration?: number;
  message: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000; // Keep last 1000 logs

  addLog(log: LogEntry) {
    this.logs.push(log);
    
    // Keep only the last MAX_LOGS entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  getLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit).reverse();
  }

  getSlowRequests(threshold: number = 1000, limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.duration && log.duration > threshold)
      .slice(-limit)
      .reverse();
  }

  clearLogs() {
    this.logs = [];
    this.logger.log('Logs cleared');
  }

  getStats() {
    const total = this.logs.length;
    const slow = this.logs.filter(log => log.duration && log.duration > 1000).length;
    const avgDuration = this.logs.length > 0
      ? this.logs.reduce((sum, log) => sum + (log.duration || 0), 0) / this.logs.length
      : 0;

    return {
      totalRequests: total,
      slowRequests: slow,
      averageResponseTime: Math.round(avgDuration),
      slowRequestPercentage: total > 0 ? ((slow / total) * 100).toFixed(2) : 0,
    };
  }
}
