import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two clean-ups from Task 3a (prune storefront filters):
 *
 * 1. Explicitly sets `location_filter_enabled` to false. The storefront no
 *    longer renders the Location filter regardless of this setting — this is
 *    defense in depth so the admin toggle (still present, per the
 *    "hide, don't delete" rule) reflects the real state rather than an absent
 *    row a reader could mistake for "not yet decided".
 * 2. Strips the junk filter ids `HIDDEN_FILTER_IDS` already suppresses on the
 *    storefront (`stock`, `stockQuantity`, `isActive`, `active`, `status`,
 *    `rating`, `variant attributes`) out of every category's `filter_config`.
 *    They were written by earlier imports and are already invisible to
 *    shoppers, but they still clutter the admin filter editor.
 */
export class DisableLocationFilterAndCleanFilterConfig1754500200000
  implements MigrationInterface
{
  name = 'DisableLocationFilterAndCleanFilterConfig1754500200000';

  private readonly junkIds = ['stock', 'stockQuantity', 'isActive', 'active', 'status', 'rating', 'variant attributes'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value", "description", "created_at", "updated_at")
      VALUES ('location_filter_enabled', 'false', 'Whether the storefront shows a city/locality filter', now(), now())
      ON CONFLICT ("key") DO UPDATE SET "value" = 'false', "updated_at" = now()
    `);

    const categories: Array<{ id: string; filter_config: any }> = await queryRunner.query(
      `SELECT id, filter_config FROM "categories" WHERE filter_config IS NOT NULL`,
    );

    for (const cat of categories) {
      const config = cat.filter_config;
      if (!config?.filters?.length) continue;

      const cleaned = config.filters.filter((f: any) => !this.junkIds.includes(f.id));
      if (cleaned.length === config.filters.length) continue;

      await queryRunner.query(
        `UPDATE "categories" SET filter_config = $1 WHERE id = $2`,
        [JSON.stringify({ ...config, filters: cleaned }), cat.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The junk-id cleanup is not reversible (the stripped entries are not
    // recorded) — restoring `location_filter_enabled` is the only sensible undo.
    await queryRunner.query(`
      UPDATE "settings" SET "value" = 'true', "updated_at" = now() WHERE "key" = 'location_filter_enabled'
    `);
  }
}
