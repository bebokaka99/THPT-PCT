import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Seo } from '../components/public/Seo';
import { useAuth } from '../stores/auth-context';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: string;
  requiredRoles?: string[];
  requiredPermission?: string;
};

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  requiredRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isInitializing, permissions, roles } = useAuth();
  const privateSeo = (
    <Seo
      title="Cổng thông tin nội bộ"
      canonicalPath={location.pathname}
      noIndex
    />
  );

  if (isInitializing) {
    return (
      <>
        {privateSeo}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Đang kiểm tra phiên đăng nhập...
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace state={{ from: location }} />;
  }

  const hasRoleRequirement = Boolean(requiredRole || requiredRoles?.length);
  const hasPermissionRequirement = Boolean(requiredPermission);
  const hasRole = requiredRoles
    ? requiredRoles.some((role) => roles.includes(role))
    : requiredRole
      ? roles.includes(requiredRole)
      : true;
  const hasPermission = requiredPermission
    ? permissions.includes(requiredPermission)
    : true;
  const hasAccess =
    hasRoleRequirement && hasPermissionRequirement
      ? hasRole || hasPermission
      : hasRoleRequirement
        ? hasRole
        : hasPermissionRequirement
          ? hasPermission
          : true;

  if (!hasAccess) {
    return (
      <>
        {privateSeo}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="rounded-lg border border-red-200 bg-white p-6 text-center">
            <h1 className="text-xl font-bold text-slate-950">
              Không có quyền truy cập
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Tài khoản hiện tại không có quyền vào khu vực này.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {privateSeo}
      {children}
    </>
  );
}
