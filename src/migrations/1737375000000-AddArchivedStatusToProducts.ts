import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArchivedStatusToProducts1737375000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'archived' to products_status_enum if it doesn't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'archived' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'products_status_enum')
        ) THEN
          ALTER TYPE products_status_enum ADD VALUE 'archived';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove a value
    console.log('Cannot remove enum value - this migration cannot be reverted automatically');
  }
}
