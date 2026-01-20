import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBlogFieldsToMarketplacePages1737378500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tags column
    await queryRunner.addColumn(
      'marketplace_pages',
      new TableColumn({
        name: 'tags',
        type: 'text',
        isArray: true,
        isNullable: true,
      }),
    );

    // Add author_name column
    await queryRunner.addColumn(
      'marketplace_pages',
      new TableColumn({
        name: 'author_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Add view_count column
    await queryRunner.addColumn(
      'marketplace_pages',
      new TableColumn({
        name: 'view_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('marketplace_pages', 'view_count');
    await queryRunner.dropColumn('marketplace_pages', 'author_name');
    await queryRunner.dropColumn('marketplace_pages', 'tags');
  }
}
