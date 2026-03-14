import React, { useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Cpu,
  Globe2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import GlassPanel from '../../components/ui/GlassPanel.jsx';
import { BLOG_POSTS, getBlogPostBySlug, getRelatedBlogPosts } from '../../data/blogPosts.js';
import { applySeoMeta } from '../../lib/seoMeta.js';

const AUTO_COMPONENT_ID = 'mega-widget';
const TOKEN_PATTERN = /\[\[([\w-]+)\]\]/g;
const MotionSection = motion.section;

const formatPublishedDate = (value) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(value));

const isParagraphBlock = (block) => {
  const trimmed = String(block || '').trim();
  if (!trimmed) {
    return false;
  }

  return !/^(#{1,6}\s|[-*+]\s|>\s|```|~~~|\d+\.\s|\|)/.test(trimmed);
};

const injectAutoComponentToken = (markdown, tokenId) => {
  const blocks = String(markdown || '')
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  let paragraphCount = 0;
  let inserted = false;
  const nextBlocks = [];

  blocks.forEach((block) => {
    nextBlocks.push(block);

    if (inserted || !isParagraphBlock(block)) {
      return;
    }

    paragraphCount += 1;
    if (paragraphCount === 2) {
      nextBlocks.push(`[[${tokenId}]]`);
      inserted = true;
    }
  });

  return nextBlocks.join('\n\n');
};

const splitMarkdownTokens = (markdown) => {
  const parts = [];
  let lastIndex = 0;

  markdown.replace(TOKEN_PATTERN, (match, tokenId, offset) => {
    const content = markdown.slice(lastIndex, offset).trim();
    if (content) {
      parts.push({ type: 'markdown', value: content });
    }

    parts.push({ type: 'component', value: tokenId });
    lastIndex = offset + match.length;
    return match;
  });

  const trailingContent = markdown.slice(lastIndex).trim();
  if (trailingContent) {
    parts.push({ type: 'markdown', value: trailingContent });
  }

  return parts;
};

function InlineConverterWidget({ post, t }) {
  const quickFormats = post.slug === 'heic-to-jpg-guide'
    ? ['HEIC -> JPG', 'Portrait-safe export', 'Metadata-aware']
    : post.slug === 'compress-mp4-messaging'
      ? ['MP4 -> smaller MP4', 'Chat delivery copy', 'Faststart ready']
      : ['Local WASM', 'Edge routing', 'Cloud burst'];

  return (
    <GlassPanel
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="my-10 overflow-hidden border-cyan-300/12 bg-[linear-gradient(180deg,rgba(10,15,26,0.96),rgba(7,10,18,0.94))]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_85%_80%,rgba(99,102,241,0.18),transparent_26%)]"
      />
      <div className="relative px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/14 bg-cyan-300/8 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-100/82">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              {t('blog.inlineWidgetEyebrow', 'Try the workflow')}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
              {t('blog.inlineWidgetTitle', 'Try MegaConvert now')}
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/66">
              {t('blog.inlineWidgetBody', 'Run the same local-first, cloud-assisted flow discussed in this article. Start in the browser, hand off only when the job actually needs it.')}
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform duration-300 hover:scale-[1.02]"
          >
            {t('blog.inlineWidgetCta', 'Try MegaConvert now')}
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {quickFormats.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function EdgeArchitectureCard({ t }) {
  const pillars = [
    {
      icon: Cpu,
      title: t('blog.archCardBrowser', 'Browser / WASM'),
      body: t('blog.archCardBrowserBody', 'Instant local transforms for the work that should never leave the device.'),
    },
    {
      icon: Globe2,
      title: t('blog.archCardEdge', 'Edge control plane'),
      body: t('blog.archCardEdgeBody', 'Regional auth, routing, entitlement checks, and job decisions close to the user.'),
    },
    {
      icon: Lock,
      title: t('blog.archCardCloud', 'Cloud burst path'),
      body: t('blog.archCardCloudBody', 'Heavy or unsupported jobs go to workers only when local execution stops being the smart option.'),
    },
  ];

  return (
    <div className="my-10 grid gap-4 md:grid-cols-3">
      {pillars.map((pillar) => {
        const Icon = pillar.icon;
        return (
          <div
            key={pillar.title}
            className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] px-5 py-5"
          >
            <div className="inline-flex rounded-full border border-white/[0.08] bg-black/20 p-2 text-white/78">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{pillar.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/60">{pillar.body}</p>
          </div>
        );
      })}
    </div>
  );
}

const markdownComponents = {
  h2: ({ children }) => <h2 className="mt-12 text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-8 text-white/94">{children}</h3>,
  p: ({ children }) => <p className="text-white/74">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target={String(href || '').startsWith('http') ? '_blank' : undefined}
      rel={String(href || '').startsWith('http') ? 'noreferrer' : undefined}
      className="font-medium text-cyan-200 transition-colors hover:text-cyan-100"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  ul: ({ children }) => <ul className="space-y-3 text-white/72">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-3 text-white/72">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-cyan-300/40 pl-5 text-white/70">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) => (
    inline ? (
      <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.9em] text-cyan-100">{children}</code>
    ) : (
      <code className="block overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-sm text-cyan-100">
        {children}
      </code>
    )
  ),
};

export default function BlogPost() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const post = getBlogPostBySlug(slug);

  const relatedPosts = useMemo(
    () => getRelatedBlogPosts(slug, 2),
    [slug],
  );

  const renderedContent = useMemo(() => {
    if (!post) {
      return [];
    }

    return splitMarkdownTokens(injectAutoComponentToken(post.markdown, AUTO_COMPONENT_ID));
  }, [post]);

  useEffect(() => {
    if (!post) {
      applySeoMeta({
        title: 'Blog article not found | MegaConvert',
        description: 'The requested MegaConvert blog article could not be found.',
        pathname: `/blog/${slug || ''}`,
      });
      return;
    }

    applySeoMeta({
      title: `${post.title} | MegaConvert Blog`,
      description: post.description,
      pathname: `/blog/${post.slug}`,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        author: {
          '@type': 'Organization',
          name: 'MegaConvert',
        },
        publisher: {
          '@type': 'Organization',
          name: 'MegaConvert',
        },
        mainEntityOfPage: `https://megaconvert-web.vercel.app/blog/${post.slug}`,
      },
    });
  }, [post, slug]);

  if (!post) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-6 py-24">
        <GlassPanel className="w-full px-8 py-10 text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
            {t('blog.postMissingEyebrow', 'Editorial')}
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            {t('blog.postMissingTitle', 'This article is not available.')}
          </h1>
          <p className="mt-4 text-white/58">
            {t('blog.postMissingBody', 'It may have moved or the link may be incomplete.')}
          </p>
          <Link
            to="/blog"
            className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
            {t('blog.backToIndex', 'Back to blog')}
          </Link>
        </GlassPanel>
      </div>
    );
  }

  const componentRegistry = {
    [AUTO_COMPONENT_ID]: <InlineConverterWidget post={post} t={t} />,
    'edge-architecture-card': <EdgeArchitectureCard t={t} />,
  };

  return (
    <div className="relative overflow-hidden bg-[#030303]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: post.cover.background,
          opacity: 0.55,
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-12 sm:pt-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/58 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
          {t('blog.backToIndex', 'Back to blog')}
        </Link>

        <MotionSection
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,13,22,0.96),rgba(4,7,13,0.94))] px-7 py-8 shadow-[0_34px_120px_-60px_rgba(56,189,248,0.34)] sm:px-10 sm:py-10"
        >
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/52">
              {post.category}
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
              {post.excerpt}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/48">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
                {formatPublishedDate(post.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" strokeWidth={1.8} />
                {post.readTime}
              </span>
            </div>
          </div>
        </MotionSection>

        <article className="prose prose-invert mx-auto max-w-2xl prose-headings:font-semibold prose-headings:tracking-[-0.03em] prose-p:text-white/74 prose-li:text-white/72 prose-strong:text-white prose-code:text-cyan-100 prose-a:no-underline">
          {renderedContent.map((part, index) => (
            part.type === 'component' ? (
              <React.Fragment key={`${part.value}-${index}`}>
                {componentRegistry[part.value] || null}
              </React.Fragment>
            ) : (
                <ReactMarkdown
                  key={`markdown-${index}`}
                  components={markdownComponents}
                >
                  {part.value}
                </ReactMarkdown>
              )
          ))}
        </article>

        {relatedPosts.length > 0 ? (
          <section className="mx-auto mt-4 w-full max-w-5xl">
            <div className="mb-5 text-[11px] uppercase tracking-[0.32em] text-white/34">
              {t('blog.relatedEyebrow', 'Continue reading')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <GlassPanel
                  key={relatedPost.slug}
                  whileHover={{
                    y: -4,
                    scale: 1.01,
                    boxShadow: '0 24px 90px -48px rgba(56,189,248,0.4)',
                  }}
                  className="overflow-hidden"
                >
                  <Link
                    to={`/blog/${relatedPost.slug}`}
                    className="flex h-full flex-col gap-5 px-6 py-6"
                  >
                    <div className="flex flex-wrap gap-2">
                      {relatedPost.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                        {relatedPost.title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-white/58">
                        {relatedPost.excerpt}
                      </p>
                    </div>

                    <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
                      {t('blog.readArticle', 'Read article')}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                    </div>
                  </Link>
                </GlassPanel>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mx-auto hidden max-w-2xl text-center text-sm text-white/36 sm:block">
          {t('blog.editorialFooter', `More deep-dive articles are on the way. Current issue: ${BLOG_POSTS.length} evergreen editorial pieces.`)}
        </div>
      </div>
    </div>
  );
}
