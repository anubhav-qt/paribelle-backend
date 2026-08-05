import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sets the platform commission to 0.
 *
 * The rate actually charged on every order was a hardcoded `10` in
 * `OrdersService.create` — the admin "Currency & Commission" setting
 * (`settings.platform_commission_rate`) was written by the admin UI but never
 * read by anything. This migration makes the setting the source of truth
 * (see `OrdersService.getPlatformCommissionRate`) and sets it, and the unused
 * `platform_settings.default_commission_percentage` column, to 0.
 *
 * Historic orders keep whatever `commission_rate` they were placed at and are
 * intentionally left untouched.
 */
export class ZeroPlatformCommission1754500000000 implements MigrationInterface {
  name = 'ZeroPlatformCommission1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value", "description", "created_at", "updated_at")
      VALUES ('platform_commission_rate', '0', 'Default marketplace commission rate percentage for all vendors', now(), now())
      ON CONFLICT ("key") DO UPDATE SET "value" = '0', "updated_at" = now()
    `);

    await queryRunner.query(`
      ALTER TABLE "platform_settings" ALTER COLUMN "default_commission_percentage" SET DEFAULT 0.00
    `);
    await queryRunner.query(`
      UPDATE "platform_settings" SET "default_commission_percentage" = 0.00
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "settings" SET "value" = '10', "updated_at" = now() WHERE "key" = 'platform_commission_rate'
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_settings" ALTER COLUMN "default_commission_percentage" SET DEFAULT 10.00
    `);
    await queryRunner.query(`
      UPDATE "platform_settings" SET "default_commission_percentage" = 10.00
    `);
  }
}
