import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArchivedStatusToProducts1737375000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, check if the enum type exists and get its name
    const enumCheck = await queryRunner.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%status%' 
      AND typtype = 'e'
      AND typname IN (
        SELECT DISTINCT udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'status'
      )
    `);

    if (enumCheck.length === 0) {
      console.log('No status enum found for products table - skipping migration');
      return;
    }

    const enumTypeName = enumCheck[0].typname;
    console.log(`Found enum type: ${enumTypeName}`);

    // Add 'archived' to the enum if it doesn't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'archived' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}')
        ) THEN
          ALTER TYPE ${enumTypeName} ADD VALUE 'archived';
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
