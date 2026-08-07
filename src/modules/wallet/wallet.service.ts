import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletLedger, WalletLedgerType } from './wallet-ledger.entity';
import { User } from '../users/user.entity';

interface MoveOptions {
  orderId?: string | null;
  exchangeId?: string | null;
  description?: string | null;
}

/**
 * The single place wallet_balance is written. Every credit or debit takes
 * a row lock on the user, writes one append-only ledger entry, and updates
 * the cached balance column in the same transaction — so the column and
 * `SUM(ledger.amount)` for that user can never disagree.
 */
@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletLedger)
    private ledgerRepository: Repository<WalletLedger>,
    private dataSource: DataSource,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, select: ['walletBalance'] });
    return Number(user?.walletBalance) || 0;
  }

  async getLedger(userId: string): Promise<WalletLedger[]> {
    return this.ledgerRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Adds money to a user's wallet. Always succeeds if the user exists. */
  async credit(
    userId: string,
    amount: number,
    type: WalletLedgerType,
    options: MoveOptions = {},
  ): Promise<{ balance: number }> {
    if (!(amount > 0)) {
      throw new BadRequestException('Credit amount must be positive');
    }
    return this.move(userId, Number(amount.toFixed(2)), type, options);
  }

  /** Removes money from a user's wallet. Throws if the balance is insufficient. */
  async debit(
    userId: string,
    amount: number,
    type: WalletLedgerType,
    options: MoveOptions = {},
  ): Promise<{ balance: number }> {
    if (!(amount > 0)) {
      throw new BadRequestException('Debit amount must be positive');
    }
    return this.move(userId, -Number(amount.toFixed(2)), type, options);
  }

  private async move(
    userId: string,
    signedAmount: number,
    type: WalletLedgerType,
    options: MoveOptions,
  ): Promise<{ balance: number }> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .getOne();
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const currentBalance = Number(user.walletBalance) || 0;
      const newBalance = Number((currentBalance + signedAmount).toFixed(2));
      if (newBalance < 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await manager.update(User, userId, { walletBalance: newBalance });

      const ledgerRow = manager.create(WalletLedger, {
        userId,
        amount: signedAmount,
        type,
        orderId: options.orderId || null,
        exchangeId: options.exchangeId || null,
        description: options.description || null,
        balanceAfter: newBalance,
      });
      await manager.save(WalletLedger, ledgerRow);

      return { balance: newBalance };
    });
  }
}
