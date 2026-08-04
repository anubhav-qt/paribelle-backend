import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapses variant attribute keys that differ only in case.
 *
 * An earlier import lower-cased both keys and values before storing them,
 * while the admin form stored them as typed. Products touched by both ended up
 * carrying each attribute twice — `{"Colour": "Rose", "colour": "rose"}`.
 *
 * The duplicates were not harmless. The product page builds its size and
 * colour pickers by listing the distinct attribute keys, so a product with
 * nine keys for four real attributes offered nine option groups, several of
 * them duplicates of one another and none of them satisfiable together: the
 * shopper picked a size and a colour and the picker stayed stuck, refusing
 * every further click. Reading them is now case-insensitive everywhere, but
 * the doubled keys still show up in the "Selected variant" line, so they go.
 *
 * The first spelling of each key wins, since object key order in `jsonb` is
 * stable and the capitalised spelling is the one shops actually typed.
 */
export class DedupeVariantAttributeKeyCasing1754300100000
  implements MigrationInterface
{
  name = 'DedupeVariantAttributeKeyCasing1754300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const variants: Array<{ id: string; variant_attributes: Record<string, string> }> =
      await queryRunner.query(
        `SELECT id, variant_attributes FROM product_variants
          WHERE variant_attributes IS NOT NULL`,
      );

    for (const variant of variants) {
      const attributes = variant.variant_attributes || {};
      const kept: Record<string, string> = {};
      const seen = new Set<string>();

      for (const [key, value] of Object.entries(attributes)) {
        const lower = key.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        kept[key] = value;
      }

      if (Object.keys(kept).length === Object.keys(attributes).length) continue;

      await queryRunner.query(
        `UPDATE product_variants SET variant_attributes = $1 WHERE id = $2`,
        [JSON.stringify(kept), variant.id],
      );
    }
  }

  public async down(): Promise<void> {
    // The dropped keys were redundant copies; there is nothing to restore.
  }
}
