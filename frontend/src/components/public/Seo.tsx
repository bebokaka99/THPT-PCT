import { useEffect } from 'react';
import logo from '../../assets/logo.png';

const siteName = 'THPT Phan Chu Trinh - Phan Thiết';
const defaultDescription =
  'Cổng thông tin Trường THPT Phan Chu Trinh - Phan Thiết: tin tức, thông báo, tuyển sinh và tài liệu nhà trường.';

type SeoProps = {
  title?: string;
  description?: string | null;
  canonicalPath?: string;
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
  publishedTime?: string | null;
};

function cleanDescription(value?: string | null) {
  const text = (value || defaultDescription)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function removeMeta(attribute: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function getAbsoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function Seo({
  canonicalPath,
  description,
  image,
  noIndex = false,
  publishedTime,
  title,
  type = 'website',
}: SeoProps) {
  useEffect(() => {
    const configuredSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
    const siteUrl = configuredSiteUrl || window.location.origin;
    const canonicalUrl = getAbsoluteUrl(
      canonicalPath || window.location.pathname,
      siteUrl,
    );
    const metaDescription = cleanDescription(description);
    const fullTitle = title ? `${title} | ${siteName}` : siteName;
    const imageUrl = getAbsoluteUrl(image || logo, window.location.origin);

    document.documentElement.lang = 'vi';
    document.title = fullTitle;

    setMeta('name', 'description', metaDescription);
    setMeta(
      'name',
      'robots',
      noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    );
    setMeta('property', 'og:locale', 'vi_VN');
    setMeta('property', 'og:site_name', siteName);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', metaDescription);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', imageUrl);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', metaDescription);
    setMeta('name', 'twitter:image', imageUrl);

    if (type === 'article' && publishedTime) {
      setMeta('property', 'article:published_time', publishedTime);
    } else {
      removeMeta('property', 'article:published_time');
    }

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [
    canonicalPath,
    description,
    image,
    noIndex,
    publishedTime,
    title,
    type,
  ]);

  return null;
}
