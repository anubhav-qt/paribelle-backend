import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CloudinaryService } from './cloudinary.service';

/**
 * Service for cleaning up files from storage
 * Handles both local filesystem and Cloudinary
 */
@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);
  private readonly uploadsDir = join(process.cwd(), 'public', 'uploads');

  constructor(private cloudinaryService: CloudinaryService) {}

  /**
   * Delete a single file from storage
   * Tries Cloudinary first, then falls back to local filesystem
   * Skips external URLs (Unsplash, etc.)
   * @param fileUrl - The file URL (e.g., '/uploads/image.jpg' or Cloudinary URL)
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    try {
      // Skip external URLs (Unsplash, external CDNs, etc.)
      if (this.isExternalUrl(fileUrl)) {
        this.logger.log(`Skipping external URL: ${fileUrl}`);
        return;
      }

      // Try Cloudinary deletion first if it's a Cloudinary URL or if Cloudinary is enabled
      if (this.cloudinaryService.isEnabled() && this.isCloudinaryUrl(fileUrl)) {
        await this.cloudinaryService.deleteImage(fileUrl);
        return;
      }

      // Fall back to local filesystem deletion
      const filename = this.extractFilename(fileUrl);
      if (!filename) return;

      const filePath = join(this.uploadsDir, filename);

      // Check if file exists before attempting deletion
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted local file: ${filename}`);
      } else {
        this.logger.warn(`File not found: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileUrl}:`, error.message);
      // Don't throw - we don't want to block deletion if file cleanup fails
    }
  }

  /**
   * Check if URL is an external URL (Unsplash, external CDN, etc.)
   * Should NOT be deleted as they're not owned by us
   * 
   * NOTE: These services should ONLY be used for testing/demo purposes!
   * In production, vendors must upload their own product images.
   * Using stock photos for real products may violate licenses and mislead customers.
   */
  private isExternalUrl(url: string): boolean {
    if (!url.startsWith('http')) return false;
    
    // List of external domains to skip (for testing/demo only)
    const externalDomains = [
      'unsplash.com',           // Free stock photos (testing only)
      'images.unsplash.com',
      'source.unsplash.com',
      'picsum.photos',          // Lorem Picsum (testing only)
      'via.placeholder.com',    // Placeholder generator
      'placehold.co',           // Placeholder generator
      'loremflickr.com',        // ⚠️ Mixed licenses - avoid in production
      'dummyimage.com',         // Placeholder generator
    ];

    return externalDomains.some(domain => url.includes(domain));
  }

  /**
   * Check if URL is a Cloudinary URL
   */
  private isCloudinaryUrl(url: string): boolean {
    return url.includes('cloudinary.com') || url.includes('res.cloudinary');
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
