import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFooterSettingsTable1737380200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('footer_settings');
    
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'footer_settings',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'about_text',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'social_links',
              type: 'jsonb',
              default: "'[]'",
            },
            {
              name: 'custom_sections',
              type: 'jsonb',
              default: "'[]'",
            },
            {
              name: 'contact_info',
              type: 'jsonb',
            },
            {
              name: 'copyright_text',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'show_categories',
              type: 'boolean',
              default: true,
            },
            {
              name: 'max_categories_display',
              type: 'int',
              default: 6,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
        true,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('footer_settings');
    if (tableExists) {
      await queryRunner.dropTable('footer_settings');
    }
  }
}
