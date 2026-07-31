export type NotificationType = 'system' | 'school' | 'classroom' | 'post' | 'document';
export type NotificationTargetRole =
  | 'all'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'guardian';

export type UserNotification = {
  id: number;
  user_notification_id: number;
  title: string;
  message: string;
  type: NotificationType;
  target_role: NotificationTargetRole;
  classroom_id: number | null;
  created_by_user_id: number | null;
  related_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListQuery = {
  page?: number;
  limit?: number;
  unread?: boolean;
};
