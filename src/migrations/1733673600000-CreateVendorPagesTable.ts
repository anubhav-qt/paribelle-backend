import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVendorPagesTable1733673600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vendor_pages',
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
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'slug',
            type: 'varchar',
          },
          {
            name: 'page_type',
            type: 'enum',
            enum: ['custom', 'about', 'contact', 'faq', 'terms', 'privacy'],
            default: `'custom'`,
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'excerpt',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'featured_image',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'images',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'meta_title',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'meta_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'meta_keywords',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'published', 'archived'],
            default: `'draft'`,
          },
          {
            name: 'order',
            type: 'int',
            default: 0,
          },
          {
            name: 'show_in_navigation',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_home_page',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'published_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'vendor_pages',
      new TableIndex({
        name: 'IDX_vendor_pages_vendor_id',
        columnNames: ['vendor_id'],
      }),
    );

    await queryRunner.createIndex(
      'vendor_pages',
      new TableIndex({
        name: 'IDX_vendor_pages_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'vendor_pages',
      new TableIndex({
        name: 'IDX_vendor_pages_vendor_id_slug',
        columnNames: ['vendor_id', 'slug'],
        isUnique: true,
      }),
    );

    // Create foreign key (check if it exists first to avoid errors on re-run)
    const foreignKeys = await queryRunner.getTable('vendor_pages');
    const fkExists = foreignKeys?.foreignKeys.some(
      (fk) => fk.columnNames.indexOf('vendor_id') !== -1
    );
    
    if (!fkExists) {
      await queryRunner.createForeignKey(
        'vendor_pages',
        new TableForeignKey({
          columnNames: ['vendor_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'vendors',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vendor_pages');
  }
}
