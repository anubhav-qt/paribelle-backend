import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Return } from '../orders/return.entity';

/**
 * Every way a customer's wallet balance can move. `amount` is signed:
 * positive for a credit, negative for a spend, so `SUM(amount)` for a user
 * is always their current balance.
 */
export enum WalletLedgerType {
  OPENING_BALANCE = 'opening_balance',
  REFERRAL_CREDIT = 'referral_credit',
  EXCHANGE_CREDIT = 'exchange_credit',
  COD_REFUSAL_CREDIT = 'cod_refusal_credit',
  ADMIN_CANCEL_CREDIT = 'admin_cancel_credit',
  CHECKOUT_SPEND = 'checkout_spend',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}

@Entity('wallet_ledger')
export class WalletLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar' })
  type: WalletLedgerType;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Return, { nullable: true })
  @JoinColumn({ name: 'exchange_id' })
  exchange: Return | null;

  @Column({ type: 'uuid', name: 'exchange_id', nullable: true })
  exchangeId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
