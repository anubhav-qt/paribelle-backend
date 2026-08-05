import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `returns` table if this environment does not already have it
 * (confirmed: it does not exist in a fresh local database — the SQL script
 * that created it in production, `create-returns-table.sql`, was never
 * wired into the migration chain), then extends it with the columns the new
 * exchange sub-machine needs (see Task 8 in the implementation plan).
 *
 * The store's policy changed from "returns and refunds" to "no refunds,
 * exchanges only, and only for an unused item that passes inspection" — see
 * `docs: TODO_IMPLEMENTATION_PLAN.md` Task 8. Rather than a parallel table,
 * this reuses `returns`: it already carries the item snapshot, images and
 * audit timestamps an exchange needs, and historic return rows must keep
 * rendering in admin regardless of the policy change.
 */
export class CreateReturnsAndExchangeSupport1754600000000 implements MigrationInterface {
  name = 'CreateReturnsAndExchangeSupport1754600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        return_number VARCHAR(50) UNIQUE NOT NULL,

        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,

        quantity INTEGER NOT NULL CHECK (quantity > 0),
        reason TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'requested',

        product_name VARCHAR(255) NOT NULL,
        product_sku VARCHAR(100),
        variant_options JSONB,
        original_price DECIMAL(10, 2) NOT NULL,
        original_quantity INTEGER NOT NULL,

        refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        refund_tax DECIMAL(10, 2) DEFAULT 0,
        refund_total DECIMAL(10, 2) NOT NULL DEFAULT 0,

        tracking_number VARCHAR(255),
        carrier VARCHAR(100),
        images JSONB,

        customer_notes TEXT,
        admin_notes TEXT,
        vendor_notes TEXT,
        rejection_reason TEXT,

        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,
        received_at TIMESTAMP,
        refunded_at TIMESTAMP,
        cancelled_at TIMESTAMP,

        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_returns_order_item_id ON returns(order_item_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_returns_vendor_id ON returns(vendor_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status)`);

    // Bring a pre-existing table in line with the one created above. Where
    // `returns` already exists — production, created by
    // `create-returns-table.sql`, which was never wired into this chain — the
    // CREATE above is a no-op, so `refund_amount` and `refund_total` are still
    // NOT NULL with no DEFAULT. An exchange has no refund to record, so
    // inserting one would violate those constraints on production while
    // passing on any fresh database. Defaults make the two schemas agree.
    await queryRunner.query(`ALTER TABLE returns ALTER COLUMN refund_amount SET DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE returns ALTER COLUMN refund_total SET DEFAULT 0`);

    // ── Exchange sub-machine columns ────────────────────────────────────────
    // request_type distinguishes the retired customer-return flow (kept only
    // so historic rows still render) from the new exchange flow, which is the
    // only one a customer can start going forward.
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) NOT NULL DEFAULT 'return'`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS exchange_variant_id UUID REFERENCES product_variants(id)`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20)`); // passed | failed
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection_notes TEXT`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS customer_tracking_number VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS replacement_shipped_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS replacement_tracking_number VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE returns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);

    // Widen the status check to the exchange sub-machine (requested → approved
    // → in_transit → received → [inspection] → replacement_shipped → completed,
    // or rejected at any admin decision point). The legacy return statuses stay
    // valid so historic rows are never left violating the constraint.
    await queryRunner.query(`ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check`);
    await queryRunner.query(`
      ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (status IN (
        'requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled',
        'in_transit', 'replacement_shipped', 'completed'
      ))
    `);

    // ── Policy settings (see plan "Still open" — placeholder defaults,
    // built as single-source-of-truth configuration so the real answer is a
    // one-line change once the seniors decide) ─────────────────────────────
    // Stored as plain strings, not JSON-quoted — matching how
    // platform_commission_rate is read: SettingsService.getSetting is called
    // directly by application code, bypassing the controller's JSON-unwrap
    // logic that GET /settings/:key applies for the admin UI.
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value", "description", "created_at", "updated_at")
      VALUES
        ('exchange_window_days', '7', 'Days from delivery a customer may request an exchange', now(), now()),
        ('exchange_return_shipping', 'store', 'Who pays return shipping for an exchange: customer | store', now(), now()),
        ('exchange_failed_inspection', 'ship_back', 'What happens to an item that fails inspection: ship_back | hold_for_collection | forfeit', now(), now())
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "settings" WHERE "key" IN ('exchange_window_days', 'exchange_return_shipping', 'exchange_failed_inspection')`);
    await queryRunner.query(`ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check`);
    await queryRunner.query(`
      ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (status IN (
        'requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled'
      ))
    `);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS completed_at`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS replacement_tracking_number`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS replacement_shipped_at`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS customer_tracking_number`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS in_transit_at`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS inspected_by`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS inspected_at`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS inspection_notes`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS inspection_result`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS exchange_variant_id`);
    await queryRunner.query(`ALTER TABLE returns DROP COLUMN IF EXISTS request_type`);
    // The base table is not dropped on down — it may pre-date this migration
    // in an environment where it already held production data.
  }
}
