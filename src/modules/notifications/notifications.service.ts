import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notification, NotificationAudience, NotificationType } from './notification.entity';
import { MarketplaceGateway } from '../stock/stock.gateway';

/**
 * Writes a row (so the bell shows history on page load) and pushes it live
 * over the socket (see MarketplaceGateway) in the same call. Every caller —
 * OrdersService's status transitions, the payments webhook, ExchangesService
 * — fires these with `.catch()`, matching how the email sends are already
 * handled: a notification failure must never fail an order.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private marketplaceGateway: MarketplaceGateway,
  ) {}

  async notifyUser(
    userId: string,
    type: NotificationType,
    title: string,
    options?: { body?: string; link?: string; orderId?: string },
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId,
      audience: NotificationAudience.USER,
      type,
      title,
      body: options?.body || null,
      link: options?.link || null,
      orderId: options?.orderId || null,
    });
    const saved = await this.notificationsRepository.save(notification);
    this.marketplaceGateway.emitNotificationToUser(userId, saved);
    return saved;
  }

  async notifyAdmins(
    type: NotificationType,
    title: string,
    options?: { body?: string; link?: string; orderId?: string },
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId: null,
      audience: NotificationAudience.ADMIN,
      type,
      title,
      body: options?.body || null,
      link: options?.link || null,
      orderId: options?.orderId || null,
    });
    const saved = await this.notificationsRepository.save(notification);
    this.marketplaceGateway.emitNotificationToAdmins(saved);
    return saved;
  }

  async findForUser(userId: string, unreadOnly = false, limit = 20): Promise<Notification[]> {
    const where: any = { audience: NotificationAudience.USER, userId };
    if (unreadOnly) where.readAt = IsNull();
    return this.notificationsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findForAdmins(unreadOnly = false, limit = 20): Promise<Notification[]> {
    const where: any = { audience: NotificationAudience.ADMIN };
    if (unreadOnly) where.readAt = IsNull();
    return this.notificationsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async unreadCountForUser(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { audience: NotificationAudience.USER, userId, readAt: IsNull() },
    });
  }

  async unreadCountForAdmins(): Promise<number> {
    return this.notificationsRepository.count({
      where: { audience: NotificationAudience.ADMIN, readAt: IsNull() },
    });
  }

  /** Scoped so marking read requires owning the notification (or being an admin, for admin ones). */
  async markRead(id: string, requester: { id: string; isAdmin: boolean }): Promise<void> {
    const notification = await this.notificationsRepository.findOne({ where: { id } });
    if (!notification) return;
    const owns =
      (notification.audience === NotificationAudience.USER && notification.userId === requester.id) ||
      (notification.audience === NotificationAudience.ADMIN && requester.isAdmin);
    if (!owns) return;
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }
  }

  async markAllReadForUser(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { audience: NotificationAudience.USER, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async markAllReadForAdmins(): Promise<void> {
    await this.notificationsRepository.update(
      { audience: NotificationAudience.ADMIN, readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
