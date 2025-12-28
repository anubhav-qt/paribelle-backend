import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

export class AddProductVariations1735392000000 implements MigrationInterface {
  name = 'AddProductVariations1735392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns for product variation support
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'isParent',
        type: 'boolean',
        default: false,
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'parentProductId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'variationAttributes',
        type: 'jsonb',
        isNullable: true,
        comment: 'Specific attributes for this variation (e.g., {color: "red", size: "M"})',
      }),
    );

    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'variationThemes',
        type: 'text',
        isArray: true,
        isNullable: true,
        comment: 'Variation attribute types (e.g., ["color", "size"])',
      }),
    );

    // Add foreign key for parent-child relationship
    await queryRunner.createForeignKey(
      'products',
      new TableForeignKey({
        columnNames: ['parentProductId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'products',
        onDelete: 'CASCADE',
      }),
    );

    // Add index for faster variation queries
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_PRODUCTS_PARENT_ID',
        columnNames: ['parentProductId'],
      }),
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'IDX_PRODUCTS_IS_PARENT',
        columnNames: ['isParent'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('products', 'IDX_PRODUCTS_IS_PARENT');
    await queryRunner.dropIndex('products', 'IDX_PRODUCTS_PARENT_ID');

    // Drop foreign key
    const table = await queryRunner.getTable('products');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('parentProductId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('products', foreignKey);
    }

    // Drop columns
    await queryRunner.dropColumn('products', 'variationThemes');
    await queryRunner.dropColumn('products', 'variationAttributes');
    await queryRunner.dropColumn('products', 'parentProductId');
    await queryRunner.dropColumn('products', 'isParent');
  }
}
