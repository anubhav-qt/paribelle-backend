import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // Use memory storage for Cloudinary upload
      fileFilter: (req, file, callback) => {
        // Videos are here for the exchange-request proof clip
        // (`POST upload/exchange-video`); that route re-checks the mimetype
        // and applies its own, larger size limit — this is the outer gate.
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|pdf|mp4|mov|webm|mkv|3gp)$/i)) {
          return callback(new Error('Only image, PDF and video files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        // The widest any route accepts (exchange videos). Images and KYC
        // documents are held to 5MB by the controller, which checks
        // `file.size` after multer has buffered it.
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
