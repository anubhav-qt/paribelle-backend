import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../users/user.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private isAdmin(req: any): boolean {
    return req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.VENDOR_ADMIN;
  }

  @Get()
  findMine(@Request() req, @Query('unreadOnly') unreadOnly?: string, @Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 20;
    return this.isAdmin(req)
      ? this.notificationsService.findForAdmins(unreadOnly === 'true', take)
      : this.notificationsService.findForUser(req.user.id, unreadOnly === 'true', take);
  }

  @Get('unread-count')
  async unreadCount(@Request() req) {
    const count = this.isAdmin(req)
      ? await this.notificationsService.unreadCountForAdmins()
      : await this.notificationsService.unreadCountForUser(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markRead(id, { id: req.user.id, isAdmin: this.isAdmin(req) });
  }

  @Patch('read-all')
  markAllRead(@Request() req) {
    return this.isAdmin(req)
      ? this.notificationsService.markAllReadForAdmins()
      : this.notificationsService.markAllReadForUser(req.user.id);
  }
}
