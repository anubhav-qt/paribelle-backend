import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVendorNavigationTable1733673800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vendor_navigation',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vendor_id',
            type: 'uuid',
          },
          {
            name: 'label',
            type: 'varchar',
          },
          {
            name: 'url',
            type: 'varchar',
          },
          {
            name: 'order',
            type: 'int',
            default: 0,
          },
          {
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'position',
            type: 'enum',
            enum: ['header', 'footer', 'both'],
            default: `'header'`,
          },
          {
            name: 'open_in_new_tab',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true,
    );

    // Create index
    await queryRunner.createIndex(
      'vendor_navigation',
      new TableIndex({
        name: 'IDX_vendor_navigation_vendor_id',
        columnNames: ['vendor_id'],
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'vendor_navigation',
      new TableForeignKey({
        columnNames: ['vendor_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vendor_navigation');
  }
}
