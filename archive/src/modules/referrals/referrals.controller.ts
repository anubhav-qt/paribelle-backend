import { Controller, Get, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('validate/:code')
  async validateReferralCode(@Param('code') code: string, @Request() req) {
    try {
      const userId = req.user?.id; // Optional - user might not be logged in
      const referrer = await this.referralsService.validateReferralCode(code, userId);
      
      return {
        valid: true,
        referrerName: `${referrer.firstName} ${referrer.lastName}`,
        message: `Referred by ${referrer.firstName} ${referrer.lastName}`,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-code')
  async getMyReferralCode(@Request() req) {
    const user = req.user;
    return {
      code: user.referralCode,
      shareUrl: `${process.env.FRONTEND_URL}/vendor-registration?ref=${user.referralCode}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getReferralStats(@Request() req) {
    const userId = req.user.id;
    return this.referralsService.getReferralStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('calculate-fee')
  async calculateFee(@Request() req) {
    const referralCode = req.query.code as string;
    return this.referralsService.calculateDiscountedFee(referralCode);
  }
}
