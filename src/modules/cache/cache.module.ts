import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Use in-memory cache by default (no Redis required)
        // For production, set USE_REDIS=true in .env and install Redis
        const useRedis = configService.get('USE_REDIS', 'false') === 'true';
        
        if (useRedis) {
          try {
            const redisStore = require('cache-manager-redis-store');
            return {
              store: redisStore,
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
              ttl: configService.get('CACHE_TTL', 300),
              max: 1000,
            };
          } catch (error) {
            console.warn('Redis not available, falling back to in-memory cache');
          }
        }
        
        // In-memory cache (works without Redis)
        return {
          ttl: configService.get('CACHE_TTL', 300), // 5 minutes default
          max: 1000, // maximum number of items in cache
        };
      },
      isGlobal: true, // Make cache available globally
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
