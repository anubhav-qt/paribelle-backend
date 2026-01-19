import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCascadeDeleteToReviews1737294960000 implements MigrationInterface {
  name = 'AddCascadeDeleteToReviews1737294960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "reviews" 
      DROP CONSTRAINT IF EXISTS "FK_9482e9567d8dcc2bc615981ef44"
    `);

    // Add the foreign key constraint with CASCADE delete
    await queryRunner.query(`
      ALTER TABLE "reviews" 
      ADD CONSTRAINT "FK_9482e9567d8dcc2bc615981ef44" 
      FOREIGN KEY ("product_id") 
      REFERENCES "products"("id") 
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the CASCADE constraint
    await queryRunner.query(`
      ALTER TABLE "reviews" 
      DROP CONSTRAINT IF EXISTS "FK_9482e9567d8dcc2bc615981ef44"
    `);

    // Restore the original foreign key constraint without CASCADE
    await queryRunner.query(`
      ALTER TABLE "reviews" 
      ADD CONSTRAINT "FK_9482e9567d8dcc2bc615981ef44" 
      FOREIGN KEY ("product_id") 
      REFERENCES "products"("id")
    `);
  }
}
