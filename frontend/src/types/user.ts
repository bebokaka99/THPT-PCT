export type UserStatus = 'active' | 'inactive' | 'locked';

export type AdminUser = {
  id: number;
  username: string | null;
  email: string | null;
  full_name: string;
  status: UserStatus;
  roles: string[];
  created_at: string;
  updated_at: string;
};

export type UserListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  role?: string;
  status?: 'all' | UserStatus;
};

export type UserFormInput = {
  email: string;
  full_name: string;
  password?: string;
  status?: UserStatus;
  roles?: string[];
};

export type BulkStudentInput = {
  full_name: string;
  date_of_birth: string;
  class_name?: string;
  student_code?: string;
  phone?: string;
  parent_phone?: string;
  email?: string;
};

export type StudentCredential = {
  user_id: number;
  username: string;
  password: string;
  full_name: string;
  date_of_birth: string;
  class_name: string | null;
  student_code: string | null;
};

export type BulkStudentAccountsResponse = {
  createdCount: number;
  credentials: StudentCredential[];
  note: string;
};
