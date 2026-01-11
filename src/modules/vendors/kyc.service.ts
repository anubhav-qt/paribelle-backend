import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, KYCStatus, KYCDocument } from './vendor.entity';
import { User, UserRole } from '../users/user.entity';
import { ConfigService } from '@nestjs/config';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';

@Injectable()
export class KYCService {
  constructor(
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private emailService: SimpleEmailService,
  ) {
    // Initialize Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Submit KYC documents and business details for verification
   */
  async submitKYC(
    vendorId: string, 
    documents: KYCDocument[],
    businessDetails?: {
      businessName?: string;
      panNumber?: string;
      gstRegistrationType?: string;
      gstNumber?: string;
      gstState?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      bankAccountNumber?: string;
      bankIfscCode?: string;
      bankAccountName?: string;
    }
  ): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Validate required documents
    const requiredTypes = ['pan', 'aadhar_front', 'aadhar_back', 'bank_details', 'address_proof'];
    const submittedTypes = documents.map(d => d.type);
    const missingTypes = requiredTypes.filter(type => !submittedTypes.includes(type));

    if (missingTypes.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingTypes.join(', ')}`
      );
    }

    // Update vendor with KYC documents
    vendor.kycDocuments = documents;
    vendor.kycStatus = KYCStatus.SUBMITTED;
    vendor.kycSubmittedAt = new Date();
    vendor.kycRejectedReason = null; // Clear any previous rejection reason

    // Update business details if provided
    if (businessDetails) {
      if (businessDetails.businessName) {
        vendor.businessName = businessDetails.businessName;
      }
      if (businessDetails.panNumber) {
        vendor.panNumber = businessDetails.panNumber.toUpperCase();
      }
      if (businessDetails.gstRegistrationType) {
        vendor.gstRegistrationType = businessDetails.gstRegistrationType as any;
      }
      if (businessDetails.gstNumber) {
        vendor.gstNumber = businessDetails.gstNumber.toUpperCase();
      }
      if (businessDetails.gstState) {
        vendor.gstState = businessDetails.gstState;
      }
      if (businessDetails.address) {
        vendor.address = businessDetails.address;
      }
      if (businessDetails.city) {
        vendor.city = businessDetails.city;
      }
      if (businessDetails.state) {
        vendor.state = businessDetails.state;
      }
      if (businessDetails.pincode) {
        vendor.pincode = businessDetails.pincode;
      }
      if (businessDetails.bankAccountNumber) {
        vendor.bankAccountNumber = businessDetails.bankAccountNumber;
      }
      if (businessDetails.bankIfscCode) {
        vendor.bankIfscCode = businessDetails.bankIfscCode.toUpperCase();
      }
      if (businessDetails.bankAccountName) {
        vendor.bankAccountName = businessDetails.bankAccountName;
      }
    } else {
      // Fallback: Extract PAN number from document if provided
      const panDoc = documents.find(d => d.type === 'pan');
      if (panDoc?.documentNumber) {
        vendor.panNumber = panDoc.documentNumber.toUpperCase();
      }
    }

    // Extract GST state from GSTIN if not provided
    if (vendor.gstNumber && vendor.gstNumber.length >= 2 && !vendor.gstState) {
      const stateCode = vendor.gstNumber.substring(0, 2);
      const stateCodes: { [key: string]: string } = {
        '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu',
        '36': 'Telangana', '37': 'Andhra Pradesh', '07': 'Delhi', '06': 'Haryana',
        '09': 'Uttar Pradesh', '19': 'West Bengal', '24': 'Gujarat', '08': 'Rajasthan',
      };
      vendor.gstState = stateCodes[stateCode] || `State Code: ${stateCode}`;
    }

    await this.vendorRepository.save(vendor);

    // Send KYC documents to admin email and delete from Cloudinary
    // Do this asynchronously to not block KYC submission
    this.emailDocumentsToAdmin(vendor, documents).catch(error => {
      console.error('[KYC] Failed to email documents to admin:', error);
      console.error('[KYC] Error stack:', error.stack);
      // Don't throw - KYC submission should succeed even if email fails
    });

    return vendor;
  }

  /**
   * Approve vendor KYC
   */
  async approveKYC(vendorId: string, adminUserId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    vendor.kycStatus = KYCStatus.APPROVED;
    vendor.isKycVerified = true;
    vendor.kycApprovedAt = new Date();
    vendor.kycApprovedBy = adminUserId;
    vendor.kycRejectedReason = null;

    await this.vendorRepository.save(vendor);

    // Send approval email to vendor
    await this.sendKYCApprovalEmail(vendor);

    return vendor;
  }

  /**
   * Reject vendor KYC with reason
   */
  async rejectKYC(
    vendorId: string,
    reason: string,
    adminUserId: string,
  ): Promise<Vendor> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    vendor.kycStatus = KYCStatus.REJECTED;
    vendor.isKycVerified = false;
    vendor.kycRejectedReason = reason;

    await this.vendorRepository.save(vendor);

    // Send rejection email to vendor
    await this.sendKYCRejectionEmail(vendor, reason);

    return vendor;
  }

  /**
   * Get all vendors pending KYC review (for admin dashboard)
   */
  async getVendorsForKYCReview(): Promise<Vendor[]> {
    return this.vendorRepository.find({
      where: { kycStatus: KYCStatus.SUBMITTED },
      relations: ['user'],
      order: { kycSubmittedAt: 'ASC' },
    });
  }

  /**
   * Get KYC details for a specific vendor
   */
  async getKYCDetails(vendorId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  /**
   * Validate GSTIN format and extract information
   */
  validateGSTIN(gstin: string): { 
    valid: boolean; 
    state?: string; 
    pan?: string;
    error?: string;
  } {
    if (!gstin || gstin.length !== 15) {
      return { valid: false, error: 'GSTIN must be 15 characters long' };
    }

    // GSTIN format: 22AAAAA0000A1Z5
    // First 2 digits: State code (01-37)
    // Next 10 digits: PAN
    // 13th digit: Entity number (1-9 or alphabet)
    // 14th digit: Z (by default)
    // 15th digit: Check digit

    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);
    const entityNumber = gstin.charAt(12);
    const zChar = gstin.charAt(13);

    // Validate state code (01-37)
    const stateNum = parseInt(stateCode);
    if (isNaN(stateNum) || stateNum < 1 || stateNum > 37) {
      return { valid: false, error: 'Invalid state code in GSTIN' };
    }

    // Validate PAN format within GSTIN
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      return { valid: false, error: 'Invalid PAN format in GSTIN' };
    }

    // 14th character should typically be 'Z'
    if (zChar !== 'Z' && zChar !== 'z') {
      return { valid: false, error: 'Invalid GSTIN format (14th character)' };
    }

    return {
      valid: true,
      state: stateCode,
      pan: pan,
    };
  }

  /**
   * Email KYC documents to admin with attachments, then delete from Cloudinary
   */
  private async emailDocumentsToAdmin(vendor: Vendor, documents: KYCDocument[]): Promise<void> {
    try {
      console.log(`[KYC] ===== Starting emailDocumentsToAdmin =====`);
      console.log(`[KYC] Vendor: ${vendor.businessName || vendor.storeName}`);
      console.log(`[KYC] Documents count: ${documents.length}`);
      console.log(`[KYC] SMTP_HOST: ${this.configService.get('SMTP_HOST')}`);
      console.log(`[KYC] ADMIN_EMAIL: ${this.configService.get('ADMIN_EMAIL')}`);
      console.log(`[KYC] SMTP_FROM: ${this.configService.get('SMTP_FROM')}`);
      console.log(`[KYC] FRONTEND_URL: ${this.configService.get('FRONTEND_URL')}`);
      console.log(`[KYC] CLOUDINARY_CLOUD_NAME: ${this.configService.get('CLOUDINARY_CLOUD_NAME')}`);
      
      // Download all documents from Cloudinary as buffers
      const attachments: Array<{ filename: string; content: Buffer }> = [];
      const publicIdsToDelete: string[] = [];

      for (const doc of documents) {
        if (!doc.documentUrl) continue;

        try {
          // Download the document from Cloudinary
          const response = await axios.get(doc.documentUrl, { 
            responseType: 'arraybuffer',
            timeout: 30000 // 30 second timeout
          });
          
          // Extract filename from URL or use type
          const urlParts = doc.documentUrl.split('/');
          const fileName = doc.fileName || urlParts[urlParts.length - 1] || `${doc.type}.${this.getFileExtension(doc.documentUrl)}`;
          
          attachments.push({
            filename: fileName,
            content: Buffer.from(response.data),
          });

          // Extract public_id from Cloudinary URL for deletion
          // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
          const publicIdMatch = doc.documentUrl.match(/upload\/(?:v\d+\/)?([^.]+)/);
          if (publicIdMatch && publicIdMatch[1]) {
            publicIdsToDelete.push(publicIdMatch[1]);
          }

          console.log(`[KYC] Downloaded document: ${doc.type} - ${fileName}`);
        } catch (error) {
          console.error(`[KYC] Failed to download document ${doc.type}:`, error.message);
          // Continue with other documents even if one fails
        }
      }

      if (attachments.length === 0) {
        console.warn('[KYC] No documents could be downloaded for email');
        return;
      }

      // Get admin email from config
      const adminEmail = this.configService.get('ADMIN_EMAIL') || this.configService.get('SMTP_FROM');
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      const reviewUrl = `${frontendUrl}/admin/kyc-verification?vendorId=${vendor.id}`;

      // Send email with all documents attached
      await this.emailService.sendKYCDocumentsToAdmin(
        adminEmail,
        vendor,
        reviewUrl,
        attachments
      );

      console.log(`[KYC] Successfully emailed ${attachments.length} documents to admin: ${adminEmail}`);

      // Delete documents from Cloudinary to save space
      for (const publicId of publicIdsToDelete) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`[KYC] Deleted document from Cloudinary: ${publicId}`);
        } catch (error) {
          console.error(`[KYC] Failed to delete from Cloudinary (${publicId}):`, error.message);
          // Continue deleting others even if one fails
        }
      }

      console.log(`[KYC] Successfully deleted ${publicIdsToDelete.length} documents from Cloudinary`);
      console.log(`[KYC] ===== emailDocumentsToAdmin completed successfully =====`);

    } catch (error) {
      console.error('[KYC] ===== Error in emailDocumentsToAdmin =====');
      console.error('[KYC] Error message:', error.message);
      console.error('[KYC] Error stack:', error.stack);
      console.error('[KYC] Error details:', JSON.stringify(error, null, 2));
      // Don't throw - log error but don't block KYC submission
    }
  }

  /**
   * Extract file extension from URL
   */
  private getFileExtension(url: string): string {
    const match = url.match(/\\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    return match ? match[1] : 'jpg';
  }

  /**
   * Notify admins of new KYC submission
   * In production, this would use an email service
   */
  private async notifyAdminsOfKYCSubmission(vendor: Vendor): Promise<void> {
    try {
      // Get all admin users
      const admins = await this.userRepository.find({
        where: { role: UserRole.SUPER_ADMIN },
      });

      const adminUrl = process.env.ADMIN_URL || process.env.FRONTEND_URL;
      const reviewUrl = `${adminUrl}/admin/kyc-verification?vendorId=${vendor.id}`;

      console.log(`[KYC] New submission from vendor: ${vendor.businessName || vendor.storeName}`);
      console.log(`[KYC] Review URL: ${reviewUrl}`);
      console.log(`[KYC] Admins to notify: ${admins.length}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: admin.email,
      //   subject: `New KYC Submission - ${vendor.businessName || vendor.storeName}`,
      //   template: 'kyc-submission-admin',
      //   context: { vendor, reviewUrl }
      // });
    } catch (error) {
      console.error('Error notifying admins:', error);
      // Don't throw error - KYC submission should succeed even if notification fails
    }
  }

  /**
   * Send KYC approval email to vendor
   */
  private async sendKYCApprovalEmail(vendor: Vendor): Promise<void> {
    try {
      console.log(`[KYC] Approval email to: ${vendor.user.email}`);
      console.log(`[KYC] Vendor: ${vendor.businessName || vendor.storeName}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: vendor.user.email,
      //   subject: 'KYC Verification Approved - Your account is now active!',
      //   template: 'kyc-approved',
      //   context: {
      //     vendorName: vendor.businessName || vendor.storeName,
      //     approvedDate: vendor.kycApprovedAt.toLocaleDateString(),
      //   }
      // });
    } catch (error) {
      console.error('Error sending approval email:', error);
    }
  }

  /**
   * Send KYC rejection email to vendor
   */
  private async sendKYCRejectionEmail(vendor: Vendor, reason: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL;
      const resubmitUrl = `${frontendUrl}/vendor/kyc`;

      console.log(`[KYC] Rejection email to: ${vendor.user.email}`);
      console.log(`[KYC] Vendor: ${vendor.businessName || vendor.storeName}`);
      console.log(`[KYC] Reason: ${reason}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: vendor.user.email,
      //   subject: 'KYC Verification - Additional Information Required',
      //   template: 'kyc-rejected',
      //   context: {
      //     vendorName: vendor.businessName || vendor.storeName,
      //     reason: reason,
      //     resubmitUrl: resubmitUrl,
      //   }
      // });
    } catch (error) {
      console.error('Error sending rejection email:', error);
    }
  }
}
