import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A different-product exchange (route 2) doesn't ship a "replacement" off
 * the same order — it credits the price gap and then a brand new order gets
 * placed for the actual replacement product, funded by that credit. This
 * column is how the exchange row remembers which order fulfilled it.
 */
export class AddCompletedOrderIdToReturns1754900000000 implements MigrationInterface {
  name = 'AddCompletedOrderIdToReturns1754900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS completed_order_id UUID REFERENCES orders(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS completed_order_id`);
  }
}
