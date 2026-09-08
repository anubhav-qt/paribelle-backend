import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an admin pin one product as a category's "Editor's Pick" in the mega
 * menu. Null keeps the current behaviour (show the category's first product).
 * ON DELETE SET NULL so removing the product just clears the pin.
 */
export class AddFeaturedProductToCategories1757500000000 implements MigrationInterface {
  name = 'AddFeaturedProductToCategories1757500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "featured_product_id" UUID
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_categories_featured_product'
        ) THEN
          ALTER TABLE "categories"
            ADD CONSTRAINT "fk_categories_featured_product"
            FOREIGN KEY ("featured_product_id") REFERENCES "products"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "fk_categories_featured_product"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "featured_product_id"`);
  }
}
