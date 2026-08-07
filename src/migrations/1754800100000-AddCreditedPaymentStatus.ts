import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `credited` payment status. An admin cancelling an already-paid
 * order used to park it in `refund_pending`, which only advances when the
 * Razorpay `refund.processed` webhook fires — a webhook that has never been
 * configured, so every such cancellation sat there forever. That path now
 * issues store credit through the wallet ledger instead and lands here,
 * settling immediately rather than waiting on a webhook that never comes.
 */
export class AddCreditedPaymentStatus1754800100000 implements MigrationInterface {
  name = 'AddCreditedPaymentStatus1754800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [row] = await queryRunner.query(`
      SELECT t.typname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE c.relname = 'orders'
        AND a.attname = 'payment_status'
        AND t.typtype = 'e'
    `);

    if (!row?.typname) {
      console.log('[AddCreditedPaymentStatus] payment_status is not an enum; skipping');
      return;
    }

    await queryRunner.query(
      `ALTER TYPE "${row.typname}" ADD VALUE IF NOT EXISTS 'credited'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres has no DROP VALUE; leaving it in place is harmless.
  }
}
