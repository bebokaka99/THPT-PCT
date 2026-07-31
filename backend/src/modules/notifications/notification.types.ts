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

export type NotificationPriority = 'normal' | 'important' | 'urgent';
export type NotificationTargetScope = 'school' | 'role' | 'grade' | 'classroom' | 'users';

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  target_role: NotificationTargetRole;
  target_scope: NotificationTargetScope;
  priority: NotificationPriority;
  classroom_id: number | null;
  grade_level: number | null;
  created_by_user_id: number | null;
  related_url: string | null;
  requires_acknowledgement: boolean;
  idempotency_key: string | null;
  expires_at: Date | null;
  created_at: Date;
};

export type UserNotification = Notification & {
  user_notification_id: number;
  delivered_at: Date;
  read_at: Date | null;
  acknowledged_at: Date | null;
};

export type ListMyNotificationsQuery = {
  page: number;
  limit: number;
  unread?: boolean;
  unacknowledged?: boolean;
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
  target_scope?: NotificationTargetScope;
  priority?: NotificationPriority;
  classroom_id?: number | null;
  grade_level?: number | null;
  user_ids?: number[];
  related_url?: string | null;
  requires_acknowledgement?: boolean;
  idempotency_key?: string | null;
  expires_at?: Date | null;
};

export type CommunicationOption = {
  id: number;
  name: string;
  school_year: string;
  grade_level: number | null;
};

export type NotificationReport = {
  notification_id: number;
  recipients: number;
  delivered: number;
  read: number;
  acknowledged: number;
  read_rate: number;
  acknowledgement_rate: number;
  recipient_statuses: Array<{
    user_id: number;
    full_name: string;
    role: string | null;
    delivered_at: Date;
    read_at: Date | null;
    acknowledged_at: Date | null;
  }>;
};
