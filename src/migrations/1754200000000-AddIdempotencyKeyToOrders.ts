import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the checkout retry an order safely. A single checkout can produce one
 * order per vendor, so the key is not unique on its own — it is unique per
 * user, and replaying a key returns the orders it already created rather than
 * placing them again.
 */
export class AddIdempotencyKeyToOrders1754200000000 implements MigrationInterface {
  name = 'AddIdempotencyKeyToOrders1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_user_idempotency_key"
        ON "orders"("user_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_user_idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotency_key"`);
  }
}
