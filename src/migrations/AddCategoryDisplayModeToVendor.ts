import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryDisplayModeToVendor1735400000000 implements MigrationInterface {
  name = 'AddCategoryDisplayModeToVendor1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add categoryDisplayMode column to vendors table
    await queryRunner.addColumn(
      'vendors',
      new TableColumn({
        name: 'categoryDisplayMode',
        type: 'varchar',
        length: '10',
        default: "'sidebar'",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove categoryDisplayMode column from vendors table
    await queryRunner.dropColumn('vendors', 'categoryDisplayMode');
  }
}
