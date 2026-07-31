import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'u',
  'ul',
];

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'rel', 'target', 'title'],
  img: ['alt', 'height', 'src', 'title', 'width'],
};

function isAllowedImageSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return value.startsWith('/uploads/');
  }
}

export function sanitizeRichHtml(value: string | null | undefined) {
  const sanitized = sanitizeHtml(value ?? '', {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  });

  return sanitized.replace(/<img\b[^>]*>/gi, (imageTag) => {
    const source = imageTag.match(/\ssrc=(["'])(.*?)\1/i)?.[2] ?? '';
    return source && isAllowedImageSource(source) ? imageTag : '';
  });
}
