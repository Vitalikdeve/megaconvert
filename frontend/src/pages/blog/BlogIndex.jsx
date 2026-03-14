import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Cpu,
  FileImage,
  Film,
  Newspaper,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import GlassPanel from '../../components/ui/GlassPanel.jsx';
import { BLOG_POSTS } from '../../data/blogPosts.js';
import { applySeoMeta } from '../../lib/seoMeta.js';

const MotionSection = motion.section;

const iconByCategory = {
  Guides: FileImage,
  Video: Film,
  Architecture: Cpu,
};

const formatPublishedDate = (value) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(value));

export default function BlogIndex() {
  const { t } = useTranslation();

  useEffect(() => {
    applySeoMeta({
      title: 'MegaConvert Blog | Premium Guides for File Workflows',
      description: 'Technical guides on file conversion, media compression, HEIC, MP4 workflows, and the hybrid WASM + edge architecture behind modern file tools.',
      pathname: '/blog',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'MegaConvert Blog',
        description: 'Technical guides for conversion, compression, and hybrid file infrastructure.',
        url: 'https://megaconvert-web.vercel.app/blog',
      },
    });
  }, []);

  return (
    <div className="relative overflow-hidden bg-[#030303]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at 85% 18%, rgba(129,140,248,0.14), transparent 24%), linear-gradient(180deg, rgba(4,7,13,0.96), rgba(3,3,3,1))',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-14 sm:pt-20 lg:pt-24">
        <MotionSection
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,14,22,0.94),rgba(6,9,16,0.92))] p-7 shadow-[0_30px_120px_-54px_rgba(59,130,246,0.36)] sm:p-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-cyan-200/80">
                <Newspaper className="h-4 w-4" strokeWidth={1.8} />
                {t('blog.indexEyebrow', 'Editorial Engine')}
              </div>
              <h1 className="mt-6 max-w-4xl bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(191,219,254,0.72))] bg-clip-text text-4xl font-semibold tracking-[-0.04em] text-transparent sm:text-5xl lg:text-6xl">
                {t('blog.indexTitle', 'Search-first technical content for modern file workflows.')}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                {t('blog.indexSubtitle', 'Deep guides on HEIC, MP4 delivery, privacy-first conversion, and the hybrid WASM + edge systems that make file products feel instant.')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[380px]">
              {[
                { label: t('blog.indexStatArticles', 'Featured essays'), value: String(BLOG_POSTS.length) },
                { label: t('blog.indexStatTopics', 'Core tracks'), value: 'HEIC / MP4 / WASM' },
                { label: t('blog.indexStatCadence', 'Publishing mode'), value: 'Evergreen SEO' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-4 py-4"
                >
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/34">
                    {item.label}
                  </div>
                  <div className="mt-3 text-sm font-medium text-white/88">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MotionSection>

        <section className="grid auto-rows-[minmax(280px,1fr)] grid-cols-1 gap-4 md:grid-cols-12">
          {BLOG_POSTS.map((post, index) => {
            const Icon = iconByCategory[post.category] || Newspaper;
            const isFeatured = index === 0;

            return (
              <GlassPanel
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.08 + (index * 0.06), ease: [0.22, 1, 0.36, 1] }}
                whileHover={{
                  y: -6,
                  scale: 1.01,
                  boxShadow: '0 36px 120px -56px rgba(96,165,250,0.46)',
                }}
                className={['group relative overflow-hidden', post.cardSpanClass].join(' ')}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="flex h-full flex-col justify-between gap-8 px-6 py-6 sm:px-7"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-100 transition-transform duration-500 group-hover:scale-[1.02]"
                    style={{ background: post.cover.background }}
                  />
                  <div
                    aria-hidden="true"
                    className={['pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', post.cover.accent].join(' ')}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/58">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {post.cover.eyebrow}
                    </div>

                    <div className="rounded-full border border-white/[0.1] bg-white/[0.05] p-2 text-white/72 transition-transform duration-300 group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                    </div>
                  </div>

                  <div className="relative flex flex-1 flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/68"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div>
                        <h2 className={isFeatured ? 'max-w-xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-[2.3rem]' : 'max-w-md text-2xl font-semibold tracking-[-0.03em] text-white'}>
                          {post.title}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-white/58 sm:text-[0.98rem]">
                          {post.excerpt}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-[28px] border border-white/[0.08] bg-black/22 px-5 py-5 backdrop-blur-md">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-white/34">
                          {t('blog.indexSignal', 'Editorial note')}
                        </div>
                        <div className="mt-3 text-sm leading-7 text-white/74">
                          {post.cover.metric}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-white/48">
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
                  </div>
                </Link>
              </GlassPanel>
            );
          })}
        </section>
      </div>
    </div>
  );
}
