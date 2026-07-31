export type AttendanceStatus =
  | 'present'
  | 'excused'
  | 'unexcused'
  | 'late';

export type AttendanceSession = {
  id: number;
  classroom_id: number;
  classroom_name: string;
  semester_id: number;
  semester_name: string;
  subject_id: number | null;
  subject_name: string | null;
  teaching_assignment_id: number | null;
  session_date: string;
  lesson_index: number;
  title: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  record_count: number;
  present_count: number;
  excused_count: number;
  unexcused_count: number;
  late_count: number;
};

export type AttendanceRecord = {
  id: number | null;
  session_id: number;
  student_user_id: number;
  student_code: string | null;
  student_name: string;
  status: AttendanceStatus;
  note: string | null;
  recorded_by_user_id: number | null;
  updated_at: string | null;
};

export type AttendanceSessionDetail = AttendanceSession & {
  records: AttendanceRecord[];
};

export type AttendanceSummary = {
  total: number;
  present: number;
  excused: number;
  unexcused: number;
  late: number;
  attendance_rate: number;
};

export type StudentAttendanceRecord = {
  id: number;
  session_id: number;
  classroom_id: number;
  classroom_name: string;
  semester_name: string;
  subject_name: string | null;
  session_date: string;
  lesson_index: number;
  status: AttendanceStatus;
  note: string | null;
};

export type ClassroomAttendanceSummary = AttendanceSummary & {
  student_user_id: number;
  student_name: string;
  student_code: string | null;
};

