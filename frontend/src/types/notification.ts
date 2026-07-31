export type NotificationType = 'system' | 'school' | 'classroom' | 'post' | 'document' | 'event' | 'timetable';
export type NotificationTargetRole = 'all' | 'admin' | 'teacher' | 'student' | 'guardian';
export type NotificationPriority = 'normal' | 'important' | 'urgent';
export type NotificationTargetScope = 'school' | 'role' | 'grade' | 'classroom' | 'users';

export type UserNotification = {
  id: number;
  user_notification_id: number;
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
  delivered_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export type NotificationListQuery = {
  page?: number;
  limit?: number;
  unread?: boolean;
  unacknowledged?: boolean;
};

export type CreateNotificationInput = {
  title: string;
  message: string;
  type: NotificationType;
  target_role: NotificationTargetRole;
  target_scope: NotificationTargetScope;
  priority: NotificationPriority;
  classroom_id?: number | null;
  grade_level?: number | null;
  user_ids?: number[];
  related_url?: string | null;
  requires_acknowledgement: boolean;
  idempotency_key?: string;
};

export type CommunicationOptions = {
  classrooms: Array<{ id: number; name: string; school_year: string; grade_level: number | null }>;
  grades: number[];
  users: Array<{ id: number; full_name: string; email: string | null; role: string | null }>;
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
    delivered_at: string;
    read_at: string | null;
    acknowledged_at: string | null;
  }>;
};
