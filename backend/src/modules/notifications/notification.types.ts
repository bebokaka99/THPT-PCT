export type NotificationType =
  | 'system'
  | 'school'
  | 'classroom'
  | 'post'
  | 'document'
  | 'event'
  | 'timetable';
export type NotificationTargetRole =
  | 'all'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'guardian';

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  target_role: NotificationTargetRole;
  classroom_id: number | null;
  created_by_user_id: number | null;
  related_url: string | null;
  created_at: Date;
};

export type UserNotification = Notification & {
  user_notification_id: number;
  read_at: Date | null;
};

export type ListMyNotificationsQuery = {
  page: number;
  limit: number;
  unread?: boolean;
};

export type ListNotificationsQuery = {
  page: number;
  limit: number;
  q?: string;
  type?: NotificationType;
  target_role?: NotificationTargetRole;
};

export type CreateNotificationInput = {
  title: string;
  message: string;
  type: NotificationType;
  target_role: NotificationTargetRole;
  classroom_id?: number | null;
  related_url?: string | null;
};
