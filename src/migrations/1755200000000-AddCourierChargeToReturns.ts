import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shipping a replacement out is not free, and the store wants to be able to
 * charge for it — a flat, admin-configurable fee (`exchange_courier_charge`)
 * added to every exchange that actually results in a parcel going back out.
 *
 * The customer chooses how to pay it at request time, which is the other half
 * of this: a replacement used to be forced onto the original order's terms
 * (COD with an automatic wallet drawdown), with no say in the matter. These
 * two columns record the fee as quoted when the request was made — the
 * setting can change afterwards and must not silently re-price an exchange
 * already in flight — and which method the customer picked.
 *
 * `top_up_amount`/`top_up_payment_method` (see AddTopUpToReturns) are left in
 * place for the rows that already carry a value, but nothing writes them any
 * more: exchanging into something more expensive is no longer offered at all.
 */
export class AddCourierChargeToReturns1755200000000 implements MigrationInterface {
  name = 'AddCourierChargeToReturns1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS courier_charge DECIMAL(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS courier_charge_payment_method VARCHAR NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE returns ADD COLUMN IF NOT EXISTS courier_charge_paid_at TIMESTAMP NULL`,
    );

    // Seed the setting so the admin settings form has something to load and
    // `getCourierCharge()` doesn't have to guess. 0 keeps today's behaviour
    // (no charge) until an admin sets a figure.
    await queryRunner.query(`
      INSERT INTO settings (key, value, description)
      SELECT 'exchange_courier_charge', '0'::jsonb,
             'Flat courier charge added to an exchange for shipping the replacement out. 0 disables the charge.'
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'exchange_courier_charge')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM settings WHERE key = 'exchange_courier_charge'`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS courier_charge_paid_at`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS courier_charge_payment_method`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS courier_charge`);
  }
}
