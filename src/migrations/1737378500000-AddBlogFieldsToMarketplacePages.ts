import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBlogFieldsToMarketplacePages1737378500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('marketplace_pages');
    if (!table) return;
    
    // Add tags column if it doesn't exist
    if (!table?.findColumnByName('tags')) {
      await queryRunner.addColumn(
        'marketplace_pages',
        new TableColumn({
          name: 'tags',
          type: 'text',
          isArray: true,
          isNullable: true,
        }),
      );
    }

    // Add author_name column if it doesn't exist
    if (!table?.findColumnByName('author_name')) {
      await queryRunner.addColumn(
        'marketplace_pages',
        new TableColumn({
          name: 'author_name',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Add view_count column if it doesn't exist
    if (!table?.findColumnByName('view_count')) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('marketplace_pages');
    if (!table) return;
    
    if (table?.findColumnByName('view_count')) {
      await queryRunner.dropColumn('marketplace_pages', 'view_count');
    }
    if (table?.findColumnByName('author_name')) {
      await queryRunner.dropColumn('marketplace_pages', 'author_name');
    }
    if (table?.findColumnByName('tags')) {
      await queryRunner.dropColumn('marketplace_pages', 'tags');
    }
  }
}
