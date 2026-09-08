import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives the mega menu's Editor's Pick tile an art direction of its own.
 *
 * Pinning a product (see AddFeaturedProductToCategories) settled *what* the
 * tile shows, but not how it looks: the tile is a tall portrait crop and it
 * took whichever image happened to be first on the product, centred. A wide
 * product shot cropped to that shape routinely cut the garment's neckline or
 * the model's face out of frame, with no way for an admin to say otherwise.
 *
 * `featured_image_url` overrides which of the product's images is used — the
 * choice is not limited to the product's own gallery, since a variant's images
 * are often the better-composed ones. `featured_image_position` is a CSS
 * `object-position` string ("50% 30%") saying which part of it to keep when the
 * crop bites.
 *
 * Both nullable, and null on every existing row: unset means exactly what the
 * tile does today — first image, centred — so this migration cannot change how
 * any category currently renders.
 */
export class AddFeaturedImageToCategories1757600000000 implements MigrationInterface {
  name = 'AddFeaturedImageToCategories1757600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "featured_image_url" TEXT
    `);
    // Short and fixed-format — "<x>% <y>%", or a keyword like "center".
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "featured_image_position" VARCHAR(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN IF EXISTS "featured_image_position"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "featured_image_url"`);
  }
}
