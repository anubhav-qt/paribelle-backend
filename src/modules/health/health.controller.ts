import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

/**
 * Up and able to reach its database. Docker's health check on the ThinkPad and
 * the edge Worker's keep-warm ping on Render both call this.
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness, with a database round trip' })
  async check() {
    try {
      await Promise.race([
        this.dataSource.query('select 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 3000)),
      ]);
    } catch (e) {
      throw new ServiceUnavailableException(`database: ${(e as Error).message}`);
    }
    return { ok: true, release: process.env.RELEASE || 'dev' };
  }
}
