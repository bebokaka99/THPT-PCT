import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '../../assets/herosection.jpg';

export function HeroSection() {
  return (
    <section className="relative isolate min-h-[520px] overflow-hidden bg-blue-950 text-white md:min-h-[600px]">
      <img
        src={heroImage}
        alt="Trường THPT Phan Chu Trinh - Phan Thiết"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-slate-950/60" />
      <div className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-blue-950/95 via-blue-950/75 to-transparent lg:w-4/5" />

      <div className="mx-auto flex min-h-[520px] w-full max-w-7xl items-center px-4 py-16 md:min-h-[600px] md:py-24">
        <div className="min-w-0 w-[calc(100vw-4rem)] max-w-3xl sm:w-auto">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-100 sm:text-sm">
            <span className="h-px w-8 bg-cyan-300" />
            Cổng thông tin điện tử
          </p>
          <h1 className="mt-6 max-w-full break-words text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            THPT Phan Chu Trinh
            <span className="mt-2 block text-blue-100">Phan Thiết</span>
          </h1>
          <p className="mt-6 max-w-full break-words text-base leading-8 text-slate-100 [overflow-wrap:anywhere] sm:max-w-2xl md:text-lg">
            Kết nối nhà trường, học sinh và phụ huynh qua nguồn tin chính thống,
            tài liệu học tập và các hoạt động giáo dục được cập nhật thường xuyên.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/tin-tuc"
              className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 sm:w-auto"
            >
              Xem tin tức
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tai-lieu"
              className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-md border border-white/50 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              Tra cứu tài liệu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
