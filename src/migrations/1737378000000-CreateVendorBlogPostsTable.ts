import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateVendorBlogPostsTable1737378000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vendor_blog_posts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vendor_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'slug',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
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
            enum: ['draft', 'published'],
            default: "'draft'",
            isNullable: false,
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
            isNullable: false,
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
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
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

    // Create unique index on vendor_id and slug
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_vendor_blog_posts_vendor_slug" ON "vendor_blog_posts" ("vendor_id", "slug")`,
    );

    // Create index on vendor_id
    await queryRunner.query(
      `CREATE INDEX "IDX_vendor_blog_posts_vendor_id" ON "vendor_blog_posts" ("vendor_id")`,
    );

    // Create index on status
    await queryRunner.query(
      `CREATE INDEX "IDX_vendor_blog_posts_status" ON "vendor_blog_posts" ("status")`,
    );

    // Add foreign key to vendors table
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
