import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddPasswordResetFieldsToUsers1737380000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;

    // Add password_reset_token column if it doesn't exist
    if (!table?.findColumnByName('password_reset_token')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'password_reset_token',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    // Add password_reset_token_expiry column if it doesn't exist
    if (!table?.findColumnByName('password_reset_token_expiry')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'password_reset_token_expiry',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }

    // Add index for password_reset_token if it doesn't exist
    const existingIndex = table?.indices.find(
      (idx) => idx.name === 'idx_users_password_reset_token',
    );
    if (!existingIndex) {
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          name: 'idx_users_password_reset_token',
          columnNames: ['password_reset_token'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;

    // Drop index
    const index = table?.indices.find(
      (idx) => idx.name === 'idx_users_password_reset_token',
    );
    if (index) {
      await queryRunner.dropIndex('users', 'idx_users_password_reset_token');
    }

    // Drop columns
    if (table?.findColumnByName('password_reset_token_expiry')) {
      await queryRunner.dropColumn('users', 'password_reset_token_expiry');
    }
    if (table?.findColumnByName('password_reset_token')) {
      await queryRunner.dropColumn('users', 'password_reset_token');
    }
  }
}
