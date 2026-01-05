import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileCleanupService } from './services/file-cleanup.service';
import { CloudinaryService } from './services/cloudinary.service';

/**
 * Global module for common services used across the application
 * Services provided here are available in all modules without explicit imports
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CloudinaryService, FileCleanupService],
  exports: [CloudinaryService, FileCleanupService],
})
export class CommonModule {}
