import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `refund_pending` payment status.
 *
 * Cancelling a paid order used to set `refunded` immediately, so an order
 * showed as refunded before any money moved. Cancellation now parks the order
 * in `refund_pending` and only the Razorpay `refund.processed` webhook
 * promotes it to `refunded`.
 */
export class AddRefundPendingPaymentStatus1754200100000 implements MigrationInterface {
  name = 'AddRefundPendingPaymentStatus1754200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Resolve the enum type from the column itself rather than assuming
    // TypeORM's `orders_payment_status_enum` naming — this runs on deploy
    // ahead of the app booting, so a wrong guess here takes the service down.
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
      // Column is not an enum (a plain varchar, say) — nothing to widen.
      console.log('[AddRefundPendingPaymentStatus] payment_status is not an enum; skipping');
      return;
    }

    // IF NOT EXISTS keeps a redeploy or a partial previous run harmless.
    await queryRunner.query(
      `ALTER TYPE "${row.typname}" ADD VALUE IF NOT EXISTS 'refund_pending'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres has no DROP VALUE. Removing it would mean rebuilding the type
    // and rewriting every row, which is not worth it for a reversible-in-name
    // -only migration; leaving the value in place is harmless.
  }
}
