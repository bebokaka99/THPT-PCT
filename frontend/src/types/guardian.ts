import type {
  AttendanceSummary,
  StudentAttendanceRecord,
} from './attendance';
import type { StudentTranscript } from './transcript';

export type GuardianLinkStatus = 'pending' | 'verified' | 'revoked';

export type GuardianLink = {
  id: number;
  guardian_user_id: number;
  guardian_name: string;
  guardian_email: string | null;
  student_user_id: number;
  student_name: string;
  student_code: string | null;
  relationship: string;
  status: GuardianLinkStatus;
  revision: number;
  invited_at: string;
  verified_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GuardianChild = {
  link_id: number;
  student_user_id: number;
  full_name: string;
  student_code: string | null;
  relationship: string;
  classroom_id: number | null;
  classroom_name: string | null;
  school_year: string | null;
};

export type GuardianPreferences = {
  in_app_enabled: boolean;
  attendance_enabled: boolean;
  grades_enabled: boolean;
  conduct_enabled: boolean;
  updated_at: string;
};

export type GuardianStudentSummary = {
  child: GuardianChild;
  transcript: StudentTranscript | null;
  attendance: {
    data: StudentAttendanceRecord[];
    summary: AttendanceSummary;
  };
};
