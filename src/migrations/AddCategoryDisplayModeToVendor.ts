import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryDisplayModeToVendor1735400000000 implements MigrationInterface {
  name = 'AddCategoryDisplayModeToVendor1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendors');
    if (!table) return;

    // Add categoryDisplayMode column to vendors table
    if (!table?.findColumnByName('categoryDisplayMode')) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendors');
    if (!table) return;

    // Remove categoryDisplayMode column from vendors table
    if (table?.findColumnByName('categoryDisplayMode')) {
      await queryRunner.dropColumn('vendors', 'categoryDisplayMode');
    }
  }
}
