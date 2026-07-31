export type TranscriptSubject = {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  final_score: number | null;
  score_scale: number;
  gradebook_status: 'approved' | 'locked';
};

export type StudentTranscript = {
  student: {
    full_name: string;
    student_code: string | null;
  };
  classroom: { name: string };
  period: {
    semester_id: number;
    semester_name: string;
    academic_year_name: string;
    is_locked: boolean;
    status: string;
  };
  subjects: TranscriptSubject[];
  overall_average: number | null;
  completed_subjects: number;
  total_subjects: number;
  conduct: {
    rating: 'good' | 'fair' | 'pass' | 'not_pass';
    homeroom_comment: string | null;
  } | null;
  source: 'live' | 'snapshot';
  generated_at: string | null;
};

export type TranscriptClassStudent = {
  student_user_id: number;
  full_name: string;
  student_code: string | null;
  overall_average: number | null;
  completed_subjects: number;
  total_subjects: number;
  source: 'live' | 'snapshot';
};
