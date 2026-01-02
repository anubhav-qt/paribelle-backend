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

@Controller('upload')
export class UploadController {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_KYC_MIMETYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

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
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return files.map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }));
  }

  /**
   * Upload KYC documents (PDF, JPG, PNG only, max 5MB)
   * POST /api/v1/upload/kyc-documents
   */
  @Post('kyc-documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadKYCDocument(@UploadedFile() file: Express.Multer.File) {
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

    // In production, you would upload to S3 or other cloud storage
    // For now, storing locally
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
