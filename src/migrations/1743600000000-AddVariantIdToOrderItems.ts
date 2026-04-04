import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVariantIdToOrderItems1743600000000 implements MigrationInterface {
  name = 'AddVariantIdToOrderItems1743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD COLUMN IF NOT EXISTS "variant_id" UUID
        REFERENCES "product_variants"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_items_variant_id"
        ON "order_items"("variant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_items_variant_id"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "variant_id"`);
  }
}
