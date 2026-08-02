import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../../modules/users/user.entity';

/**
 * Requires a valid JWT belonging to a store administrator.
 *
 * Most admin work is done by the seeded vendor_admin, so both admin roles pass
 * by default. Pass explicit roles for the narrower cases —
 * `AdminOnly(UserRole.SUPER_ADMIN)` for anything destructive.
 */
export function AdminOnly(...roles: UserRole[]) {
  const allowed = roles.length
    ? roles
    : [UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN];

  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...allowed),
    ApiBearerAuth(),
  );
}
