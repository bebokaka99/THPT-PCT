# Security exceptions

Security exception không được dùng để bỏ qua toàn bộ `npm audit`. Mỗi exception
phải khóa đúng advisory, package, version, lý do và ngày hết hạn. CI phải fail
nếu version thay đổi, exception hết hạn hoặc xuất hiện finding khác.

## SEC-2026-001 - React Router RSC CSRF

- Advisory: `GHSA-qwww-vcr4-c8h2`
- Package: `react-router@7.18.2`
- Severity: HIGH
- Hết hạn: 2026-08-31
- Phạm vi ảnh hưởng upstream: React Router RSC mode/server action processing.
- Phạm vi project: frontend là client-side Vite SPA, không bật RSC mode, không
  có React Router server actions.
- Quyết định: tạm giữ latest public version 7.18.2. Không downgrade 7.11.0 vì
  phiên bản đó có nhiều advisory XSS/RCE đã biết.
- Gate: `tools/check-npm-audit.mjs` chỉ cho phép đúng advisory và version này.
- Hành động: nâng React Router ngay khi upstream phát hành bản vá; xóa exception
  trong cùng pull request.
