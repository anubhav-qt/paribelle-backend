import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exchanging for a pricier product used to be rejected outright — the
 * customer had to take full store credit and place a brand new order
 * instead. These columns let the exchange itself carry the price gap and how
 * the customer chose to cover it (existing wallet balance, or COD on the
 * replacement), so `ExchangesService.request`/`createReplacementOrder` no
 * longer need to reject a more expensive replacement.
 */
export class AddTopUpToReturns1755000000000 implements MigrationInterface {
  name = 'AddTopUpToReturns1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS top_up_amount DECIMAL(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS top_up_payment_method VARCHAR NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS top_up_payment_method`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS top_up_amount`);
  }
}
