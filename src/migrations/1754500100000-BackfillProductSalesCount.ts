import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills `products.sales_count` from existing order history.
 *
 * Nothing ever wrote to this column before `OrdersService.create` started
 * incrementing it (see Task 4 — popularity sort). Every product would
 * otherwise show 0 sales despite however many orders already exist, and the
 * new "Popularity" sort would treat a bestseller identically to something
 * never ordered.
 *
 * Mirrors the net-of-cancellations rule the application now maintains going
 * forward: quantity is counted for every order except `cancelled` ones, since
 * a cancellation (for any reason — customer cancel, admin reject, failed
 * payment) already decrements the running total in the service layer.
 */
export class BackfillProductSalesCount1754500100000 implements MigrationInterface {
  name = 'BackfillProductSalesCount1754500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "products" p
      SET "sales_count" = "sales_count" + COALESCE(sold.qty, 0)
      FROM (
        SELECT oi.product_id, SUM(oi.quantity) AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status <> 'cancelled'
        GROUP BY oi.product_id
      ) sold
      WHERE p.id = sold.product_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "products" p
      SET "sales_count" = GREATEST(0, "sales_count" - COALESCE(sold.qty, 0))
      FROM (
        SELECT oi.product_id, SUM(oi.quantity) AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status <> 'cancelled'
        GROUP BY oi.product_id
      ) sold
      WHERE p.id = sold.product_id
    `);
  }
}
