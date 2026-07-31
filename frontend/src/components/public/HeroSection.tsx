import { Link } from 'react-router-dom';
import heroImage from '../../assets/herosection.jpg';

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-blue-950 text-white">
      <img
        src={heroImage}
        alt="THPT Phan Chu Trinh - Phan Thiết"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />

      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-950/95 via-blue-950/82 to-blue-900/55" />
      <div className="absolute inset-0 -z-10 bg-blue-950/25" />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20 md:py-24 lg:py-32">
        <div className="min-w-0 max-w-full overflow-x-hidden sm:max-w-4xl">
          <div className="inline-flex max-w-full min-w-0 items-center gap-2 sm:gap-3">
            <span className="h-px w-7 bg-cyan-300/80 sm:w-10" />
            <p className="min-w-0 max-w-full break-words text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 sm:text-sm sm:tracking-[0.3em] [overflow-wrap:anywhere]">
              Cổng thông tin điện tử
            </p>
            <span className="h-px w-7 bg-cyan-300/80 sm:w-10" />
          </div>

          <h2 className="mt-5 max-w-full text-3xl font-extrabold leading-tight tracking-tight text-white sm:max-w-3xl sm:text-4xl md:text-5xl lg:text-5xl">
            <span className="block sm:inline">THPT Phan Chu Trinh - </span>
            <span>Phan Thiết</span>
          </h2>

          <p className="mt-6 max-w-2xl border-l-4 border-cyan-300/80 pl-4 text-sm leading-7 text-blue-50/95 sm:pl-5 sm:text-base sm:leading-8 md:text-lg">
            <span className="sm:hidden">
              Kết nối nhà trường và học sinh
              <br />
              qua tin tức, thông báo và tài liệu mới.
            </span>
            <span className="hidden sm:inline">
              Kết nối nhà trường, học sinh, phụ huynh và giáo viên qua tin tức,
              thông báo, tài liệu và các hoạt động giáo dục được cập nhật thường
              xuyên.
            </span>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-5">
            <Link
              to="/tin-tuc"
              className="inline-flex justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-xl"
            >
              Xem tin tức →
            </Link>
            <Link
              to="/tai-lieu"
              className="inline-flex justify-center rounded-lg border border-blue-100/60 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              Tài liệu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
