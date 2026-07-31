import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

const quickLinks = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Sự kiện', to: '/su-kien' },
  { label: 'Tài liệu', to: '/tai-lieu' },
  { label: 'Tuyển sinh', to: '/danh-muc/tuyen-sinh' },
];

export function Footer() {
  return (
    <footer id="lien-he" className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.2fr_0.7fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center bg-white p-1">
              <img src={logo} alt="THPT Phan Chu Trinh" className="h-full w-full object-contain" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Cổng thông tin điện tử
              </span>
              <span className="mt-1 block max-w-xs font-extrabold uppercase text-white">
                THPT Phan Chu Trinh - Phan Thiết
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            Kênh thông tin chính thức dành cho học sinh, phụ huynh, giáo viên và cộng đồng nhà trường.
          </p>
          <a
            href="https://www.facebook.com/THPTPhanChuTrinh"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-10 w-10 items-center justify-center border border-slate-700 text-blue-300 transition hover:border-blue-400 hover:text-white"
            aria-label="Facebook của trường"
          >
            <span className="text-lg font-extrabold">f</span>
          </a>
        </div>

        <div>
          <h2 className="font-bold text-white">Liên kết nhanh</h2>
          <nav className="mt-5 grid gap-3 text-sm">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className="w-fit transition hover:text-blue-300">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="font-bold text-white">Thông tin liên hệ</h2>
          <div className="mt-5 grid gap-4 text-sm leading-6">
            <p className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
              163 Tuyên Quang, phường Phú Thủy, thành phố Phan Thiết, tỉnh Bình Thuận
            </p>
            <a href="tel:02523827374" className="flex items-center gap-3 hover:text-blue-300">
              <Phone className="h-4 w-4 text-blue-300" />
              0252 382 7374
            </a>
            <a href="mailto:c3phanchutrinh.binhthuan@moet.edu.vn" className="flex items-start gap-3 break-all hover:text-blue-300">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
              c3phanchutrinh.binhthuan@moet.edu.vn
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 THPT Phan Chu Trinh - Phan Thiết.</p>
          <p>Cổng thông tin phục vụ cộng đồng nhà trường.</p>
        </div>
      </div>
    </footer>
  );
}
