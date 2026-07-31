export type UserStatus = 'active' | 'inactive' | 'locked';

export type AdminUser = {
  id: number;
  username: string | null;
  email: string | null;
  full_name: string;
  status: UserStatus;
  roles: string[];
  created_at: Date;
  updated_at: Date;
};

export type CreateUserInput = {
  email: string;
  full_name: string;
  password: string;
  status?: UserStatus;
  roles?: string[];
};

export type UpdateUserInput = {
  email?: string;
  full_name?: string;
  password?: string;
  status?: UserStatus;
  roles?: string[];
};

export type UpdateUserStatusInput = {
  status: UserStatus;
};

export type UpdateUserRolesInput = {
  roles: string[];
};

export type ListUsersQuery = {
  page: number;
  limit: number;
  q?: string;
  role?: string;
  status?: UserStatus;
};

export type BulkStudentInput = {
  full_name: string;
  date_of_birth: string;
  class_name?: string | null;
  student_code?: string | null;
  phone?: string | null;
  parent_phone?: string | null;
  email?: string | null;
};

export type BulkCreateStudentsInput = {
  cohort: string;
  classroom_id?: number;
  students: BulkStudentInput[];
};

export type GeneratedStudentCredential = {
  user_id: number;
  username: string;
  password: string;
  full_name: string;
  date_of_birth: string;
  class_name: string | null;
  student_code: string | null;
};
