# Workflow Report

> Đây là log lịch sử append-only. Các phần cũ có thể mô tả MySQL; từ `P0-DB`
> trở đi PostgreSQL là database canonical và không dùng lại hướng dẫn MySQL/XAMPP.

## 1. Đã tạo những gì

- Scaffold frontend React + TypeScript + Vite + Tailwind CSS.
- Scaffold backend Node.js + Express + TypeScript.
- Kết nối backend với MySQL bằng `mysql2/promise`.
- Tạo Auth + RBAC bằng JWT, bcrypt hash, role và permission từ MySQL.
- Tạo CRUD backend và admin UI cho posts/categories.
- Tạo public website frontend kết nối API thật.
- Tạo Media Upload nền móng:
  - Backend upload bằng `multer`.
  - Lưu file vào `backend/uploads/images`, `backend/uploads/documents`, `backend/uploads/others`.
  - Serve static files qua `/uploads`.
  - Lưu metadata vào bảng `media_files`.
  - Admin UI `/admin/media` để upload/list/filter/copy URL/delete.
- Tích hợp Media Picker vào form bài viết admin:
  - Chọn ảnh cover từ media đã upload.
  - Upload ảnh cover mới ngay trong form bài viết.
  - Tự fill `cover_image_url` và hiển thị preview cover.
- Tạo Documents Module:
  - Backend API public/admin cho tài liệu/văn bản.
  - Bảng `documents` có slug, category, document URL, file metadata, status và published_at.
  - Public pages `/tai-lieu`, `/tai-lieu/:slug`.
  - Admin pages `/admin/documents`, `/admin/documents/new`, `/admin/documents/:id/edit`.
  - Form admin tái sử dụng media upload để chọn/upload file tài liệu.
- Polish public website:
  - Cải thiện homepage theo hướng cổng thông tin trường học hiện đại.
  - Dùng dữ liệu API thật từ posts, categories và documents.
  - Cải thiện Header, Footer, PostsPage, DocumentsPage.
  - Thêm reusable public UI components cho section, empty state, post card và document card.
- Nâng cấp rich text editor cho posts:
  - Dùng Tiptap cho admin post editor.
  - Nội dung bài viết lưu HTML trong field `content` hiện có.
  - Public post detail render HTML đã sanitize bằng DOMPurify.
  - Style rich content cho heading, paragraph, list, blockquote, link và image.
- Frontend performance polish cho admin editor:
  - Lazy-load các admin pages nặng bằng `React.lazy` và `Suspense`.
  - Lazy-load `RichTextEditor` riêng trong `AdminPostFormPage`.
  - Tách Tiptap khỏi initial public bundle.
- Admin Users Management nền móng:
  - Backend API quản lý users và roles.
  - Admin UI tạo/sửa/khóa tài khoản.
  - Gán role `admin`, `teacher`, `student`.
  - User `inactive` hoặc `locked` không login được qua auth hiện có.

## 2. Endpoint media mới

Upload media:

```text
POST /api/media/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
field: file
Permission: posts.manage hoặc documents.manage
```

List media:

```text
GET /api/media?type=all|image|document|other&page=1&limit=20
Authorization: Bearer <token>
Permission: posts.manage hoặc documents.manage
```

Delete media:

```text
DELETE /api/media/:id
Authorization: Bearer <token>
Permission: posts.manage hoặc documents.manage
```

Static file:

```text
GET /uploads/images/<file>
GET /uploads/documents/<file>
GET /uploads/others/<file>
```

## 2.1 Endpoint documents mới

Public:

```text
GET /api/documents?page=1&limit=10&q=&category=&status=published
GET /api/documents/:slug
```

Admin:

```text
GET /api/documents?status=all|draft|published|archived
GET /api/documents/admin/:id
POST /api/documents
PATCH /api/documents/:id
DELETE /api/documents/:id
PATCH /api/documents/:id/publish
PATCH /api/documents/:id/archive
```

Permission:

```text
documents.manage
```

## 2.2 Endpoint users/roles mới

Users admin:

```text
GET /api/users?page=1&limit=10&q=&role=&status=
GET /api/users/:id
POST /api/users
PATCH /api/users/:id
PATCH /api/users/:id/status
PATCH /api/users/:id/roles
```

Roles admin:

```text
GET /api/roles
```

Permission:

```text
users.manage
```

## 3. Route admin mới

```text
/admin/media
/admin/documents
/admin/documents/new
/admin/documents/:id/edit
/admin/users
/admin/users/new
/admin/users/:id/edit
```

## Task - Teacher & Student Portal v1

### Da tao

- Database migration `011_create_profiles_classrooms.sql`.
- Backend modules `profiles` va `classrooms`.
- Frontend services/types cho profile va classroom.
- Teacher portal routes: `/teacher`, `/teacher/classes`, `/teacher/classes/:id`, `/teacher/profile`.
- Student portal routes: `/student`, `/student/classes`, `/student/classes/:id`, `/student/profile`.
- Admin classroom routes: `/admin/classrooms`, `/admin/classrooms/new`, `/admin/classrooms/:id`, `/admin/classrooms/:id/edit`.

### Database

- `teacher_profiles`: ho so giao vien theo `user_id`.
- `student_profiles`: ho so hoc sinh theo `user_id`.
- `classrooms`: lop hoc theo nam hoc.
- `classroom_members`: gan giao vien/hoc sinh vao lop.
- `classroom_posts`: thong bao noi bo theo lop.
- `classroom_documents`: tai lieu noi bo theo lop.
- Seed permission moi: `classrooms.manage`, `classroom_posts.manage`, `classroom_documents.manage`, `classroom_posts.read`, `classroom_documents.read`.

### Backend API

- `GET/PATCH /api/profiles/me`.
- `GET/POST/PATCH /api/profiles/teachers`.
- `GET/POST/PATCH /api/profiles/students`.
- `GET/POST/PATCH/DELETE /api/classrooms`.
- `GET/POST/DELETE /api/classrooms/:id/members`.
- `GET/POST/PATCH/DELETE /api/classrooms/:id/posts`.
- `PATCH /api/classrooms/:id/posts/:postId/publish`.
- `PATCH /api/classrooms/:id/posts/:postId/archive`.
- `GET/POST/PATCH/DELETE /api/classrooms/:id/documents`.
- `PATCH /api/classrooms/:id/documents/:documentId/publish`.
- `PATCH /api/classrooms/:id/documents/:documentId/archive`.

### Security

- Tat ca portal API can JWT.
- Admin xem/quan ly tat ca lop.
- Teacher chi xem lop minh la member hoac giao vien chu nhiem.
- Student chi xem lop minh la member.
- Teacher chi tao thong bao/tai lieu trong lop minh phu trach.
- Student khong duoc tao/sua/xoa noi dung lop.
- Student chi thay noi dung `published`.
- Teacher thay `published` va draft cua chinh minh.

### Cach test nhanh

1. Chay migration va seed:

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:migrate
npm run db:seed
```

2. Login admin lay token:

```powershell
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@pct.local\",\"password\":\"admin123\"}"
```

3. Tao lop:

```powershell
curl -X POST http://localhost:4000/api/classrooms -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d "{\"name\":\"12A1\",\"school_year\":\"2025-2026\",\"grade_level\":12,\"description\":\"Lop mau\"}"
```

4. Gan thanh vien:

```powershell
curl -X POST http://localhost:4000/api/classrooms/<classroom-id>/members -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d "{\"user_id\":<teacher-user-id>,\"role\":\"teacher\"}"
curl -X POST http://localhost:4000/api/classrooms/<classroom-id>/members -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d "{\"user_id\":<student-user-id>,\"role\":\"student\"}"
```

5. Test UI:

- Admin: `/admin/classrooms`.
- Teacher: `/teacher/classes`, `/teacher/classes/:id`, `/teacher/profile`.
- Student: `/student/classes`, `/student/classes/:id`, `/student/profile`.

### Ket qua tu kiem tra

- `npm run build` backend pass.
- `npm run build` frontend pass.
- `npm run db:migrate` pass voi migration `011_create_profiles_classrooms.sql`.
- `npm run db:seed` pass voi permission moi.
- Frontend build da tach cac trang portal/admin classrooms thanh chunks rieng.

### Gioi han hien tai

- Portal v1 chua co diem so, diem danh, nop bai online, chat realtime.
- Teacher document form v1 nhap `file_url` thu cong; co the tich hop media picker sau.
- Admin add member v1 dung `user_id`; co the cai tien thanh select/search user.
- Student class detail dang tai su dung component detail chung voi teacher, nhung UI action bi an theo role.

## Task - Classroom Workflow + Notifications + Timetable v1 + Login/Header polish

### Da tao/sua

- Classroom detail cho teacher/student duoc polish lai theo tabs: `Thong bao`, `Tai lieu`, `Thoi khoa bieu`, `Thanh vien`.
- Teacher classroom document form co upload file qua Media API va chon file document tu Media.
- Student classroom detail hien thi thong bao/tai lieu ro hon, co nut mo/tai file va empty state.
- Header public co account dropdown sau khi login va notification bell.
- Login page khong con tu dien san admin credentials; dev helper chi hien trong `import.meta.env.DEV`.

### Database migrations

- `012_create_notifications.sql`
  - Tao/cap nhat `notifications`.
  - Tao `user_notifications`.
- `013_create_timetables.sql`
  - Tao/cap nhat `timetables`.
  - Tao `timetable_items`.

### Backend APIs moi

Notifications:

```text
GET /api/notifications/me
GET /api/notifications/me/unread-count
PATCH /api/notifications/me/:id/read
PATCH /api/notifications/me/read-all
GET /api/notifications
POST /api/notifications
DELETE /api/notifications/:id
```

Timetable:

```text
GET /api/classrooms/:id/timetable
POST /api/classrooms/:id/timetable
PATCH /api/classrooms/:id/timetable/:timetableId
DELETE /api/classrooms/:id/timetable/:timetableId
```

Media:

- `POST /api/media/upload` va `GET /api/media` cho phep them permission `classroom_documents.manage` de teacher co the upload/chon file tai lieu lop.

### Notification workflow

- Khi teacher/admin publish classroom post, backend tao notification cho student members cua lop.
- Khi teacher/admin publish classroom document, backend tao notification cho student members cua lop.
- Student xem thong bao bang `/api/notifications/me`.
- Mark read tung thong bao bang `/api/notifications/me/:id/read`.
- Header lay unread count va 5 thong bao moi nhat de hien thi dropdown.

### Timetable workflow

- Teacher member cua lop hoac admin tao/sua thoi khoa bieu lop.
- Student member chi xem thoi khoa bieu lop minh.
- Teacher khong duoc tao/sua thoi khoa bieu lop khong thuoc minh.
- Timetable v1 gom Thu 2 -> Thu 7, tiet 1 -> tiet 5 trong UI.

### Cach test nhanh

1. Chay migration va seed:

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:migrate
npm run db:seed
```

2. Admin tao teacher/student va classroom trong `/admin/users`, `/admin/classrooms`.
3. Admin gan teacher/student vao classroom.
4. Login teacher:
   - vao `/teacher/classes/:id`.
   - tab `Tai lieu`: upload file hoac chon file tu Media.
   - tab `Thoi khoa bieu`: tao TKB.
   - publish thong bao/tai lieu.
5. Login student:
   - vao `/student/classes/:id`.
   - xem thong bao/tai lieu/thoi khoa bieu.
   - xem notification bell tren Header, mark read khi click notification.

### Ket qua tu kiem tra

- `npm run db:migrate` pass voi migration 012/013.
- `npm run db:seed` pass.
- `npm run build` backend pass.
- `npm run build` frontend pass.
- Smoke test API pass:
  - teacher publish classroom post tao notification cho student.
  - teacher publish classroom document tao notification cho student.
  - student unread count tu 2 ve 1 sau khi mark read 1 notification.
  - teacher tao timetable cho lop minh duoc.
  - student xem timetable lop minh duoc.
  - student bi chan khi xem timetable lop khac.
  - teacher bi chan khi tao timetable lop khong thuoc minh.
- LoginPage state mac dinh rong; admin credential chi fill khi bam nut dev trong moi truong DEV.
- Server smoke test da dung va user/classroom test da cleanup.

### Gioi han hien tai

- Notification dropdown chua co trang archive/day-du rieng.
- Admin notification UI chua duoc xay rieng; API admin da co.
- Timetable UI v1 co 6 ngay va 5 tiet co dinh; co the mo rong tiet/ngay sau.
- Teacher document picker chi list 30 media document moi nhat.
- Chua co upload progress chi tiet, preview file, hoac phan quyen media rieng theo lop.

## 12. Task 16 - Harden Users Management + Teacher/Student shell

Backend users management đã thêm các rule bảo vệ:

```text
PATCH /api/users/:id/status
- Không cho user đang đăng nhập tự chuyển chính mình sang inactive hoặc locked.
- Không cho khóa hoặc inactive admin active cuối cùng.

PATCH /api/users/:id/roles
- Không cho gỡ role admin khỏi admin active cuối cùng.

POST /api/auth/login
- User inactive hoặc locked vẫn bị từ chối đăng nhập.
```

Frontend route shell mới:

```text
/teacher
/student
```

Quyền truy cập:

```text
/teacher: role teacher hoặc admin
/student: role student hoặc admin
/admin: giữ nguyên yêu cầu admin/users.manage
```

Header public sau khi đăng nhập sẽ dẫn user về portal phù hợp:

```text
admin -> /admin
teacher -> /teacher
student -> /student
```

Cách test nhanh:

```bash
npm run build
```

Backend:

```bash
curl -X PATCH http://localhost:4000/api/users/<current-admin-id>/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"locked\"}"
```

Kỳ vọng trả lỗi 400 vì admin không được tự khóa chính mình.

Frontend:

```text
1. Tạo user teacher/student từ /admin/users.
2. Login teacher, mở /teacher thành công, mở /admin bị chặn.
3. Login student, mở /student thành công, mở /admin bị chặn.
4. Login admin, mở được /admin, /teacher, /student.
```

Kết quả tự kiểm tra Task 16:

```text
npm run build backend pass.
npm run build frontend pass.
Self-lock admin qua API trả 400.
Gỡ admin role khi chỉ còn một active admin qua API trả 400.
Locked user không login được.
Teacher vào /teacher được và bị chặn ở /admin.
Student vào /student được và bị chặn ở /admin.
Admin vào được /admin, /teacher, /student.
User test task16 đã cleanup khỏi database.
```

Sidebar admin đã thêm:

```text
Media / Tệp tin -> /admin/media
Tài liệu -> /admin/documents
```

Trang bị ảnh hưởng bởi Media Picker:

```text
/admin/posts/new
/admin/posts/:id/edit
```

Route public documents:

```text
/tai-lieu
/tai-lieu/:slug
```

Trang public đã polish:

```text
/
/tin-tuc
/tai-lieu
```

Components public mới:

```text
frontend/src/components/public/SectionHeading.tsx
frontend/src/components/public/EmptyState.tsx
frontend/src/components/public/PostCard.tsx
frontend/src/components/public/DocumentCard.tsx
```

Component admin editor mới:

```text
frontend/src/components/admin/RichTextEditor.tsx
```

Admin pages đang lazy-load:

```text
AdminPostsPage
AdminPostFormPage
AdminCategoriesPage
AdminDocumentsPage
AdminDocumentFormPage
AdminMediaPage
AdminDashboardPage
AdminUsersPage
AdminUserFormPage
```

## 4. Database media_files

Bảng `media_files` hiện đảm bảo các cột:

```text
id
original_name
file_name
mime_type
size
type
url
storage_path
uploaded_by
created_at
```

Migration mới:

```text
database/schema/007_ensure_media_files_upload_columns.sql
```

## 5. Cách test upload bằng UI

1. Chạy backend và frontend.
2. Đăng nhập admin tại `http://localhost:5173/dang-nhap`.
3. Vào `http://localhost:5173/admin/media`.
4. Chọn file ảnh hoặc tài liệu hợp lệ.
5. Kiểm tra file xuất hiện trong bảng media.
6. Nếu là ảnh, kiểm tra preview hiển thị.
7. Bấm `Copy URL` để copy đường dẫn public.
8. Mở URL dạng `http://localhost:4000/uploads/images/<file>.png`.
9. Bấm `Xóa` để xóa media record và file vật lý.

## 6. Cách dùng Media Picker trong Post Editor

1. Đăng nhập admin tại `http://localhost:5173/dang-nhap`.
2. Vào `http://localhost:5173/admin/posts/new` hoặc trang sửa bài viết.
3. Ở field `Cover image URL`, có thể nhập URL thủ công như trước.
4. Bấm `Chọn từ Media` để mở modal danh sách ảnh đã upload.
5. Tìm ảnh theo tên file nếu cần, sau đó bấm vào ảnh để tự fill `cover_image_url`.
6. Bấm `Upload ảnh mới` trong form bài viết để upload ảnh trực tiếp; sau khi upload thành công, URL ảnh được tự fill.
7. Kiểm tra preview cover hiển thị bên dưới field.
8. Lưu bài viết; backend nhận `cover_image_url` trong payload tạo/sửa bài viết như hiện tại.

## 7. Cách test Documents Module

Admin UI:

1. Chạy backend và frontend.
2. Đăng nhập admin tại `http://localhost:5173/dang-nhap`.
3. Vào `http://localhost:5173/admin/documents`.
4. Bấm `Tạo tài liệu mới`.
5. Nhập title, category, description.
6. Upload file mới hoặc chọn file từ media.
7. Chọn trạng thái `Nháp` hoặc `Đã xuất bản`.
8. Lưu, sau đó publish/archive/delete từ danh sách admin.

Public UI:

1. Vào `http://localhost:5173/tai-lieu`.
2. Kiểm tra danh sách chỉ hiển thị tài liệu `published`.
3. Dùng ô search theo tiêu đề.
4. Bấm `Xem` để vào `/tai-lieu/:slug`.
5. Bấm `Mở file` hoặc `Tải file` để kiểm tra file public qua `/uploads/documents/...`.

API curl:

```bash
curl "http://localhost:4000/api/documents?page=1&limit=10&status=published"
curl "http://localhost:4000/api/documents/<slug>"
curl "http://localhost:4000/api/documents?status=all" -H "Authorization: Bearer <token>"
curl -X POST http://localhost:4000/api/documents -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"title\":\"Quy chế mẫu\",\"category\":\"Công văn\",\"document_url\":\"/uploads/documents/file.pdf\",\"status\":\"draft\"}"
curl -X PATCH http://localhost:4000/api/documents/1/publish -H "Authorization: Bearer <token>"
```

## 7.1 Cách test Rich Text Editor cho Posts

1. Chạy backend và frontend.
2. Đăng nhập admin tại `http://localhost:5173/dang-nhap`.
3. Vào `http://localhost:5173/admin/posts/new`.
4. Nhập tiêu đề, slug nếu cần, mô tả ngắn.
5. Trong editor nội dung, thử:
   - Bold.
   - Italic.
   - Heading H2/H3.
   - Bullet list.
   - Ordered list.
   - Blockquote.
   - Link.
   - Image bằng URL.
   - Undo/redo.
6. Lưu bài viết với trạng thái `published`.
7. Mở `/tin-tuc/:slug` để kiểm tra nội dung render đúng style.
8. Mở lại `/admin/posts/:id/edit` để kiểm tra formatting vẫn còn.

Packages editor đã dùng:

```text
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/extension-image
dompurify
```

## 7.2 Cách test Admin Users Management

1. Chạy backend và frontend.
2. Đăng nhập admin tại `http://localhost:5173/dang-nhap`.
3. Vào `http://localhost:5173/admin/users`.
4. Bấm `Tạo tài khoản`.
5. Tạo user teacher:
   - email mới.
   - họ tên.
   - password tối thiểu 6 ký tự.
   - chọn role `teacher`.
6. Tạo user student tương tự với role `student`.
7. Vào trang sửa user để đổi họ tên, status hoặc roles.
8. Dùng nút `Khóa`/`Mở khóa` ở danh sách để đổi trạng thái nhanh.
9. Test user bị `locked` hoặc `inactive` login sẽ bị từ chối.

API curl:

```bash
curl "http://localhost:4000/api/users?page=1&limit=10" -H "Authorization: Bearer <token>"
curl "http://localhost:4000/api/roles" -H "Authorization: Bearer <token>"
curl -X POST http://localhost:4000/api/users -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"email\":\"teacher1@pct.local\",\"full_name\":\"Teacher 1\",\"password\":\"teacher123\",\"roles\":[\"teacher\"]}"
curl -X PATCH http://localhost:4000/api/users/1/status -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"status\":\"locked\"}"
curl -X PATCH http://localhost:4000/api/users/1/roles -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"roles\":[\"teacher\",\"student\"]}"
```

## 8. Cách test upload bằng curl

Login lấy token:

```bash
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@pct.local\",\"password\":\"admin123\"}"
```

Upload ảnh:

```bash
curl -X POST http://localhost:4000/api/media/upload -H "Authorization: Bearer <token>" -F "file=@C:/path/to/image.png;type=image/png"
```

Upload PDF:

```bash
curl -X POST http://localhost:4000/api/media/upload -H "Authorization: Bearer <token>" -F "file=@C:/path/to/file.pdf;type=application/pdf"
```

List media:

```bash
curl "http://localhost:4000/api/media?type=image&page=1&limit=20" -H "Authorization: Bearer <token>"
```

Delete media:

```bash
curl -X DELETE http://localhost:4000/api/media/1 -H "Authorization: Bearer <token>"
```

## 9. Giới hạn upload, Media Picker và Documents hiện tại

- File size tối đa: 10MB.
- Ảnh cho phép: `jpg`, `jpeg`, `png`, `webp`.
- Tài liệu cho phép: `pdf`, `doc`, `docx`, `xls`, `xlsx`.
- File khác đang bị chặn với message rõ ràng.
- Media Picker hiện chỉ lọc ảnh và lấy 20 ảnh mới nhất.
- Search trong Media Picker là search client-side trên danh sách đã tải.
- Documents chưa có taxonomy category riêng; category đang là text tự do.
- Admin Document Form hiện chọn 20 file document mới nhất từ media.
- Public Documents filter category dựa trên dữ liệu đang tải, chưa có endpoint category riêng cho documents.
- Homepage đang dùng ảnh nền học đường placeholder từ URL public, chưa phải ảnh thật của trường.
- Public UI chưa có menu mobile dạng drawer; header hiện dùng nav wrap responsive cơ bản.
- Rich Text Editor chưa upload ảnh trực tiếp trong nội dung; hiện chỉ chèn ảnh bằng URL.
- Chưa có resize/caption/align ảnh trong editor.
- Chưa có table, embed video, code block hoặc collaborative editing.
- Tiptap vẫn là chunk lớn riêng khi vào editor; chưa preload/prefetch theo intent.
- Users Management chưa có hard delete trong API; khóa/tạm ngưng là hướng chính hiện tại.
- Chưa có phân trang nâng cao UI ngoài next/previous đơn giản.
- UI đang chặn thao tác khóa chính tài khoản đang đăng nhập, nhưng backend chưa có rule riêng chống self-lock nếu gọi API trực tiếp.
- Chưa kéo thả ảnh, chưa crop/resize ảnh cover.
- Chưa resize ảnh, chưa tạo thumbnail.
- Chưa lưu file lên cloud storage.
- Chưa có virus scan.

## 10. Kết quả tự kiểm tra

- `npm run db:setup` pass.
- `npm run build` backend pass.
- `npm run build` frontend pass.
- Login admin thành công.
- Upload PNG bằng API thành công.
- Upload PDF bằng API thành công.
- List media theo `image` và `document` thành công.
- Ảnh upload mở được qua URL `/uploads/images/...`.
- Delete media xóa DB record và file vật lý.
- Chrome headless smoke test `/admin/media`:
  - route admin media mở được.
  - upload ảnh qua input file thành công.
  - list hiển thị file vừa upload.
  - bấm copy URL thành công.
  - xóa media qua UI thành công.
- Chrome headless smoke test Media Picker trong Post Editor:
  - mở `/admin/posts/new` sau khi đăng nhập admin.
  - upload ảnh cover mới từ form bài viết thành công.
  - `cover_image_url` tự fill sau upload.
  - preview cover hiển thị.
  - mở Media Picker và chọn ảnh đã upload trong media thành công.
  - tạo bài viết `published` có `cover_image_url`.
  - public API `/api/posts/:slug` đọc được bài viết và cover URL.
  - `/admin/media` vẫn hoạt động sau thay đổi.
- Documents Module:
  - migration `008_ensure_documents_module_columns.sql` chạy thành công.
  - upload PDF qua media API thành công.
  - tạo document `draft` bằng API thành công.
  - publish document bằng API thành công.
  - public `/api/documents` và `/api/documents/:slug` đọc được tài liệu published.
  - static file `/uploads/documents/...` mở được.
  - Chrome headless smoke test:
    - mở `/admin/documents/new`.
    - upload file trong admin document form.
    - `document_url` tự fill.
    - lưu document `published`.
    - public `/tai-lieu` hiển thị tài liệu.
    - public `/tai-lieu/:slug` hiển thị detail và nút mở/tải file.
  - Dữ liệu test documents/media đã cleanup.
- Public UI polish:
  - `npm run build` frontend pass.
  - `npm run build` backend pass.
  - Chrome headless smoke test `/`, `/tin-tuc`, `/tai-lieu`, `/dang-nhap`, `/admin` render không lỗi overlay.
  - Trang chủ gọi được API posts/categories/documents và hiển thị dữ liệu hoặc empty state.
- Rich Text Editor:
  - `npm run build` frontend pass.
  - Admin `/admin/posts/new` render Tiptap editor.
  - Tạo post `published` bằng editor với heading, bold text, bullet list và image URL thành công.
  - API lưu HTML trong `content` thành công.
  - Public `/tin-tuc/:slug` render heading/list/image trong `.rich-content`.
  - Edit post giữ lại formatting trong Tiptap editor.
  - Dữ liệu test rich text đã cleanup.
- Frontend performance polish:
  - `npm run build` frontend pass.
  - Build không còn warning chunk size lớn.
  - Initial `index` JS khoảng 299.65 kB, gzip khoảng 94.95 kB.
  - `RichTextEditor` được tách riêng thành chunk khoảng 386.52 kB, gzip khoảng 123.08 kB.
  - Admin page chunks được tách riêng, ví dụ `AdminPostFormPage` khoảng 10.43 kB.
  - Smoke test pass cho protected redirect, `/admin/posts`, `/admin/posts/new`, editor lazy chunk, edit rich content, public rich render và media picker.
- Admin Users Management:
  - `npm run build` backend pass.
  - `npm run build` frontend pass.
  - `GET /api/roles` pass.
  - Tạo teacher user bằng API pass.
  - Tạo student user bằng API pass.
  - List/filter users theo q/role/status pass.
  - Edit user và đổi role bằng API pass.
  - Khóa/mở khóa user bằng API pass.
  - User locked không login được.
  - Chrome headless smoke test `/admin/users`, `/admin/users/new`, tạo teacher/student qua UI, edit role/status qua UI pass.
  - Dữ liệu user test đã cleanup.
- Không phá health/auth/posts/categories/public posts.

## 11. Frontend routes hiện có

Public:

```text
/
/tin-tuc
/tin-tuc/:slug
/tai-lieu
/tai-lieu/:slug
/danh-muc/:slug
```

Admin:

```text
/admin
/admin/posts
/admin/posts/new
/admin/posts/:id/edit
/admin/categories
/admin/media
/admin/documents
/admin/documents/new
/admin/documents/:id/edit
/admin/users
/admin/users/new
/admin/users/:id/edit
```

## P0-SEC - Security baseline

### Phạm vi

- Vá dependency production có bản sửa tương thích.
- Thêm Helmet, CORS allowlist, API/login rate limiting và JSON body limit.
- Production fail-fast khi JWT secret hoặc CORS configuration không an toàn.
- Thêm request ID và không log request body trong error handler.

### Cấu hình mới

```env
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JSON_BODY_LIMIT=1mb
TRUST_PROXY_HOPS=0
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
LOGIN_RATE_LIMIT_MAX_REQUESTS=10
```

### Kết quả tự kiểm tra

- Backend build: pass.
- Frontend build với Vite 8: pass.
- Vite preview smoke test `/` và `/dang-nhap`: HTTP 200.
- Backend `npm audit`: 0 vulnerability.
- Các advisory Vite, PostCSS, DOMPurify và Multer có bản vá đã được xử lý.
- Health từ CORS origin hợp lệ: HTTP 200.
- CORS origin không hợp lệ: HTTP 403.
- JSON body lớn hơn giới hạn: HTTP 413.
- Login thất bại lần thứ 11 trong cửa sổ giới hạn: HTTP 429.
- Route không tồn tại vẫn trả HTTP 404.
- Helmet headers và `X-Request-Id` có trong response.
- `X-Powered-By` không còn trong response.
- Production HTTP app từ chối JWT secret development: pass.
- Database-only config vẫn load được mà không yêu cầu biến HTTP security: pass.

### Giới hạn còn lại

- Rate limit đang dùng memory store, chưa phù hợp nhiều backend instance.
- Auth vẫn dùng Bearer token lưu ở frontend local storage.
- Frontend audit còn advisory React Router liên quan RSC; ứng dụng hiện không
  sử dụng RSC nhưng cần nâng dependency khi có bản vá tương thích.
- Database integration chưa được xác nhận lại trong task security baseline.

## P0-DB - Chuyển PostgreSQL và chuẩn hóa migration

### Thay đổi

- Thay `mysql2` bằng `pg`.
- Backend dùng PostgreSQL 18.
- Thêm Docker Compose service `postgres`.
- Thêm PostgreSQL adapter có pool, transaction, timeout và placeholder conversion.
- Chuyển toàn bộ repository backend sang adapter PostgreSQL.
- Chuyển `GROUP_CONCAT`, `FIELD`, `INSERT IGNORE`, `ON DUPLICATE KEY` sang cú pháp PostgreSQL.
- Tạo canonical schema tại `database/postgresql/migrations/001_initial_schema.sql`.
- Tạo seeds PostgreSQL tại `database/postgresql/seeds`.
- Thêm `schema_migrations` với checksum SHA-256.
- Thêm advisory lock và transaction cho từng migration.
- Crawler Python chuyển từ MySQL connector sang `psycopg`.

### Cách chạy

```powershell
docker compose up -d postgres
cd backend
copy .env.example .env
npm run db:setup
npm run db:status
npm run dev
```

Hoặc dùng PostgreSQL native, không cần XAMPP.

### Kiểm tra đã chạy

- Backend TypeScript build: pass.
- PostgreSQL temporary cluster migration + seed: pass.
- PostgreSQL temporary cluster health/auth/categories/posts/RBAC smoke: pass.
- PostgreSQL temporary cluster post gallery create/detail smoke: pass.
- Crawler local dry-run preview: pass, 1 item.
- Crawler local import into `imported_contents`: pass, 1 record.
- Không còn import `mysql2`, `mysqlPool` hoặc `database/mysql` trong `backend/src`.
- Backend dependency audit: pass.
- Frontend build với Vite 8: pass.

### Chưa thể xác nhận trong môi trường hiện tại

- Docker chưa được cài.
- PostgreSQL native mặc định trên máy đang yêu cầu credential khác với user ứng
  dụng trong `.env`; test đã được thực hiện trên temporary PostgreSQL cluster
  riêng và pass.

### Quy tắc chuyển tiếp

- `database/schema` và `database/seeds` là MySQL legacy, không được chạy lại.
- Mọi migration mới phải đặt trong `database/postgresql/migrations`.
- Không sửa `001_initial_schema.sql` sau khi đã chạy; checksum mismatch phải dừng deployment.

## Task 4.3 - Notification Center UI

### Thay đổi

- Thêm route protected `/notifications` cho admin, teacher và student.
- Thêm list, filter chưa đọc, pagination, mark read và mark read all.
- Header notification dropdown chuyển sang React Query, tự đồng bộ unread
  count và refresh mỗi 60 giây.
- Mobile menu có link thông báo và unread badge.
- Chỉ điều hướng `related_url` dạng internal path hoặc HTTP/HTTPS.

### Kết quả tự kiểm tra

- Frontend build: pass; trang notification nằm trong lazy chunk riêng.
- Backend quality gate: pass; 14 unit tests và toàn bộ smoke tests pass.
- Student list notification thật: 2 records.
- Mark read giảm unread count: pass.
- Mark read all và unread filter về 0: pass.
- Backend health và Vite route `/notifications`: pass.

### Giới hạn

- Chưa có realtime/WebSocket; Header polling mỗi 60 giây.
- Chưa có notification preferences, retention và admin compose UI.

## Task 4.4 - Profile Management

### Thay đổi

- Thêm `POST /api/profiles/me/avatar` cho teacher/student.
- Avatar chỉ nhận JPG/PNG/WebP tối đa 5 MB và không yêu cầu student có quyền
  quản lý Media.
- Sửa PATCH profile để field không gửi không bị ghi thành `NULL`.
- Chặn local avatar path, validate phone và giới hạn bio.
- Thêm avatar upload/gỡ/URL trên teacher và student profile.
- Avatar đồng bộ trên profile, portal sidebar và Header.

### Kết quả tự kiểm tra

- Backend quality gate: pass; 16 unit tests và toàn bộ smoke tests pass.
- Frontend build: pass.
- Student/teacher partial PATCH: pass.
- Student avatar upload và static URL: pass.
- Invalid file/local path và admin without profile: bị chặn đúng.
- Media upload cũ sau khi tách Multer config: pass.

### Giới hạn

- Resize/crop và tối ưu ảnh thuộc Task 4.7.
- Chưa tự xóa avatar cũ và chưa có audit history.

## Task 4.5 - Events Module

### Thay đổi

- Thêm migration PostgreSQL `018_complete_events_module.sql`.
- Hoàn thiện backend `/api/events` với public list/detail và admin CRUD.
- Event mới mặc định ẩn, admin chủ động publish/hide.
- Thêm `/su-kien`, `/su-kien/:slug` và section sự kiện trên homepage.
- Thêm admin routes `/admin/events`, create/edit và status actions.
- Cover sự kiện có thể chọn từ Media.

### Kết quả tự kiểm tra

- Migration 018 và `db:setup`: pass.
- Backend quality gate: pass; 18 unit tests và schema contract pass.
- Frontend build: pass; main chunk khoảng 442 kB, không còn warning 500 kB.
- Private/public isolation, detail và CRUD actions: pass.
- Teacher quản trị event: bị từ chối 403 đúng.

### Giới hạn

- Chưa có calendar month view, recurring events hoặc registration.
- Chưa tạo notification tự động khi publish.
- Delete event hiện là hard delete.

## Workflow expansion - Academic Operations

### Thay đổi kế hoạch

- Tạo `TASK-TEMPLATE.md` làm Definition of Done thống nhất.
- Tạo đủ file còn thiếu cho Task 4.6–4.8.
- Chèn Phase 5 Academic Operations gồm 14 task trước production.
- Production chuyển thành Phase 6 với 8 task, bổ sung security/privacy,
  observability và load testing.
- Tạo `ACADEMIC-SCOPE.md` ánh xạ tab Admin/Teacher/Student/Guardian vào task.

### Quy tắc quan trọng

- Gradebook chỉ bắt đầu sau academic periods, subjects, enrollment, teaching
  assignments và assessment configuration.
- Role đúng nhưng sai lớp/môn/enrollment vẫn phải bị từ chối.
- Điểm, chuyên cần, hạnh kiểm và dữ liệu guardian là dữ liệu nhạy cảm.
- Không đánh dấu task hoàn thành nếu chỉ scaffold/build pass.

### Trạng thái

Chưa triển khai code học vụ. Sau khi hoàn thành Task 4.7, task thực thi tiếp
theo là 4.8; Phase 5 bắt đầu sau khi hoàn thành 4.7–4.8.

## Task 4.6 - Timetable Export & Print

### Thay đổi

- Thêm `TimetablePrintView` dùng chung cho admin, teacher và student.
- Thêm nút `In / Lưu PDF` và print stylesheet A4 landscape.
- Bản in chỉ giữ tên trường, lớp, năm học, học kỳ, ngày cập nhật và bảng tiết
  học; sidebar, navigation và action được ẩn.
- Mobile hiển thị lịch theo từng ngày; desktop và bản in dùng bảng đầy đủ.
- Teacher vẫn dùng editor hiện tại, nhưng có thêm preview/export trước form.
- Admin classroom detail hiển thị và xuất timetable thay vì chỉ có số liệu tóm
  tắt.

### Kết quả tự kiểm tra

- `npm run db:setup`: pass.
- Backend `npm run quality`: pass; 18 unit tests và toàn bộ smoke tests pass.
- Frontend `npm run build`: pass.
- Runtime health, admin login và timetable API: pass.
- Request timetable không đăng nhập: `401`.
- Chromium desktop `1440x1000` và mobile `390x844`: render pass.
- PDF test: một trang A4 landscape, không cắt cột.

### Giới hạn

- Dùng print-to-PDF của browser, chưa có file PDF tạo từ backend.
- Chưa có calendar sync hoặc Excel export.
- Một số dữ liệu timetable mẫu cũ trong database local đang bị mojibake; UI mới
  dùng tiếng Việt UTF-8 đúng nhưng task này không tự sửa dữ liệu lịch sử.

### Task tiếp theo

Task 4.7 - Media Image Optimization.

## Task 4.7 - Media Image Optimization

### Thay đổi

- Cài `sharp` cho backend.
- Thêm migration PostgreSQL `019_media_image_variants.sql` với dimensions,
  optimized size và JSONB variants.
- Chuyển upload media/avatar sang memory storage để kiểm tra ảnh trước khi ghi
  file.
- Chặn file giả mạo bằng decode ảnh thật, không chỉ dựa vào mimetype/extension.
- Giữ original và tạo:
  - thumbnail WebP tối đa 320px.
  - medium WebP tối đa 1280px.
- Không upscale, tự xoay EXIF và loại metadata khỏi derivative.
- Upload lỗi DB sẽ xóa file gốc và toàn bộ derivative.
- Admin Media/Media Picker dùng thumbnail preview và medium khi chọn ảnh.
- Avatar mới ưu tiên URL medium.

### Kết quả tự kiểm tra

- Backend build: pass.
- Frontend build: pass.
- Backend `npm run quality`: pass; 18 unit tests và toàn bộ smoke tests pass.
- `npm run db:setup`: pass; migration 019 chạy thành công.
- JPG, PNG, WebP landscape/portrait: upload và derivative pass.
- File giả mạo: bị từ chối `400`.
- Static original/thumbnail/medium: `200`.
- Xóa media: cả bản gốc và derivative trả `404`.

### Giới hạn

- Chưa xử lý ảnh bằng queue/background job.
- Chưa có AVIF, `srcset`, CDN hoặc object storage.
- Ảnh cũ chưa được backfill derivative.

Task kế tiếp là 4.8 - Admin Dashboard Stats.

## Task 4.8 - Admin Dashboard Operational Stats

### Thay đổi

- Thêm module backend dashboard:
  - `GET /api/dashboard/overview`
  - service cache 30 giây.
- Thêm permission `dashboard.read` và seed riêng để không tái sử dụng
  `users.manage` cho quyền chỉ đọc dashboard.
- Dashboard tổng hợp:
  - users theo status và role.
  - classrooms active/inactive.
  - posts/documents theo trạng thái.
  - importer pending/converted/error/skipped.
  - media original size, optimized size, ảnh và tài liệu.
  - events tổng số và upcoming.
  - 8 activity gần nhất, không chứa PII nhạy cảm.
- Thay dashboard placeholder bằng UI responsive có:
  - stat cards.
  - role summary.
  - content status.
  - recent activity.
  - importer warning.

### Kết quả tự kiểm tra

- `npm run db:setup`: pass; seed `005_dashboard_permission.sql` applied.
- Backend `npm run quality`: pass; 18 unit tests và toàn bộ smoke tests pass.
- Frontend `npm run build`: pass.
- Endpoint dashboard với admin: `200`.
- Endpoint dashboard không auth: `401`.
- Cache TTL: pass.
- Chromium desktop `1440x1000` và mobile `390x844`: render pass.
- Local runtime dashboard endpoint response pass với dữ liệu mẫu.

### Giới hạn

- Cache hiện chỉ nằm trong process.
- Chưa có biểu đồ lịch sử, export báo cáo hoặc dashboard học vụ.
- Phase 5 sẽ bổ sung số liệu attendance, gradebook, transcript và academic
  workflow theo quyền truy cập.

Phase 4 đã hoàn tất. Task tiếp theo là **5.1 - Academic Years & Semesters**.

## Task 5.1 - Academic Years & Semesters

### Thay đổi

- Thêm migration PostgreSQL `020_create_academic_periods.sql`.
- Thêm bảng `academic_years`, `semesters`, date overlap constraints và partial
  unique index chỉ cho một period active.
- Backfill foreign key `academic_year_id`/`semester_id` cho classrooms và
  timetables; giữ chuỗi legacy để tương thích.
- Thêm permission `academic_periods.manage` cho admin.
- Thêm module backend `/api/academic-periods`.
- Thêm admin UI `/admin/academic-periods`.
- Form lớp và editor thời khóa biểu chuyển sang chọn năm học/học kỳ chuẩn.
- Timetable write bị chặn khi period đã khóa hoặc đóng.

### Backfill local

```text
classrooms: 1/1 mapped, 0 unmapped
timetables academic year: 1/1 mapped, 0 unmapped
timetables semester: 1/1 mapped, 0 unmapped
active academic year: 2025-2026
active semester: chưa có tại ngày kiểm tra 2026-07-26
```

### Kết quả tự kiểm tra

- `npm run db:setup`: pass.
- Backend `npm run quality`: pass, gồm academic period smoke test mới.
- Frontend `npm run build`: pass.
- Admin CRUD/activate period: pass.
- Date range overlap: bị từ chối `409`.
- Teacher đọc period: `200`; teacher tạo period: `403`.
- Chỉ một semester active: pass.
- Closed semester chặn tạo timetable: `409`.
- Chromium desktop/mobile: render pass, không tràn ngang.

### Giới hạn

- Cột chuỗi năm học/học kỳ legacy chưa xóa; foreign key mới là source of truth
  cho write mới.
- Closed period chưa có flow reopen/audit; chỉ có lock/unlock trước khi close.
- Gradebook/attendance phải dùng period locking helper ở task tương ứng.

Task tiếp theo là **5.2 - Subjects & Curriculum**.

## Task 5.2 - Subjects & Curriculum

### Thay đổi

- Thêm migration PostgreSQL `021_create_subjects_curriculum.sql`.
- Thêm bảng `subjects`, `curriculum_subjects` và foreign key
  `timetable_items.subject_id`.
- Seed 16 môn THPT chuẩn và permission `subjects.manage`.
- Backfill toàn bộ tiết học cũ; tên không nhận diện chắc chắn được giữ dưới mã
  `LEGACY_*`, không làm mất `subject_name`.
- Thêm module backend `/api/subjects`, CRUD/import danh mục và chương trình theo
  năm học/khối.
- Chặn hard-delete môn đang được tham chiếu, mã môn immutable và môn inactive
  không thể được gán mới.
- Thêm admin UI `/admin/subjects`.
- Teacher timetable editor chọn môn theo curriculum thay cho nhập text tự do
  đối với dữ liệu mới.
- Thêm tài liệu vận hành `docs/subjects-curriculum.md`.

### Backfill local

```text
subjects: 21 (16 canonical, 5 legacy)
curriculum entries: 0
timetable items: 5/5 mapped, 0 unmapped
```

### Kết quả tự kiểm tra

- `npm run db:setup`: pass.
- Backend build: pass.
- Schema contract smoke test: pass.
- Subject/curriculum/RBAC/timetable smoke test: pass.
- Frontend production build: pass.
- Chromium desktop 1440 px/mobile 390 px: `/admin/subjects` render pass, đủ
  21 môn, tab chương trình hoạt động và không tràn ngang.
- Admin page lazy chunk: khoảng 15.84 kB trước gzip.

### Giới hạn

- Chưa seed chương trình cho từng năm/khối vì đây là dữ liệu nghiệp vụ cần admin
  xác nhận.
- 5 subject legacy do dữ liệu cũ bị mojibake cần đối chiếu thủ công.
- Import UI chưa đọc XLSX; task 5.14 sở hữu import/export học vụ hoàn chỉnh.
- Chưa có teaching assignment; task 5.4 sẽ dùng subject/curriculum làm đầu vào.

Task tiếp theo là **5.3 - Student Enrollment History**.

## Task 5.3 - Student Enrollment History

### Thay đổi

- Thêm migration PostgreSQL `022_create_student_enrollments.sql`.
- Thêm bảng `student_enrollments`, partial unique index bảo đảm một enrollment
  active cho mỗi học sinh/năm học và trigger bảo vệ identity của record lịch sử.
- Backfill student membership cũ, xử lý conflict theo thứ tự xác định.
- Thêm permission `enrollments.manage` cho admin.
- Thêm module backend `/api/enrollments` với list/detail/self history, assign,
  transfer và kết thúc trạng thái.
- Transfer lớp chạy transaction, kết thúc record cũ và tạo record mới có
  `previous_enrollment_id`.
- Classroom scope, roster, notifications và bulk student account đã chuyển sang
  enrollment active; endpoint member cũ được giữ làm compatibility path.
- Lớp có enrollment history không còn được hard-delete.
- Thêm admin UI `/admin/enrollments` và student UI `/student/enrollments`.
- Thêm tài liệu vận hành `docs/student-enrollments.md`.

### Backfill local

```text
student enrollments: 2
active: 2
transferred: 0
active conflicts: 0
compatibility classroom members: 2
```

### Kết quả tự kiểm tra

- `npm run db:setup`: pass và idempotent.
- Backend `npm run quality`: pass toàn bộ.
- Enrollment smoke test: assign, duplicate conflict, role isolation, transfer,
  status end và compatibility path đều pass.
- Student bulk account smoke test: pass.
- Frontend `npm run build`: pass.
- Chromium desktop/mobile: admin và student history render dữ liệu thật.
- Mobile admin không tràn ngang: viewport/document width `390/390`.
- Admin chunk khoảng 14.64 kB; student history chunk khoảng 3.27 kB trước gzip.

### Giới hạn

- Chưa import danh sách xếp lớp từ XLSX; thuộc Task 5.14.
- Chưa có workflow phê duyệt/đính kèm quyết định chuyển lớp.
- Student membership cũ vẫn được đồng bộ tạm thời để tương thích; code mới phải
  dùng `student_enrollments` làm source of truth.
- Teaching assignment và lịch sử giáo viên phụ trách thuộc Task 5.4.

Task tiếp theo là **5.4 - Teaching Assignments**.

## Task 5.4 - Teaching Assignments

### Thay đổi

- Thêm migration PostgreSQL `023_create_teaching_assignments.sql`.
- Thêm bảng `teaching_assignments`, enum role/status, constraint, trigger kiểm
  tra teacher/class/subject/semester và partial unique index cho assignment
  active.
- Thêm foreign key optional `timetable_items.teaching_assignment_id`; timetable
  validate đúng assignment và chuẩn hóa tên giáo viên khi có reference.
- Backfill best-effort từ timetable chỉ khi dữ liệu khớp chính xác, không tạo
  quyền từ tên chuỗi đoán.
- Thêm permission `teaching_assignments.manage` cho admin.
- Thêm backend module `/api/teaching-assignments`, bulk create atomic và helper
  `canTeachSubjectInClass`.
- Classroom membership/homeroom không tự động cấp quyền giáo viên bộ môn.
- Chặn hard-delete classroom/subject đã có assignment history.
- Thêm admin UI `/admin/teaching-assignments`.
- Thêm teacher UI `/teacher/teaching-assignments`.
- Deduplicate restore-session request ở frontend để React Strict Mode không
  rotate refresh token hai lần và làm mất đăng nhập khi reload protected route.
- Thêm tài liệu vận hành `docs/teaching-assignments.md`.

### Backfill local

```text
teaching assignments: 0
active: 0
timetable items linked: 0/5
curriculum subjects: 0
```

Dữ liệu local chưa có curriculum được xác nhận nên migration không đoán
assignment từ timetable cũ.

### Kết quả tự kiểm tra

- `npm run db:setup`: pass và idempotent.
- Backend `npm run quality`: pass toàn bộ.
- Teaching assignment smoke test: create, duplicate, bulk rollback, role
  isolation, multi-teacher, inactive policy và timetable reference đều pass.
- Frontend production build: pass.
- Admin lazy chunk khoảng 14.32 kB; teacher lazy chunk khoảng 4.06 kB trước
  gzip.
- Runtime API health/login/create/detail/list: pass; fixture tạm được xóa sau
  kiểm tra.
- Reload trực tiếp protected route giữ session: pass; refresh cookie không bị
  request song song làm revoke.
- Chromium desktop/mobile: trang admin và teacher render, responsive, không
  tràn ngang.

### Giới hạn

- Chưa có import phân công từ XLSX; thuộc Task 5.14.
- Chưa có approval workflow hoặc file quyết định phân công.
- Local cần cấu hình curriculum thật trước khi admin tạo assignment.
- Gradebook chưa triển khai; task tiếp theo phải cấu hình đầu điểm và version
  công thức trước.

Task tiếp theo là **5.5 - Assessment Configuration**.

## Task 5.5 - Assessment Configuration

### Thay đổi

- Thêm migration `024_create_assessment_configurations.sql`.
- Thêm migration hardening `025_harden_assessment_configuration_transitions.sql`.
- Thêm bảng `assessment_configurations`, `assessment_categories`, enum
  status/rounding và các unique/constraint trigger.
- Mỗi subject/semester/grade chỉ có một draft và một active version.
- Active/archived version immutable; activate version mới archive version cũ.
- Tổng trọng số categories phải bằng đúng 100 ở validation và transaction
  commit.
- Thêm permission `assessment_configurations.manage`.
- Thêm backend module `/api/assessment-configurations`.
- Thêm backend calculator preview với `half_up`, `half_even`, `truncate`.
- Teacher scope lấy từ teaching assignment active, không từ classroom member.
- Usage count của subject/semester/year bao gồm assessment configuration.
- Thêm admin UI `/admin/assessment-configurations`.
- Thêm teacher UI `/teacher/assessment-configurations`.
- Thêm tài liệu `docs/assessment-configurations.md`.

### Công thức

```text
category_average = sum(scores) / count(scores)
normalized_score = category_average / category_scale * result_scale
weighted_score = normalized_score * weight_percent / 100
raw_score = sum(weighted_score)
final_score = configured rounding(raw_score)
```

Sample runtime:

```text
TX [8, 9] x 40% + CK [7.5] x 60% = 7.9/10
```

### Kết quả tự kiểm tra

- `npm run db:setup`: pass.
- Backend `npm run quality`: pass toàn bộ.
- Vitest: 22 tests pass, gồm 4 formula/rounding tests.
- Assessment smoke: invalid weight, teacher 403, activate, version history,
  semester lock và raw DB immutability đều pass.
- Frontend production build: pass.
- Admin lazy chunk khoảng 16.84 kB; teacher chunk khoảng 6.19 kB.
- Chromium admin/teacher runtime: config active hiển thị đúng, calculator trả
  `7.9/10`.
- Mobile admin sau fix: viewport/document `390/390`.
- Fixture runtime được cleanup, không để dữ liệu học vụ giả.

### Giới hạn

- Chưa lưu điểm học sinh; đây là configuration foundation.
- Chưa có approval workflow cho tổ trưởng/ban giám hiệu.
- Chưa có category optional hoặc expression formula tùy biến.
- Gradebook Task 5.8 bắt buộc tham chiếu configuration version.

Task tiếp theo là **5.6 - Attendance Management**.

## Task 5.6 - Attendance Management

### Thay đổi

- Thêm migration PostgreSQL `026_create_attendance_management.sql`.
- Thêm `attendance_sessions`, `attendance_records`,
  `attendance_record_audits` và status enum.
- Unique session theo lớp/học kỳ/ngày/tiết/môn; unique student/session.
- Roster lấy từ enrollment có hiệu lực đúng ngày học.
- Bulk attendance chạy transaction; một row sai scope rollback toàn bộ.
- Chỉnh dữ liệu ngày cũ bắt buộc lý do và ghi audit actor/old/new.
- Teacher scope theo teaching assignment active hoặc homeroom, không theo role
  đơn thuần.
- Student chỉ đọc attendance record của chính mình.
- Thêm API `/api/attendance` cho session, bulk records, audit, self history và
  summary theo học kỳ/khoảng ngày.
- Thêm admin UI `/admin/attendance`, teacher UI `/teacher/attendance`, student
  UI `/student/attendance`.
- Cập nhật usage count học kỳ/năm học để tính attendance session.
- Thêm tài liệu `docs/attendance-management.md`.

### Kết quả tự kiểm tra

- `npm run db:setup`: pass; migration `026` và seed `011` đã áp dụng.
- Backend `npm run quality`: pass toàn bộ.
- Vitest: 22 tests pass.
- Attendance smoke: create session, full/partial save, foreign teacher 403,
  student privacy, atomic rollback, audit correction, semester/date totals đều
  pass.
- Frontend production build: pass.
- Lazy chunks trước gzip: admin khoảng 6.40 kB, teacher khoảng 10.48 kB,
  student khoảng 4.19 kB.
- Runtime local `http://localhost:5173/admin/attendance`: desktop/mobile render
  đúng, không overflow (`1440/1440`, `390/390`).
- Phát hiện và sửa mapper PostgreSQL `DATE` bị lùi ngày do `toISOString()`; test
  runtime đã khóa regression.
- Fixture smoke được cleanup, không để lại attendance/user/class giả.

### Giới hạn

- Chưa gửi notification tự động khi vắng hoặc đi trễ.
- Chưa có import/export attendance và báo cáo in/PDF.
- Chưa có workflow khóa/chốt phiên điểm danh.
- Teacher UI v1 tập trung bulk entry; audit detail hiện có qua API nhưng chưa có
  panel lịch sử riêng trên UI.

Task tiếp theo là **5.7 - Assignments & Homework**.

## Task 5.7 - Assignments & Homework

### Thay đổi

- Thêm migration PostgreSQL `027_create_assignments_homework.sql`.
- Thêm seed `012_assignment_permissions.sql` với `assignments.manage` và
  `assignments.read`.
- Thêm `assignments`, `assignment_attachments`, `assignment_submissions`,
  `assignment_submission_files`, `assignment_submission_audits`.
- Assignment bắt buộc tham chiếu `teaching_assignment_id`; database trigger
  kiểm tra class/subject/semester và deadline nằm trong semester.
- Thêm backend module `/api/assignments` cho list/detail/create/update,
  publish/close/delete, list submission và upload submission.
- Teacher scope theo teaching assignment và ownership; student scope theo
  enrollment tại ngày publish.
- Publish gửi notification đúng roster học sinh tại ngày publish.
- Submission upload qua media pipeline, tối đa 10 MB; replace tạo version mới
  và audit, không xóa phiên bản cũ.
- Nếu transaction submit thất bại, media vừa tạo được xóa bù để không còn file
  mồ côi.
- Thêm UI `/admin/assignments`, `/teacher/assignments`,
  `/student/assignments` và link điều hướng trên ba portal.
- Thêm tài liệu `docs/assignments-homework.md`.

### Kiểm tra

- Migration `027` và seed `012`: pass.
- Backend TypeScript build: pass.
- Frontend production build: pass.
- Backend `npm run quality`: pass toàn bộ, gồm 22 unit tests và các smoke test
  học vụ trước đó.
- Smoke `npm run test:assignments`: pass.
- Foreign teacher create: 403.
- Foreign student detail: 403.
- Publish notification: đúng roster student fixture.
- Submit PDF và replace: version 1/2, chỉ một file active, audit submit/replace.
- Submit sau khi close: 409; media count không đổi.
- Fixture user/class/subject/assignment/media được cleanup.
- Runtime local `/admin/assignments`: desktop và mobile render đúng, không
  overflow ngang (`1440/1440`, `390/390`).

### Build chunks

- Admin assignments: khoảng 5.22 kB trước gzip.
- Teacher assignments: khoảng 11.76 kB trước gzip.
- Student assignments: khoảng 7.60 kB trước gzip.

### Giới hạn

- Chưa chấm điểm/feedback trên submission; gradebook bắt đầu ở Task 5.8.
- Teacher attachment v1 nhận URL media hợp lệ; student submission đã hỗ trợ
  upload file thật.
- Chưa có rubric, bulk assignment hay import/export.

Task tiếp theo là **5.8 - Gradebook & Teacher Grade Entry**.

## Task 5.8 - Gradebook & Teacher Grade Entry

### Thay đổi

- Thêm migration `028_create_gradebook_foundation.sql` với `gradebooks`,
  `gradebook_columns`, `student_scores`, `student_score_audits`.
- Thêm seed `013_gradebook_permissions.sql`.
- Thêm backend module `/api/gradebooks`.
- Teacher chỉ mở và nhập sổ theo active teaching assignment của chính mình.
- Gradebook snapshot cột từ assessment configuration active.
- Bulk save chạy một transaction và dùng version từng ô.
- Mọi insert/update score ghi audit actor, old/new value và version.
- PostgreSQL `NUMERIC` tính tổng kết và rounding.
- Thêm `/teacher/gradebook`, `/admin/gradebooks`, `/student/grades`.
- Teacher grid có autosave status, arrow-key navigation, vắng/miễn và tổng kết.
- Student không thấy gradebook draft.

### API

```text
GET  /api/gradebooks
POST /api/gradebooks
GET  /api/gradebooks/:id
PUT  /api/gradebooks/:id/scores
GET  /api/gradebooks/:id/audit
GET  /api/gradebooks/me
```

### Kiểm tra

- `npm run db:setup`: pass migration 028 và seed 013.
- Backend build và frontend production build: pass.
- `npm run test:gradebooks`: pass với 40 học sinh, 80 score entries.
- Điểm 0, 7.25, absent, exempt và formula rounding: pass.
- Foreign teacher: 403.
- Stale version: 409 và rollback toàn batch.
- Student draft isolation: pass.

### Giới hạn

- Gradebook hiện chỉ có `draft`.
- Submit/approve/reject/lock/publish thuộc Task 5.9.
- Student transcript/report card thuộc Task 5.10.
- Import/export bảng điểm thuộc Task 5.14.

Task tiếp theo là **5.9 - Grade Approval, Locking & Audit**.

## Task 5.9 - Grade Approval, Locking & Audit

### Thay đổi

- Thêm migration `029_create_grade_approval_workflow.sql` và seed
  `014_gradebook_review_permission.sql`.
- Thêm state machine `draft -> submitted -> approved -> locked`.
- Reject đưa sổ về `draft` và bắt buộc lý do.
- Sổ đã khóa chỉ mở lại qua change request được reviewer duyệt.
- Trigger PostgreSQL chặn mọi ghi/xóa điểm ngoài trạng thái `draft`.
- Audit điểm và workflow là immutable.
- Giáo viên có thao tác gửi duyệt/yêu cầu sửa; admin có hàng đợi duyệt, khóa,
  xử lý yêu cầu và xuất audit CSV.
- Học sinh xem điểm đã duyệt/khóa tại `/student/grades`.

### API mới

```text
POST /api/gradebooks/:id/submit
POST /api/gradebooks/:id/approve
POST /api/gradebooks/:id/reject
POST /api/gradebooks/:id/lock
POST /api/gradebooks/:id/change-requests
GET  /api/gradebooks/change-requests
POST /api/gradebooks/change-requests/:requestId/approve
POST /api/gradebooks/change-requests/:requestId/reject
GET  /api/gradebooks/:id/workflow-audit
```

### Kiểm tra

- `npm run db:setup`: pass migration 029 và seed 014.
- Backend quality suite và frontend production build: pass.
- `npm run test:gradebooks`: pass với 40 học sinh.
- Double submit idempotent; reject thiếu lý do trả 400.
- Ghi điểm khi submitted/locked trả 409; direct SQL bị trigger chặn.
- Student không thấy draft/submitted và thấy approved.
- Change request trùng không tạo thêm pending request; teacher không tự review.
- Workflow audit đủ submit, reject, approve, lock và change request.

### Giới hạn

- Chưa có reviewer group riêng ngoài admin permission.
- Chưa dùng transactional outbox cho notification.
- Transcript và report card thuộc Task 5.10.

Task tiếp theo là **5.10 - Student Transcript & Report Card**.

## Task 5.10 - Student Transcript & Report Card

### Thay đổi

- Thêm migration `030_create_student_report_snapshots.sql` và seed permission
  `015_transcript_permissions.sql`.
- Thêm module backend `transcripts` với API self, student detail, classroom
  roster và snapshot học kỳ.
- Student chỉ xem điểm `approved`/`locked` của chính mình.
- Giáo viên chủ nhiệm xem toàn bộ lớp; giáo viên bộ môn chỉ xem môn được phân
  công; giáo viên ngoài phạm vi nhận 403.
- Snapshot bất biến được tạo trước khi khóa/đóng học kỳ hoặc đóng năm học.
- Tối ưu snapshot hàng loạt: tổng điểm mỗi gradebook chỉ được tải một lần.
- Thêm trang `/student/grades`, `/teacher/report-cards`,
  `/admin/report-cards` và bản in A4.

### API mới

```text
GET  /api/transcripts/me
GET  /api/transcripts/students/:studentId
GET  /api/transcripts/classrooms/:classroomId
POST /api/transcripts/semesters/:semesterId/snapshot
```

### Kiểm tra

- `npm run db:setup`: pass migration 030 và seed 015.
- Backend build và `npm run test:gradebooks`: pass với 40 học sinh.
- Frontend production build: pass.
- Draft score hidden; cross-student và unrelated-teacher trả 403.
- Historical semester trả snapshot ổn định sau khi gradebook được mở lại.
- Print stylesheet dùng `@page { size: A4 portrait; }` và không chứa ID/audit.

### Giới hạn

- PDF dùng print dialog trình duyệt, chưa sinh PDF ký số ở backend.
- Điểm trung bình chưa có trọng số môn hoặc quy tắc xếp loại.
- Snapshot toàn học kỳ chạy đồng bộ; production quy mô lớn nên chuyển thành
  background job.
- Hạnh kiểm và nhận xét chủ nhiệm thuộc Task 5.11.

Task tiếp theo là **5.11 - Conduct & Homeroom Comments**.

## Task 5.11 - Conduct & Homeroom Comments

### Thay đổi

- Thêm migration `031_create_student_conduct_records.sql` và seed
  `016_conduct_permissions.sql`.
- Thêm backend module `/api/conduct` với phân quyền theo giáo viên chủ nhiệm,
  admin reviewer và chính học sinh.
- Thêm quy trình `draft -> submitted -> approved -> locked`; thao tác reject
  đưa bản ghi về draft và bắt buộc có lý do.
- Thêm audit bất biến cho thay đổi rating, nhận xét và trạng thái.
- Thống kê chuyên cần được trả cùng roster để tham khảo nhưng không tự động
  quyết định mức rèn luyện.
- Thêm `/teacher/conduct`, `/admin/conduct` và link điều hướng tương ứng.
- Tích hợp rating/nhận xét vào report card live và snapshot lịch sử.
- Thêm tài liệu vận hành `docs/student-conduct.md`.

### API mới

```text
GET  /api/conduct/me
GET  /api/conduct
PUT  /api/conduct/students/:studentId
POST /api/conduct/:id/submit
POST /api/conduct/:id/approve
POST /api/conduct/:id/reject
POST /api/conduct/:id/lock
GET  /api/conduct/:id/audit
```

### Kiểm tra

- `npm run db:setup`: pass migration 031 và seed 016.
- Backend `npm run quality`: pass toàn bộ build, unit tests và smoke tests.
- Frontend production build: pass.
- Runtime health/database/login và roster conduct: pass.
- Non-homeroom teacher: 403.
- Homeroom roster trả đúng student ID cho học sinh chưa có bản ghi.
- Draft bị ẩn với học sinh; approved/locked xem được.
- Teacher submit thành công nhưng không thể tự approve.
- Admin approve/lock thành công; locked record không thể sửa.
- Audit create/submit/approve/lock đầy đủ và không thể xóa trực tiếp.
- Transcript live và snapshot đều giữ rating/nhận xét.

### Giới hạn

- Chưa có bulk approve/lock và change request cho bản ghi đã khóa.
- Chưa có notification cho workflow rèn luyện.
- Rating vẫn là quyết định nghiệp vụ của giáo viên/admin, không tự suy diễn từ
  chuyên cần.

Task tiếp theo là **5.12 - Parent & Guardian Portal**.

## Task 5.12 - Parent & Guardian Portal

### Thay đổi

- Thêm migration `032_create_guardian_portal.sql` và seed
  `017_guardian_permissions.sql`.
- Thêm role `guardian`, liên kết nhiều-nhiều guardian-student và workflow
  `pending -> verified -> revoked`.
- Thêm backend module `/api/guardians` với kiểm tra verified link trên mỗi request.
- Thêm audit bất biến cho link lifecycle và lượt truy cập summary.
- Thêm `/admin/guardians`, `/parent`, `/parent/students/:id`.
- Phụ huynh xem chuyên cần, report card/rèn luyện đã công bố, notification và
  chỉnh preference cơ bản.
- Header/login redirect nhận biết role guardian.
- Notification target role hỗ trợ `guardian`.

### Kiểm tra

- Migration 032 và seed 017: pass.
- Backend quality suite và guardian smoke: pass.
- Runtime health/database/login, guardian API và hai SPA route: pass.
- Pending hidden, verified access pass, cross-family 403.
- Multi-child switch: pass.
- Revocation chặn ngay request tiếp theo bằng token cũ: pass.
- Link/access audit: pass; direct audit delete bị chặn.
- Frontend production build: pass.

### Giới hạn

- Chưa có email/SMS invitation hoặc identity verification tự động.
- Chưa có self-service password recovery.
- Preference chưa kết nối worker email/SMS.
- Admin selector v1 tải tối đa 50 user mỗi role.

Task tiếp theo là **5.13 - Student Requests & School Forms**.

## Task 5.13 - Student Requests & School Forms

### Thay đổi

- Thêm migration `033_create_student_requests_forms.sql` và seed
  `018_student_request_permissions.sql`.
- Thêm loại đơn, đơn học sinh, attachment riêng tư và status history bất biến.
- Thêm backend module `/api/student-requests` với scope owner, GVCN và admin.
- Thêm notification khi submit và khi có quyết định; nội dung notification
  không chứa dữ liệu nhạy cảm.
- Thêm `/student/requests`, `/teacher/student-requests` và
  `/admin/student-requests`.
- Admin cấu hình loại đơn/SLA; học sinh upload nhiều tệp trước khi submit;
  reviewer xem lịch sử, tiếp nhận, duyệt hoặc từ chối có lý do.
- Tài liệu vận hành: `docs/student-requests-forms.md`.

### Kiểm tra

- `npm run db:setup`: pass migration 033 và seed 018.
- Backend `npm run quality`: pass toàn bộ build, unit test và smoke test cũ/mới.
- Frontend production build: pass; ba trang mới được lazy-load.
- Required attachment/reason: pass.
- Draft chỉ owner thấy; admin/reviewer truy cập trước submit nhận 403.
- Cross-student, unrelated teacher và wrong reviewer scope: 403.
- Private attachment owner download: pass; unrelated teacher: 403; upload
  response không lộ `storage_path`.
- Transition matrix và history immutable: pass.
- Notification cho admin/GVCN/học sinh: pass.

### Giới hạn

- UI chưa sinh form động từ `form_schema`.
- Chưa có workflow nhiều cấp, ký số hoặc số văn bản.
- Approval không tự sửa dữ liệu hồ sơ.
- Private attachment v1 lưu local disk; production multi-instance cần object
  storage private.

Task tiếp theo là **5.14 - Academic Import/Export & Reports**.

## Task 5.14 - Academic Import/Export & Reports

### Thay đổi

- Thêm migration `034_create_academic_import_jobs.sql` và seed quyền
  `019_academic_import_export_permissions.sql`.
- Thêm module backend `/api/academic-operations` cho template, preview,
  validation, commit, job audit, error export và báo cáo CSV.
- Hỗ trợ bốn contract import: enrollment, assignment, attendance và grade.
- Import attendance/grade tái sử dụng service hiện hữu để giữ transaction,
  semester lock, score version và audit.
- Thêm trang `/admin/academic-operations` và sidebar admin.
- Thêm tài liệu vận hành `docs/academic-import-export-reports.md`.
- Thêm smoke test `tests/academic-operations.smoke.ts` vào quality gate.

### Kiểm tra

- `npm run db:setup`: pass migration 034 và seed 019.
- Backend/frontend production build: pass.
- Smoke test: RBAC, valid/invalid file, atomic commit, idempotency, 1.001 dòng,
  Excel BOM, roster export và report summary đều pass.
- Runtime backend `4001`: health, login và report API pass.
- Production dependency audit sau khi chọn `csv-parse`: không có vulnerability.

### Quyết định kỹ thuật

- Dùng CSV UTF-8 BOM thay vì XLSX native. `exceljs` đã được thử nghiệm nhưng bị
  gỡ vì dependency tree có high-severity audit finding.
- File nguồn không được giữ lại; database chỉ lưu preview chuẩn hóa, lỗi và
  audit metadata.
- V1 giới hạn 2 MB/2.000 dòng và chạy đồng bộ. Queue/worker là yêu cầu bắt buộc
  trước khi nâng giới hạn production.

Task tiếp theo là **6.1 - Production Security & Privacy Audit**.
## Task 6.1 - Production Security & Privacy Audit

### Đã thực hiện

- Lập ma trận RBAC/ownership và kiểm kê PII cho toàn bộ nhóm API.
- Request/error log chỉ ghi pathname, không ghi query string; Pino redact
  password, token, Authorization và cookie.
- Refresh cookie đổi sang `SameSite=Strict`; auth response dùng
  `Cache-Control: no-store`; access token mặc định 15 phút.
- Revoke toàn bộ refresh session khi password, role hoặc status user thay đổi.
- Password tài khoản tạo thủ công yêu cầu tối thiểu 10 ký tự, có chữ và số.
- PDF/Office upload được kiểm tra magic bytes; static upload từ chối dotfile,
  directory index và bật `nosniff`.
- PostgreSQL TLS production mặc định xác minh certificate.
- Nâng React Router lên 7.18.2 và ghi mitigation cho advisory RSC không áp dụng
  với BrowserRouter SPA hiện tại.
- Thêm `tests/security-privacy.smoke.ts` vào backend quality gate.
- Viết lại `docs/security.md` và thêm `docs/security-privacy-audit.md`.

### Kiểm tra

- Backend build, unit tests và toàn bộ `npm run quality`: pass.
- Frontend production build: pass.
- CORS origin lạ: 403.
- Student gọi users API: 403.
- Lock user/đổi role: refresh session cũ bị từ chối 401.
- PDF giả: 400; PDF đúng signature upload và delete: pass.
- Backend production dependency audit: 0 vulnerability.

### Giới hạn và production blockers

- Rate limit memory store phải chuyển shared store khi chạy nhiều instance.
- Upload local chưa có malware scan/object storage.
- Chưa có MFA, password recovery và first-login password change.
- Retention cleanup chưa tự động.
- Container scan chờ Task 6.2 tạo image.

Task tiếp theo là **6.2 - Docker Setup**.
## Task 6.2 - Docker Setup (runtime gate pending)

### Đã triển khai

- Multi-stage backend image dùng Node 22.23.1 Alpine.
- Multi-stage frontend image dùng Node build và Nginx unprivileged
  1.30.4-alpine3.24.
- Compose stack gồm PostgreSQL, backend và frontend.
- Backend non-root, read-only filesystem, drop capabilities và graceful
  shutdown.
- Migration/seed chạy tự động trước khi backend start.
- Named volume riêng cho PostgreSQL, public upload và private upload.
- Nginx proxy `/api` và `/uploads`; frontend build dùng same-origin `/api`.
- Không có secret mặc định; `.env.docker` bị ignore.
- Thêm runbook `docs/docker-deployment.md` và script
  `tools/verify-docker.ps1`.
- Chuyển `pino-pretty` khỏi production dependencies.

### Đã kiểm tra

- Backend build và quality suite: pass.
- Frontend build với `VITE_API_BASE_URL=/api`: pass.
- Compiled migration runner `dist/database/migrate.js status`: pass.
- PowerShell verification script parse: pass.
- Dockerfile/Compose static markers: pass.
- Backend production dependency audit: 0 vulnerability.

### Runtime gate hoàn tất

- Docker Desktop 4.84.0, WSL 2.7.11 và Trivy 0.72.0 hoạt động.
- Compose migrate/start/health: pass.
- Database và public/private upload tồn tại sau restart: pass.
- Backend chạy non-root UID 1000: pass.
- Backend, frontend và PostgreSQL image: 0 HIGH/CRITICAL.
- PostgreSQL 18 dùng đúng data root `/var/lib/postgresql`.
- Frontend local được bind tại `127.0.0.1:18080` vì cổng 8080 của máy đang bị
  `AgentService` sử dụng.

Task 6.2 đã hoàn thành.

## Task 6.3 - CI/CD Pipeline

### Đã triển khai

- Thêm GitHub Actions quality gate cho backend, frontend, migration, dependency
  audit, image build và Trivy scan.
- Image release dùng full commit SHA; push GHCR chỉ từ `main`.
- Thêm release manifest và deploy workflow cho staging/production.
- Thêm script deploy, smoke test và rollback release.
- Thêm runbook `docs/cicd-deployment.md` và security exception registry.
- Thêm seed `020_sample_academic_period.sql` để database trắng có năm học/học
  kỳ mẫu đúng chuẩn và liên kết lớp mẫu.
- Sửa smoke test subjects tự tạo/xóa năm học riêng, không phụ thuộc test trước.

### Đã kiểm tra

- Backend full `npm run quality` trên PostgreSQL mới hoàn toàn: pass.
- Migration/seed mới: pass; local migration ledger có 43 bản ghi.
- Backend production audit: 0 vulnerability.
- Frontend dependency policy và production build: pass.
- Workflow syntax: pass với `actionlint 1.7.12`.
- Local deploy A -> B, smoke và rollback B -> A: pass.
- Docker health, restart persistence và ba image scans: pass.

### External gates đã chạy

- Source đã push lên `https://github.com/bebokaka99/THPT-PCT`.
- Quality Gate #1 cho commit `0016c0b`: success.
- Backend, frontend và immutable container images jobs đều pass.
- Release manifest artifact đã được tạo.
- Ba GHCR packages backend/frontend/PostgreSQL đã được publish.

### Còn chờ hạ tầng ngoài

- Chưa bật branch protection bắt buộc quality checks.
- Chưa có self-hosted staging/production runner và GitHub Environment approval.
- Deploy Release #1 đang queued vì chưa có runner label `staging`.

Vì vậy Task 6.3 giữ trạng thái chưa hoàn thành. Source và local gates đã pass;
chỉ chuyển sang completed sau khi chạy được các external gates nêu trong
`docs/workflow/phase-6-production-prep/6.3-cicd-pipeline.md`.
