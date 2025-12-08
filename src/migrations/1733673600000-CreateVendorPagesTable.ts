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
            name: 'vendorId',
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
            name: 'pageType',
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
            name: 'featuredImage',
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
            name: 'metaTitle',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metaDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metaKeywords',
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
            name: 'showInNavigation',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isHomePage',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'publishedAt',
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
        name: 'IDX_vendor_pages_vendorId',
        columnNames: ['vendorId'],
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
        name: 'IDX_vendor_pages_vendorId_slug',
        columnNames: ['vendorId', 'slug'],
        isUnique: true,
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'vendor_pages',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vendor_pages');
  }
}
