import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';

/**
 * Service for uploading and managing images on Cloudinary
 * Includes automatic image compression and optimization
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeCloudinary();
  }

  private initializeCloudinary() {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.isConfigured = true;
      this.logger.log('Cloudinary configured successfully');
    } else {
      this.logger.warn('Cloudinary not configured - missing credentials');
    }
  }

  /**
   * Check if Cloudinary is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Upload a single image with compression
   * @param buffer - Image buffer
   * @param folder - Cloudinary folder path
   * @param options - Additional upload options
   * @returns Cloudinary upload result with URL
   */
  async uploadImage(
    buffer: Buffer,
    folder: string = 'marketplace',
    options: {
      maxWidth?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {},
  ): Promise<UploadApiResponse> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      // Default compression settings
      const maxWidth = options.maxWidth || 1920;
      const quality = options.quality || 80;
      const format = options.format || 'jpeg';

      // Compress image using sharp
      const compressedBuffer = await this.compressImage(buffer, {
        maxWidth,
        quality,
        format,
      });

      // Upload to Cloudinary
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            format,
          },
          (error, result) => {
            if (error || !result) {
              this.logger.error('Cloudinary upload failed:', error);
              reject(error || new Error('Upload failed'));
            } else {
              this.logger.log(`Image uploaded: ${result.public_id}`);
              resolve(result);
            }
          },
        );

        uploadStream.end(compressedBuffer);
      });
    } catch (error) {
      this.logger.error('Image upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Upload a video as-is. Unlike images these are not passed through sharp —
   * Cloudinary's own `quality: auto` transcode is what keeps the file small,
   * and the source is a phone clip a customer shot of a faulty item, where
   * re-encoding locally would only cost us time and fidelity.
   *
   * @param buffer - Video buffer
   * @param folder - Cloudinary folder path
   */
  async uploadVideo(buffer: Buffer, folder: string = 'marketplace'): Promise<UploadApiResponse> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'video', quality: 'auto' },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary video upload failed:', error);
            reject(error || new Error('Upload failed'));
          } else {
            this.logger.log(`Video uploaded: ${result.public_id}`);
            resolve(result);
          }
        },
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Upload multiple images with compression
   * @param buffers - Array of image buffers
   * @param folder - Cloudinary folder path
   * @param options - Compression options
   * @returns Array of Cloudinary URLs
   */
  async uploadMultipleImages(
    buffers: Buffer[],
    folder: string = 'marketplace',
    options?: { maxWidth?: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' },
  ): Promise<UploadApiResponse[]> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    const uploadPromises = buffers.map(buffer =>
      this.uploadImage(buffer, folder, options),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Compress image using sharp
   * @param buffer - Original image buffer
   * @param options - Compression settings
   * @returns Compressed image buffer
   */
  private async compressImage(
    buffer: Buffer,
    options: {
      maxWidth: number;
      quality: number;
      format: 'jpeg' | 'png' | 'webp';
    },
  ): Promise<Buffer> {
    const { maxWidth, quality, format } = options;

    let sharpInstance = sharp(buffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();

    // Resize if image is larger than maxWidth
    if (metadata.width > maxWidth) {
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format-specific compression
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return sharpInstance.toBuffer();
  }

  /**
   * Delete image from Cloudinary
   * @param publicId - Cloudinary public_id or full URL
   * @returns Deletion result
   */
  async deleteImage(publicId: string): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn('Cloudinary not configured - skipping deletion');
      return;
    }

    try {
      // Extract public_id from URL if needed
      const extractedPublicId = this.extractPublicId(publicId);
      
      if (!extractedPublicId) {
        this.logger.warn(`Invalid public_id: ${publicId}`);
        return;
      }

      const result = await cloudinary.uploader.destroy(extractedPublicId);
      this.logger.log(`Deleted image: ${extractedPublicId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete image ${publicId}:`, error.message);
      // Don't throw - we don't want to block operations if deletion fails
    }
  }

  /**
   * Delete multiple images from Cloudinary
   * @param publicIds - Array of public_ids or URLs
   */
  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    if (!this.isConfigured || !publicIds || publicIds.length === 0) {
      return;
    }

    await Promise.all(publicIds.map(id => this.deleteImage(id)));
    this.logger.log(`Deleted ${publicIds.length} images from Cloudinary`);
  }

  /**
   * Extract Cloudinary public_id from URL
   * Examples:
   * - https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg -> demo/sample
   * - marketplace/products/abc123.jpg -> marketplace/products/abc123
   */
  private extractPublicId(urlOrId: string): string | null {
    if (!urlOrId) return null;

    // If it's already a public_id (no http/https)
    if (!urlOrId.startsWith('http')) {
      // Remove file extension if present
      return urlOrId.replace(/\.[^/.]+$/, '');
    }

    try {
      // Extract from Cloudinary URL
      const matches = urlOrId.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      return matches ? matches[1] : null;
    } catch (error) {
      this.logger.error(`Failed to extract public_id from: ${urlOrId}`);
      return null;
    }
  }

  /**
   * Get optimized image URL with transformations
   * @param publicId - Cloudinary public_id
   * @param width - Desired width
   * @param height - Desired height
   * @returns Cloudinary URL with transformations
   */
  getOptimizedUrl(publicId: string, width?: number, height?: number): string {
    if (!this.isConfigured) {
      return publicId;
    }

    const transformations: any = {
      quality: 'auto',
      fetch_format: 'auto',
    };

    if (width) transformations.width = width;
    if (height) transformations.height = height;

    return cloudinary.url(publicId, transformations);
  }

  /**
   * List all images in a Cloudinary folder
   * @param folder - Folder path (e.g., 'marketplace/products')
   * @param maxResults - Maximum number of results to return
   * @returns Array of image resources with public_ids and URLs
   */
  async listImages(folder: string = 'marketplace', maxResults: number = 500): Promise<any[]> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const allImages: any[] = [];
      let nextCursor: string | undefined;

      // Cloudinary API returns paginated results, fetch all pages
      do {
        const result = await cloudinary.api.resources({
          type: 'upload',
          prefix: folder,
          max_results: Math.min(maxResults, 500), // API limit is 500 per request
          next_cursor: nextCursor,
        });

        allImages.push(...result.resources);
        nextCursor = result.next_cursor;

        // Stop if we've reached the max or no more results
        if (allImages.length >= maxResults || !nextCursor) {
          break;
        }
      } while (nextCursor);

      this.logger.log(`Found ${allImages.length} images in folder: ${folder}`);
      return allImages;
    } catch (error) {
      this.logger.error(`Failed to list images in folder ${folder}:`, error.message);
      throw error;
    }
  }

  /**
   * Find and optionally delete orphan images not referenced in the provided URLs
   * @param folder - Cloudinary folder to check
   * @param referencedUrls - Array of URLs that are currently in use
   * @param deleteOrphans - If true, delete orphan images; if false, just return them
   * @returns Object with orphan image details and deletion results
   */
  async cleanupOrphanImages(
    folder: string = 'marketplace/products',
    referencedUrls: string[],
    deleteOrphans: boolean = false,
  ): Promise<{ 
    total: number; 
    orphans: string[]; 
    deleted: number; 
    errors: string[];
  }> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      // Get all images in the folder
      const allImages = await this.listImages(folder);
      
      // Extract public_ids from referenced URLs
      const referencedPublicIds = new Set(
        referencedUrls
          .map(url => this.extractPublicId(url))
          .filter(id => id !== null)
      );

      // Find orphans - images in Cloudinary not in referenced set
      const orphanImages = allImages.filter(
        image => !referencedPublicIds.has(image.public_id)
      );

      const orphanPublicIds = orphanImages.map(img => img.public_id);
      
      this.logger.log(`Found ${orphanImages.length} orphan images out of ${allImages.length} total`);

      let deleted = 0;
      const errors: string[] = [];

      // Delete orphans if requested
      if (deleteOrphans && orphanPublicIds.length > 0) {
        this.logger.log(`Deleting ${orphanPublicIds.length} orphan images...`);
        
        for (const publicId of orphanPublicIds) {
          try {
            await this.deleteImage(publicId);
            deleted++;
          } catch (error) {
            errors.push(`Failed to delete ${publicId}: ${error.message}`);
          }
        }
        
        this.logger.log(`Deleted ${deleted} orphan images with ${errors.length} errors`);
      }

      return {
        total: allImages.length,
        orphans: orphanPublicIds,
        deleted,
        errors,
      };
    } catch (error) {
      this.logger.error('Failed to cleanup orphan images:', error.message);
      throw error;
    }
  }
}
