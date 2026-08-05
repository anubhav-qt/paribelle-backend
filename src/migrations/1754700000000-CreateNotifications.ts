import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The notification bell — see Task 9 in the implementation plan. Persisted so
 * the bell shows what happened while the tab was closed, not only events
 * received live over the socket (see MarketplaceGateway).
 */
export class CreateNotifications1754700000000 implements MigrationInterface {
  name = 'CreateNotifications1754700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        audience VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        link VARCHAR(500),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_audience_created ON notifications(audience, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
  }
}
