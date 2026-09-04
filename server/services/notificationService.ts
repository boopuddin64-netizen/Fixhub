import { db } from '../db';
import { NotificationItem } from '../../src/types/index';

export class NotificationService {
  public static send(params: {
    userId: string;
    title: string;
    message: string;
    type: 'QUOTE' | 'STATUS_CHANGE' | 'PAYMENT' | 'WARRANTY' | 'MESSAGE' | 'SECURITY';
    repairId?: string;
  }): NotificationItem {
    const item: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      repairId: params.repairId,
      read: false,
      createdAt: new Date().toISOString(),
    };

    db.notifications.unshift(item);
    db.save();
    return item;
  }

  public static getUnreadForUser(userId: string): NotificationItem[] {
    return db.notifications.filter((n) => n.userId === userId && !n.read);
  }

  public static markAsRead(notificationId: string, userId: string): boolean {
    const notif = db.notifications.find((n) => n.id === notificationId && n.userId === userId);
    if (notif) {
      notif.read = true;
      db.save();
      return true;
    }
    return false;
  }

  public static markAllAsRead(userId: string): number {
    let count = 0;
    for (const n of db.notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    if (count > 0) db.save();
    return count;
  }
}
