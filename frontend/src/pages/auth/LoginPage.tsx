import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import logo from '../../assets/logo.png';
import loginImage from '../../assets/login.png';

import { Footer } from '../../components/layout/Footer';
import { Seo } from '../../components/public/Seo';
import { useAuth } from '../../stores/auth-context';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

function portalPath(roles: string[]) {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('teacher')) return '/teacher';
  if (roles.includes('student')) return '/student';
  if (roles.includes('guardian')) return '/parent';
  return '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, isInitializing, login, roles } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      const loggedInUser = await login(identifier, password);
      navigate(redirectTo ?? portalPath(loggedInUser.roles), { replace: true });
    } catch {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={portalPath(roles)} replace />;
  }

  return (
    <>
      <Seo
        title="Đăng nhập"
        description="Đăng nhập cổng thông tin nội bộ Trường THPT Phan Chu Trinh - Phan Thiết."
        canonicalPath="/dang-nhap"
        noIndex
      />
      <main className="grid min-h-screen min-w-0 grid-cols-[minmax(0,1fr)] overflow-x-hidden bg-white lg:grid-cols-[1.45fr_0.8fr]">
        {/* IMAGE SIDE */}
        <section className="relative hidden overflow-hidden lg:block">
          <img
            src={loginImage}
            alt="THPT Phan Chu Trinh"
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/20 via-transparent to-white/10" />

          <Link
            to="/"
            className="absolute left-8 top-8 flex min-w-0 items-center gap-4 rounded-2xl border border-white/40 bg-white/88 px-5 py-4 shadow-2xl backdrop-blur-md"
          >
            <img
              src={logo}
              alt="THPT Phan Chu Trinh"
              className="h-14 w-14 shrink-0 object-contain"
            />

            <div className="min-w-0 leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">
                SỞ GIÁO DỤC VÀ ĐÀO TẠO TỈNH LÂM ĐỒNG
              </p>

              <h1 className="text-sm font-bold uppercase tracking-wide text-blue-800 md:text-lg">
                TRƯỜNG THPT PHAN CHU TRINH - PHAN THIẾT
              </h1>
            </div>
          </Link>
        </section>

        {/* FORM SIDE */}
        <section className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-white px-4 py-10 sm:px-6">
          <div className="w-full min-w-0 max-w-md">
            {/* LOGO */}
            <div className="mb-9 text-center">
              <img
                src={logo}
                alt="THPT Phan Chu Trinh"
                className="mx-auto h-20 w-20 object-contain"
              />

              <h1 className="mt-5 max-w-full break-words text-lg font-bold uppercase tracking-wide text-blue-950 sm:text-xl">
                Trường THPT Phan Chu Trinh
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Phan Thiết
              </p>
            </div>

            {/* TITLE */}
            <div className="mb-8 border-l-4 border-blue-800 pl-5">
              <p className="text-sm font-bold uppercase tracking-[0.26em] text-blue-700">
                Cổng thông tin điện tử
              </p>

              <h2 className="mt-3 text-4xl font-extrabold uppercase tracking-wide text-blue-900 sm:text-5xl">
                Đăng nhập
              </h2>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="grid min-w-0 gap-6">
              {/* EMAIL */}
              <label className="group relative block">
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="peer box-border h-[64px] w-full max-w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-800 focus:ring-0"
                  required
                />

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 bg-white px-2 text-base font-medium text-slate-500 transition-all duration-200 peer-focus:top-0 peer-focus:text-sm peer-focus:text-blue-800 peer-valid:top-0 peer-valid:text-sm peer-valid:text-blue-800">
                  Email hoặc tài khoản học sinh
                </span>
              </label>

              {/* PASSWORD */}
              <label className="group relative block">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="peer box-border h-[64px] w-full max-w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-800 focus:ring-0"
                  required
                />

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 bg-white px-2 text-base font-medium text-slate-500 transition-all duration-200 peer-focus:top-0 peer-focus:text-sm peer-focus:text-blue-800 peer-valid:top-0 peer-valid:text-sm peer-valid:text-blue-800">
                  Mật khẩu
                </span>
              </label>

              {/* ERROR */}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* BUTTON */}
              <button
                type="submit"
                disabled={isSubmitting || isInitializing}
                className="mt-2 h-[58px] w-full max-w-full rounded-lg bg-blue-900 text-base font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            {import.meta.env.DEV && (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-900">Tài khoản dev</p>
                <p className="mt-1 text-xs text-slate-500">Chỉ hiển thị trong môi trường phát triển.</p>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('admin@pct.local');
                    setPassword('admin123');
                  }}
                  className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  Điền tài khoản dev
                </button>
              </div>
            )}

            {/* BACK */}
            <div className="mt-7">
              <Link
                to="/"
                className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
              >
                ← Quay lại website
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
