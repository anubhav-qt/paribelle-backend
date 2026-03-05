import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

export class AddProductVariations1735392000000 implements MigrationInterface {
  name = 'AddProductVariations1735392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('products');
    if (!table) return;

    const hasColumn = (snake: string, camel: string) =>
      !!table.findColumnByName(snake) || !!table.findColumnByName(camel);

    // Add columns for product variation support
    if (!hasColumn('is_parent', 'isParent')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'is_parent',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (!hasColumn('parent_product_id', 'parentProductId')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'parent_product_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    if (!hasColumn('variation_attributes', 'variationAttributes')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'variation_attributes',
          type: 'jsonb',
          isNullable: true,
          comment: 'Specific attributes for this variation (e.g., {color: "red", size: "M"})',
        }),
      );
    }

    if (!hasColumn('variation_themes', 'variationThemes')) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'variation_themes',
          type: 'text',
          isArray: true,
          isNullable: true,
          comment: 'Variation attribute types (e.g., ["color", "size"])',
        }),
      );
    }

    // Add foreign key for parent-child relationship
    const existingFk = table?.foreignKeys.find(
      (fk) =>
        fk.columnNames.indexOf('parent_product_id') !== -1 ||
        fk.columnNames.indexOf('parentProductId') !== -1,
    );
    if (!existingFk) {
      await queryRunner.createForeignKey(
        'products',
        new TableForeignKey({
          columnNames: [hasColumn('parent_product_id', 'parentProductId') ? 'parent_product_id' : 'parentProductId'],
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
          columnNames: [hasColumn('parent_product_id', 'parentProductId') ? 'parent_product_id' : 'parentProductId'],
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
          columnNames: [hasColumn('is_parent', 'isParent') ? 'is_parent' : 'isParent'],
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
      (fk) =>
        fk.columnNames.indexOf('parent_product_id') !== -1 ||
        fk.columnNames.indexOf('parentProductId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('products', foreignKey);
    }

    // Drop columns
    if (table?.findColumnByName('variation_themes')) {
      await queryRunner.dropColumn('products', 'variation_themes');
    } else if (table?.findColumnByName('variationThemes')) {
      await queryRunner.dropColumn('products', 'variationThemes');
    }
    if (table?.findColumnByName('variation_attributes')) {
      await queryRunner.dropColumn('products', 'variation_attributes');
    } else if (table?.findColumnByName('variationAttributes')) {
      await queryRunner.dropColumn('products', 'variationAttributes');
    }
    if (table?.findColumnByName('parent_product_id')) {
      await queryRunner.dropColumn('products', 'parent_product_id');
    } else if (table?.findColumnByName('parentProductId')) {
      await queryRunner.dropColumn('products', 'parentProductId');
    }
    if (table?.findColumnByName('is_parent')) {
      await queryRunner.dropColumn('products', 'is_parent');
    } else if (table?.findColumnByName('isParent')) {
      await queryRunner.dropColumn('products', 'isParent');
    }
  }
}
