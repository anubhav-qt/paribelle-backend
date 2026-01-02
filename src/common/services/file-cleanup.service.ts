import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Service for cleaning up files from storage
 * Handles both local filesystem and will support S3 in the future
 */
@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);
  private readonly uploadsDir = join(process.cwd(), 'public', 'uploads');

  /**
   * Delete a single file from storage
   * @param fileUrl - The file URL (e.g., '/uploads/image.jpg' or full URL)
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    try {
      // Extract filename from URL
      const filename = this.extractFilename(fileUrl);
      if (!filename) return;

      const filePath = join(this.uploadsDir, filename);

      // Check if file exists before attempting deletion
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted file: ${filename}`);
      } else {
        this.logger.warn(`File not found: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileUrl}:`, error.message);
      // Don't throw - we don't want to block deletion if file cleanup fails
    }
  }

  /**
   * Delete multiple files from storage
   * @param fileUrls - Array of file URLs
   */
  async deleteFiles(fileUrls: string[]): Promise<void> {
    if (!fileUrls || fileUrls.length === 0) return;

    // Delete files in parallel for better performance
    await Promise.all(
      fileUrls.map(url => this.deleteFile(url))
    );

    this.logger.log(`Deleted ${fileUrls.length} files`);
  }

  /**
   * Extract filename from URL
   * Handles: '/uploads/image.jpg', 'http://domain.com/uploads/image.jpg', 'image.jpg'
   */
  private extractFilename(url: string): string | null {
    if (!url) return null;

    // Remove query parameters and hash
    const cleanUrl = url.split('?')[0].split('#')[0];

    // Extract filename from URL
    if (cleanUrl.includes('/uploads/')) {
      return cleanUrl.split('/uploads/')[1];
    }

    // If it's just a filename
    if (!cleanUrl.includes('/')) {
      return cleanUrl;
    }

    // Extract last part of path
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Delete files associated with an entity's image fields
   * @param entity - The entity containing image URLs
   * @param imageFields - Array of field names that contain image URLs
   */
  async deleteEntityImages(entity: any, imageFields: string[]): Promise<void> {
    if (!entity) return;

    const filesToDelete: string[] = [];

    for (const field of imageFields) {
      const value = entity[field];
      
      if (!value) continue;

      // Handle array of images
      if (Array.isArray(value)) {
        filesToDelete.push(...value);
      } 
      // Handle single image
      else if (typeof value === 'string') {
        filesToDelete.push(value);
      }
    }

    await this.deleteFiles(filesToDelete);
  }
}
