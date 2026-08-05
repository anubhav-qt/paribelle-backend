import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `users.google_id`, so a Google sign-in can be identified without
 * guessing from the email address.
 *
 * `JwtStrategy` used to treat any `@gmail.com` address as "signed up with
 * Google" and skip the email-verification requirement for it. That let
 * anyone register a Gmail address with a plain password and never verify it
 * — the check had nothing real to test. Backfilling `google_id` for accounts
 * that already went through `AuthService.googleLogin` lets the check use a
 * fact instead of a guess.
 */
export class AddGoogleIdToUsers1754400000000 implements MigrationInterface {
  name = 'AddGoogleIdToUsers1754400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id"`,
    );
  }
}
