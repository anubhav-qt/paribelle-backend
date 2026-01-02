import { Global, Module } from '@nestjs/common';
import { FileCleanupService } from './services/file-cleanup.service';

/**
 * Global module for common services used across the application
 * Services provided here are available in all modules without explicit imports
 */
@Global()
@Module({
  providers: [FileCleanupService],
  exports: [FileCleanupService],
})
export class CommonModule {}
