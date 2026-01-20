import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVendorBlogPostsTable1733673700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vendor_blog_posts',
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
            name: 'tags',
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
            name: 'author_name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'view_count',
            type: 'int',
            default: 0,
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
      'vendor_blog_posts',
      new TableIndex({
        name: 'IDX_vendor_blog_posts_vendor_id',
        columnNames: ['vendor_id'],
      }),
    );

    await queryRunner.createIndex(
      'vendor_blog_posts',
      new TableIndex({
        name: 'IDX_vendor_blog_posts_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'vendor_blog_posts',
      new TableIndex({
        name: 'IDX_vendor_blog_posts_vendor_id_slug',
        columnNames: ['vendor_id', 'slug'],
        isUnique: true,
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'vendor_blog_posts',
      new TableForeignKey({
        columnNames: ['vendor_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vendor_blog_posts');
  }
}
