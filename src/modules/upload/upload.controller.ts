import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CloudinaryService } from '../../common/services/cloudinary.service';

// Define Multer File type to avoid Express namespace issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Controller('upload')
export class UploadController {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_KYC_MIMETYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  private readonly ALLOWED_IMAGE_MIMETYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
  ];

  /**
   * Exchange-proof clips are shot on a phone and uploaded straight from the
   * exchange request form, so the limit is generously above the image one —
   * a 30-second 1080p clip lands around 40MB. Kept in step with the multer
   * `limits.fileSize` in UploadModule, which rejects anything larger before
   * it is ever buffered.
   */
  private readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly ALLOWED_VIDEO_MIMETYPES = [
    'video/mp4',
    'video/quicktime', // .mov — what iPhones record
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
  ];

  constructor(private cloudinaryService: CloudinaryService) {}

  /**
   * The image routes previously accepted anything of any size. Multer has
   * already buffered the file by the time we get here, so this is a backstop
   * rather than a bandwidth limit — but it keeps non-images out of Cloudinary.
   */
  private assertUploadableImage(file: MulterFile) {
    if (!this.ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${this.ALLOWED_IMAGE_MIMETYPES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `"${file.originalname}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  @Post('image')
  @AdminOnly()
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.assertUploadableImage(file);

    // If Cloudinary is configured, upload there with compression
    if (this.cloudinaryService.isEnabled()) {
      const result = await this.cloudinaryService.uploadImage(
        file.buffer,
        'marketplace/products',
        { maxWidth: 1920, quality: 80, format: 'jpeg' }
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
        filename: file.originalname,
        originalName: file.originalname,
        size: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    }

    // Fallback to local storage
    const fileUrl = `/uploads/${file.filename}`;
    return {
      url: fileUrl,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('images')
  @AdminOnly()
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    files.forEach((file) => this.assertUploadableImage(file));

    // If Cloudinary is configured, upload there with compression
    if (this.cloudinaryService.isEnabled()) {
      const uploadPromises = files.map(file =>
        this.cloudinaryService.uploadImage(
          file.buffer,
          'marketplace/products',
          { maxWidth: 1920, quality: 80, format: 'jpeg' }
        )
      );

      const results = await Promise.all(uploadPromises);

      return results.map((result, index) => ({
        url: result.secure_url,
        publicId: result.public_id,
        filename: files[index].originalname,
        originalName: files[index].originalname,
        size: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
      }));
    }

    // Fallback to local storage
    return files.map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }));
  }

  /**
   * The video a customer must attach to an exchange request — see
   * `ExchangesService.request`, which refuses a request without one. Any
   * signed-in shopper can call this (not `@AdminOnly()` like the product
   * image routes): it is part of their own exchange flow.
   *
   * POST /api/v1/upload/exchange-video
   */
  @Post('exchange-video')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadExchangeVideo(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `"${file.originalname}" is not a video we can read. Please upload an MP4, MOV or WebM clip.`,
      );
    }

    if (file.size > this.MAX_VIDEO_SIZE) {
      throw new BadRequestException(
        `"${file.originalname}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${this.MAX_VIDEO_SIZE / 1024 / 1024}MB. ` +
        'Try a shorter clip or record at a lower resolution.',
      );
    }

    if (this.cloudinaryService.isEnabled()) {
      const result = await this.cloudinaryService.uploadVideo(file.buffer, 'marketplace/exchanges');
      return {
        url: result.secure_url,
        publicId: result.public_id,
        originalName: file.originalname,
        size: result.bytes,
        duration: result.duration,
        format: result.format,
      };
    }

    // Local-storage fallback, same shape as the image routes above.
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * Upload KYC documents (PDF, JPG, PNG only, max 5MB)
   * POST /api/v1/upload/kyc-documents
   */
  @Post('kyc-documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadKYCDocument(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Validate file type
    if (!this.ALLOWED_KYC_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, JPG, and PNG files are allowed for KYC documents'
      );
    }

    // If Cloudinary is configured, upload there
    if (this.cloudinaryService.isEnabled() && file.mimetype.startsWith('image/')) {
      const result = await this.cloudinaryService.uploadImage(
        file.buffer,
        'marketplace/kyc',
        { maxWidth: 2048, quality: 90, format: 'jpeg' }
      );

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        filename: file.originalname,
        originalName: file.originalname,
        size: result.bytes,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };
    }

    // Fallback to local storage for PDFs or when Cloudinary is not configured
    const fileUrl = `/uploads/kyc/${file.filename}`;
    
    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };
  }
}
