import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Request() req) {
    const balance = await this.walletService.getBalance(req.user.id);
    return { balance };
  }

  @Get('ledger')
  async getLedger(@Request() req) {
    return this.walletService.getLedger(req.user.id);
  }
}
