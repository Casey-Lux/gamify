export type NotificationType = 'HABIT_REMINDER' | 'BONUS' | 'DUE_SOON' | 'OVERDUE';

export interface AppNotification {
  key: string;
  type: NotificationType;
  title: string;
  body: string;

  at: number;
  href: string | null;
}

export interface NotificationItem extends AppNotification {
  read: boolean;
}

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, string> = {
  HABIT_REMINDER: '🔁',
  BONUS: '🎁',
  DUE_SOON: '⏳',
  OVERDUE: '⚠️'
};
