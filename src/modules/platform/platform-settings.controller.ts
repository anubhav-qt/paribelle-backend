import { Controller, Get, Put, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto, CompletePlatformKYCDto, ValidateGSTINDto } from './dto/platform-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  /**
   * GET /platform/settings
   * Get platform settings (Super Admin only)
   */
  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
  async getPlatformSettings(@Request() req) {
    return this.platformSettingsService.getPlatformSettings();
  }

  /**
   * PUT /platform/settings
   * Update platform settings (Super Admin only)
   */
  @Put('settings')
  @Roles(UserRole.SUPER_ADMIN)
  async updatePlatformSettings(
    @Body() updateDto: UpdatePlatformSettingsDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.platformSettingsService.updatePlatformSettings(updateDto, userId);
  }

  /**
   * POST /platform/kyc/complete
   * Complete platform KYC submission (Super Admin only)
   */
  @Post('kyc/complete')
  @Roles(UserRole.SUPER_ADMIN)
  async completePlatformKYC(
    @Body() kycDto: CompletePlatformKYCDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.platformSettingsService.completePlatformKYC(kycDto, userId);
  }

  /**
   * POST /platform/kyc/validate-gstin
   * Validate GSTIN format (Super Admin only)
   */
  @Post('kyc/validate-gstin')
  @Roles(UserRole.SUPER_ADMIN)
  async validateGSTIN(@Body() validateDto: ValidateGSTINDto) {
    return this.platformSettingsService.validateGSTIN(validateDto.gstin);
  }

  /**
   * GET /platform/kyc/status
   * Check if platform KYC is complete (Super Admin only)
   */
  @Get('kyc/status')
  @Roles(UserRole.SUPER_ADMIN)
  async getKYCStatus() {
    const isComplete = await this.platformSettingsService.isPlatformKYCComplete();
    return { kycComplete: isComplete };
  }

  /**
   * GET /platform/gstin
   * Get platform GSTIN (for invoice generation - accessible by vendors)
   */
  @Get('gstin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  async getPlatformGSTIN() {
    const gstin = await this.platformSettingsService.getPlatformGSTIN();
    return { gstin };
  }

  /**
   * GET /platform/commission
   * Get platform commission percentage (accessible by vendors)
   */
  @Get('commission')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  async getCommissionPercentage() {
    const commission = await this.platformSettingsService.getCommissionPercentage();
    return { commissionPercentage: commission };
  }
}
