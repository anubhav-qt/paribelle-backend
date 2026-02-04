import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateCitiesAndSubLocations1737380100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if cities table exists
    const citiesTableExists = await queryRunner.hasTable('cities');
    
    if (!citiesTableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'cities',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'varchar',
              isUnique: true,
            },
            {
              name: 'state',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'country',
              type: 'varchar',
              isNullable: true,
              default: "'India'",
            },
            {
              name: 'isUserCreated',
              type: 'boolean',
              default: false,
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

    // Check if sub_locations table exists
    const subLocationsTableExists = await queryRunner.hasTable('sub_locations');
    
    if (!subLocationsTableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'sub_locations',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'varchar',
            },
            {
              name: 'city_id',
              type: 'uuid',
            },
            {
              name: 'zipCode',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'isUserCreated',
              type: 'boolean',
              default: false,
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
          foreignKeys: [
            {
              columnNames: ['city_id'],
              referencedTableName: 'cities',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            },
          ],
        }),
        true,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop sub_locations first due to foreign key
    const subLocationsTableExists = await queryRunner.hasTable('sub_locations');
    if (subLocationsTableExists) {
      await queryRunner.dropTable('sub_locations');
    }

    // Drop cities table
    const citiesTableExists = await queryRunner.hasTable('cities');
    if (citiesTableExists) {
      await queryRunner.dropTable('cities');
    }
  }
}
