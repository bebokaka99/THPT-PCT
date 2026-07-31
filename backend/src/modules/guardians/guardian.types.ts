import type { AttendanceSummary } from '../attendance/attendance.types.js';
import type { StudentTranscript } from '../transcripts/transcript.types.js';
import type { Timetable } from '../timetables/timetable.types.js';

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
  invited_at: Date;
  verified_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
  updated_at: Date;
};

export type GuardianLinkQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: GuardianLinkStatus;
};

export type GuardianInviteInput = {
  guardian_user_id: number;
  student_user_id: number;
  relationship: string;
};

export type GuardianPreferencesInput = Partial<
  Pick<
    GuardianPreferences,
    | 'in_app_enabled'
    | 'attendance_enabled'
    | 'grades_enabled'
    | 'conduct_enabled'
  >
>;

export type GuardianStudentSummary = {
  child: GuardianChild;
  transcript: StudentTranscript | null;
  attendance: {
    data: unknown[];
    summary: AttendanceSummary;
  };
  timetable: Timetable | null;
};
