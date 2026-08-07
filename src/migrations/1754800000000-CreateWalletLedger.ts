import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.wallet_balance` has been a bare mutable number: every credit or
 * debit just adds/subtracts on the column, with no record of why. That's
 * fine until a customer disputes their balance — there is nothing to show
 * them. This adds an append-only ledger; `wallet_balance` stays as a
 * denormalized cache for fast reads, but every future write goes through
 * `WalletService`, which writes a ledger row and updates the cache in the
 * same transaction, so the two can never drift apart from this point on.
 *
 * Existing balances (e.g. from `referral_transactions`) are backfilled with
 * one opening-balance ledger row each, so SUM(ledger) reconciles with the
 * cached column immediately rather than only for movements made from here on.
 */
export class CreateWalletLedger1754800000000 implements MigrationInterface {
  name = 'CreateWalletLedger1754800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(40) NOT NULL,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        exchange_id UUID REFERENCES returns(id) ON DELETE SET NULL,
        description TEXT,
        balance_after DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created ON wallet_ledger(user_id, created_at DESC)`,
    );

    await queryRunner.query(`
      INSERT INTO wallet_ledger (user_id, amount, type, description, balance_after, created_at)
      SELECT id, wallet_balance, 'opening_balance', 'Balance carried over from before the wallet ledger existed', wallet_balance, now()
      FROM users
      WHERE wallet_balance IS NOT NULL AND wallet_balance <> 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wallet_ledger`);
  }
}
