import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

export class AddProductVariations1735392000000 implements MigrationInterface {
  name = 'AddProductVariations1735392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('products');
    if (!table) return;

    // Add columns for product variation support
    if (!table?.findColumnByName('isParent')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'isParent',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (!table?.findColumnByName('parentProductId')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'parentProductId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    if (!table?.findColumnByName('variationAttributes')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'variationAttributes',
          type: 'jsonb',
          isNullable: true,
          comment: 'Specific attributes for this variation (e.g., {color: "red", size: "M"})',
        }),
      );
    }

    if (!table?.findColumnByName('variationThemes')) {
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
    }

    // Add foreign key for parent-child relationship
    const existingFk = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('parentProductId') !== -1,
    );
    if (!existingFk) {
      await queryRunner.createForeignKey(
        'products',
        new TableForeignKey({
          columnNames: ['parentProductId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'products',
          onDelete: 'CASCADE',
        }),
      );
    }

    // Add index for faster variation queries
    const existingParentIdIndex = table?.indices.find(
      (idx) => idx.name === 'IDX_PRODUCTS_PARENT_ID',
    );
    if (!existingParentIdIndex) {
      await queryRunner.createIndex(
        'products',
        new TableIndex({
          name: 'IDX_PRODUCTS_PARENT_ID',
          columnNames: ['parentProductId'],
        }),
      );
    }

    const existingIsParentIndex = table?.indices.find(
      (idx) => idx.name === 'IDX_PRODUCTS_IS_PARENT',
    );
    if (!existingIsParentIndex) {
      await queryRunner.createIndex(
        'products',
        new TableIndex({
          name: 'IDX_PRODUCTS_IS_PARENT',
          columnNames: ['isParent'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('products');
    if (!table) return;

    // Drop indexes
    const isParentIndex = table?.indices.find((idx) => idx.name === 'IDX_PRODUCTS_IS_PARENT');
    if (isParentIndex) {
      await queryRunner.dropIndex('products', 'IDX_PRODUCTS_IS_PARENT');
    }
    
    const parentIdIndex = table?.indices.find((idx) => idx.name === 'IDX_PRODUCTS_PARENT_ID');
    if (parentIdIndex) {
      await queryRunner.dropIndex('products', 'IDX_PRODUCTS_PARENT_ID');
    }

    // Drop foreign key
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('parentProductId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('products', foreignKey);
    }

    // Drop columns
    if (table?.findColumnByName('variationThemes')) {
      await queryRunner.dropColumn('products', 'variationThemes');
    }
    if (table?.findColumnByName('variationAttributes')) {
      await queryRunner.dropColumn('products', 'variationAttributes');
    }
    if (table?.findColumnByName('parentProductId')) {
      await queryRunner.dropColumn('products', 'parentProductId');
    }
    if (table?.findColumnByName('isParent')) {
      await queryRunner.dropColumn('products', 'isParent');
    }
  }
}
