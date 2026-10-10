import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../../modules/users/user.entity';

/**
 * Requires a valid JWT belonging to the store's admin: `super_admin` only.
 *
 * `vendor_admin` used to pass too. It is the marketplace's vendor role, and
 * until 10 Oct 2026 anyone could register as a vendor and get it, so it no
 * longer opens anything.
 */
export function AdminOnly(...roles: UserRole[]) {
  const allowed = roles.length ? roles : [UserRole.SUPER_ADMIN];

  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...allowed),
    ApiBearerAuth(),
  );
}

/** The in-handler counterpart of `AdminOnly()`. */
export function isStoreAdmin(user: { role?: UserRole } | null | undefined): boolean {
  return user?.role === UserRole.SUPER_ADMIN;
}
