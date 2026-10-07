/**
 * Notifications are DERIVED from data the app already has (missions with
 * deadlines, active consumable effects, completions with bonuses, habits);
 * only the "read" state is persisted (notification_reads). To add a new kind:
 * add a type here, write one `derive*` function in
 * utils/notifications-derive.ts and register it in `deriveNotifications`.
 */
export type NotificationType = 'HABIT_REMINDER' | 'BONUS' | 'DUE_SOON' | 'OVERDUE';

export interface AppNotification {
  /** Deterministic: the same event always yields the same key, so a read
   * mark persists and a resolved event simply stops being derived. */
  key: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Epoch ms the event refers to (used to order the list). */
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
