import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retires `products.attributes`.
 *
 * A product's filterable properties — Size, Colour, Fabric, Finish — describe
 * the item on the shelf, so they belong on the variant, not on the catalogue
 * entry above it. Holding them in both places meant category filters read one
 * copy while the variant picker read the other, and the two were written by
 * different code paths that disagreed about casing. Filtering now has a single
 * source: `product_variants.variant_attributes`.
 *
 * Three steps:
 *
 *  1. `metadata` takes over the non-filter payload (`booking`, `tour`) that
 *     shared the old column with the filter keys.
 *  2. Every product that carried filter attributes ends up with them on a
 *     variant. Products that already had variants have the product-level keys
 *     folded in underneath the variant's own (the variant's Size wins over the
 *     product's). Products that had none get one default variant mirroring
 *     their SKU, price and stock.
 *  3. `attributes` is dropped.
 */
export class MoveProductAttributesToVariants1754300000000
  implements MigrationInterface
{
  name = 'MoveProductAttributesToVariants1754300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAttributes = await this.columnExists(queryRunner, 'attributes');

    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metadata" jsonb`,
    );

    if (!hasAttributes) {
      // Already migrated, or a database built straight from the current
      // entities. Nothing to move.
      return;
    }

    // 1. Non-filter payload moves across untouched.
    await queryRunner.query(`
      UPDATE "products"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb)
                     || CASE WHEN "attributes" ? 'booking'
                             THEN jsonb_build_object('booking', "attributes"->'booking')
                             ELSE '{}'::jsonb END
                     || CASE WHEN "attributes" ? 'tour'
                             THEN jsonb_build_object('tour', "attributes"->'tour')
                             ELSE '{}'::jsonb END
      WHERE "attributes" ? 'booking' OR "attributes" ? 'tour'
    `);

    // 2a. Products that already have variants: the product's keys become
    //     defaults beneath each variant's own, so a variant that says
    //     Size: 'M' keeps it and still picks up the product's Fabric.
    await queryRunner.query(`
      UPDATE "product_variants" v
      SET "variant_attributes" =
            (p."attributes" - 'booking' - 'tour') || v."variant_attributes"
      FROM "products" p
      WHERE v."product_id" = p."id"
        AND p."attributes" IS NOT NULL
        AND (p."attributes" - 'booking' - 'tour') <> '{}'::jsonb
    `);

    // 2b. Products with no variant at all get one, so their attributes have
    //     somewhere to live. `has_variants` stays false: this is a carrier for
    //     the product's own properties, not a choice to offer the shopper, and
    //     flipping it would make the storefront demand a selection before
    //     letting anyone buy a simple product.
    //
    //     Variant SKUs are unique, so a product SKU already taken by some
    //     other product's variant falls back to a suffixed form.
    await queryRunner.query(`
      INSERT INTO "product_variants"
        ("product_id", "sku", "variant_attributes", "price", "compare_at_price",
         "stock_quantity", "images", "is_active")
      SELECT
        p."id",
        CASE
          WHEN EXISTS (SELECT 1 FROM "product_variants" x WHERE x."sku" = p."sku")
          THEN p."sku" || '-D' || LEFT(REPLACE(p."id"::text, '-', ''), 6)
          ELSE p."sku"
        END,
        p."attributes" - 'booking' - 'tour',
        p."price",
        p."compare_at_price",
        COALESCE(p."stock_quantity", 0),
        p."images",
        TRUE
      FROM "products" p
      WHERE p."attributes" IS NOT NULL
        AND (p."attributes" - 'booking' - 'tour') <> '{}'::jsonb
        AND NOT EXISTS (
          SELECT 1 FROM "product_variants" v WHERE v."product_id" = p."id"
        )
    `);

    // 3. The old column has no readers left.
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "attributes"`);
  }

  /**
   * Puts the column back and refills it from the variants, so a rollback lands
   * on a database the previous release can serve. Variant-only keys come back
   * as product attributes too — the down direction cannot tell which of them
   * started life up here.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'attributes'))) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN "attributes" jsonb`,
      );
    }

    await queryRunner.query(`
      UPDATE "products" p
      SET "attributes" = COALESCE(v."variant_attributes", '{}'::jsonb)
                       || COALESCE(p."metadata", '{}'::jsonb)
      FROM (
        SELECT DISTINCT ON ("product_id") "product_id", "variant_attributes"
        FROM "product_variants"
        ORDER BY "product_id", "created_at"
      ) v
      WHERE v."product_id" = p."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "metadata"`,
    );
  }

  private async columnExists(
    queryRunner: QueryRunner,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = $1`,
      [column],
    );
    return rows.length > 0;
  }
}
