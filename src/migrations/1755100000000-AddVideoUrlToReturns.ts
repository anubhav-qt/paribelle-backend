import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every exchange request now has to carry a video of the item — it is the
 * only evidence the admin has before approving one, and "customer says it's
 * faulty" was previously the whole of it. Nullable, because requests made
 * before this rule existed have no clip and must keep rendering.
 */
export class AddVideoUrlToReturns1755100000000 implements MigrationInterface {
  name = 'AddVideoUrlToReturns1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS video_url VARCHAR NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS video_url`);
  }
}
