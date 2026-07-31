import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

const quickLinks = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Tài liệu', to: '/tai-lieu' },
  { label: 'Tuyển sinh', to: '/danh-muc/tuyen-sinh' },
];

export function Footer() {
  return (
    <footer id="lien-he" className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        {/* BRAND */}
        <div>
          <Link to="/" className="inline-flex max-w-full items-center gap-3 sm:gap-4">
            <img
              src={logo}
              alt="THPT Phan Chu Trinh"
              className="h-14 w-14 object-contain"
            />

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                Cổng thông tin điện tử
              </p>

              <h2 className="mt-1 break-words text-sm font-bold uppercase text-slate-950 sm:text-base">
                THPT Phan Chu Trinh - Phan Thiết
              </h2>
            </div>
          </Link>

          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
            Cập nhật tin tức, thông báo, tài liệu và thông tin tuyển sinh dành
            cho học sinh, phụ huynh và giáo viên.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <a
              href="https://www.facebook.com/THPTPhanChuTrinh"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white transition hover:bg-blue-800"
              aria-label="Facebook trường"
            >
              f
            </a>
          </div>
        </div>

        {/* CONTACT */}
        <div>
          <p className="text-sm font-bold text-slate-950">
            Liên hệ
          </p>

          <div className="mt-5 space-y-4 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-900">
                Địa chỉ
              </p>

              <p className="mt-1">
                163 Tuyên Quang - Phú Thuy - Phan Thiết, Phan Thiet, Vietnam, 800
              </p>
            </div>

            <div>
              <p className="font-semibold text-slate-900">
                Điện thoại
              </p>

              <a
                href="tel:02523827374"
                className="mt-1 inline-block transition hover:text-blue-700"
              >
                0252.3827374
              </a>
            </div>

            <div>
              <p className="font-semibold text-slate-900">
                Email
              </p>

              <a
                href="mailto:c3phanchutrinh.binhthuan@moet.edu.vn"
                className="mt-1 inline-block break-all transition hover:text-blue-700"
              >
                c3phanchutrinh.binhthuan@moet.edu.vn
              </a>
            </div>
          </div>
        </div>

        {/* MAP */}
        <div>
          <p className="text-sm font-bold text-slate-950">
            Bản đồ
          </p>

          <a
            href="https://www.google.com/maps/place/Tr%C6%B0%E1%BB%9Dng+THPT+Phan+Chu+Trinh/data=!4m2!3m1!1s0x0:0xe3a402c72464cf28?sa=X&ved=1t:2428&ictx=111&cshid=1779383188242037"
            target="_blank"
            rel="noreferrer"
            className="mt-5 block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <iframe
              title="Bản đồ THPT Phan Chu Trinh - Phan Thiết"
              src="https://www.google.com/maps?q=Tr%C6%B0%E1%BB%9Dng%20THPT%20Phan%20Chu%20Trinh%20Phan%20Thi%E1%BA%BFt&output=embed"
              className="h-40 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </a>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 THPT Phan Chu Trinh - Phan Thiết.
          </p>

          <div className="flex flex-wrap gap-4">
            {quickLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="transition hover:text-blue-700"
              >
                {item.label}
              </Link>
            ))}

            <a
              href="https://www.facebook.com/nq20k2"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-700 transition hover:text-blue-800"
            >
              Thiết kế bởi Trần Ngọc Quỳnh
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
