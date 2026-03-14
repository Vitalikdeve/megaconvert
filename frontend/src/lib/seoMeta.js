const ensureHeadElement = (selector, tagName, attributes = {}) => {
  if (typeof document === 'undefined') {
    return null;
  }

  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }
  return element;
};

const upsertMeta = (attribute, key, content) => {
  if (!content || typeof document === 'undefined') {
    return;
  }

  const element = ensureHeadElement(`meta[${attribute}="${key}"]`, 'meta', {
    [attribute]: key,
  });

  element?.setAttribute('content', String(content));
};

const upsertLink = (rel, href) => {
  if (!href || typeof document === 'undefined') {
    return;
  }

  const element = ensureHeadElement(`link[rel="${rel}"]`, 'link', { rel });
  element?.setAttribute('href', String(href));
};

const upsertJsonLd = (id, value) => {
  if (typeof document === 'undefined') {
    return;
  }

  const script = ensureHeadElement(`#${id}`, 'script', {
    id,
    type: 'application/ld+json',
  });

  if (script) {
    script.textContent = JSON.stringify(value);
  }
};

export const buildCanonicalUrl = (pathname) => {
  if (typeof window === 'undefined') {
    return String(pathname || '');
  }

  return new URL(String(pathname || '/'), window.location.origin).toString();
};

export const applySeoMeta = ({
  title,
  description,
  pathname,
  type = 'website',
  jsonLd,
}) => {
  if (typeof document === 'undefined') {
    return;
  }

  const canonicalUrl = buildCanonicalUrl(pathname);

  if (title) {
    document.title = String(title);
  }

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', 'index,follow,max-image-preview:large');
  upsertMeta('property', 'og:site_name', 'MegaConvert');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('name', 'twitter:card', type === 'article' ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertLink('canonical', canonicalUrl);

  if (jsonLd) {
    upsertJsonLd('blog-seo-jsonld', jsonLd);
  }
};
