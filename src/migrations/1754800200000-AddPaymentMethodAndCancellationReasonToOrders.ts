import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two small, unrelated columns bundled in one migration since both are
 * "store the real thing instead of inferring/parsing it" fixes on `orders`:
 *
 * - `payment_method`: was never stored. The admin UI derived it from
 *   `payment_status` (`pending` -> cod, anything else -> razorpay), so any
 *   COD order marked paid displayed as razorpay. Backfilled from existing
 *   data using that same (best-effort) inference, since the real method
 *   for historic orders was never recorded.
 * - `cancellation_reason`: the reason was already captured, just appended
 *   into `customer_notes`/`admin_notes` free text and never surfaced.
 */
export class AddPaymentMethodAndCancellationReasonToOrders1754800200000 implements MigrationInterface {
  name = 'AddPaymentMethodAndCancellationReasonToOrders1754800200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`);
    await queryRunner.query(`
      UPDATE orders SET payment_method = CASE WHEN payment_status = 'pending' THEN 'cod' ELSE 'razorpay' END
      WHERE payment_method IS NULL
    `);

    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS cancellation_reason`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS payment_method`);
  }
}
