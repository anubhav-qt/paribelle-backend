import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cash on Delivery orders carry a flat handling fee (see COD_CHARGE in
 * OrdersService). Stored on its own column so invoices and order views can
 * show it as a separate line rather than hiding it inside the total.
 */
export class AddCodChargeToOrders1757400000000 implements MigrationInterface {
  name = 'AddCodChargeToOrders1757400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "cod_charge" NUMERIC(10,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_charge"`);
  }
}
