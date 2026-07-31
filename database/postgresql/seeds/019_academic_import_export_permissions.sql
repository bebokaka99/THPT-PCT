INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'academic_imports.manage',
    'Import dữ liệu học vụ',
    'academic_operations',
    'Preview và commit file import học vụ có kiểm soát'
  ),
  (
    'academic_reports.export',
    'Xuất báo cáo học vụ',
    'academic_operations',
    'Xuất danh sách, chuyên cần, điểm và tổng hợp học vụ'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record ON permission_record.name IN (
  'academic_imports.manage',
  'academic_reports.export'
)
WHERE role_record.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
