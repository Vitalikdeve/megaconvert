import React, { useEffect } from 'react';
import { CONVERSIONS, getConversionBySlug, getRelatedConversions } from './seo/conversions';

const upsertMeta = (name, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertProperty = (property, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertJsonLd = (data) => {
  const id = 'seo-jsonld';
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data);
};

export default function SeoPage({ slug, onSelectTool, onNavigate, isToolAvailable }) {
  const conversion = getConversionBySlug(slug);
  const related = conversion ? getRelatedConversions(conversion.category, conversion.slug, 8) : [];
  const toolAvailable = conversion ? (isToolAvailable ? isToolAvailable(conversion.id) : true) : false;

  useEffect(() => {
    if (!conversion) {
      document.title = 'Convert files online | MegaConvert';
      upsertMeta('description', 'Convert files online with MegaConvert. Fast, secure, and free.');
      return;
    }
    const title = `${conversion.from} to ${conversion.to} Converter | MegaConvert`;
    const desc = `Convert ${conversion.from} to ${conversion.to} online in seconds. Fast, secure, and high-quality conversions.`;
    document.title = title;
    upsertMeta('description', desc);
    upsertProperty('og:title', title);
    upsertProperty('og:description', desc);
    upsertProperty('og:type', 'website');
    upsertJsonLd({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": `${conversion.from} to ${conversion.to} Converter`,
      "applicationCategory": "UtilityApplication",
      "operatingSystem": "Web",
      "description": desc
    });
  }, [conversion]);

  if (!conversion) {
    return (
      <div className="pt-32 pb-20 px-4 max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Conversion not found</h1>
        <p className="text-slate-600 mb-6">Try one of our popular conversions:</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONVERSIONS.slice(0, 12).map((c) => (
            <button
              key={c.slug}
              onClick={() => onNavigate(`/convert/${c.slug}`)}
              className="bg-white border rounded-2xl p-4 text-left hover:shadow-md transition"
            >
              <div className="font-semibold">{c.from} → {c.to}</div>
              <div className="text-xs text-slate-500 mt-1">Open converter</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-widest text-slate-500">MegaConvert</p>
          <h1 className="text-5xl font-extrabold mt-2">{conversion.from} to {conversion.to} Converter</h1>
          <p className="text-slate-600 text-lg mt-4">
            Convert {conversion.from} files to {conversion.to} in seconds. High quality, fast processing, and secure uploads.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => {
                if (toolAvailable) {
                  onSelectTool(conversion.id);
                  onNavigate('/');
                  return;
                }
                onNavigate('/tools');
              }}
              className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold"
            >
              {toolAvailable ? 'Convert Now' : 'Browse Available Converters'}
            </button>
            <button
              onClick={() => onNavigate('/')}
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              Back to Home
            </button>
          </div>
          {!toolAvailable && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              This conversion page is live for discovery and SEO. Runtime processing for this exact format is being expanded.
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">How it works</div>
            <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
              <li>Upload your {conversion.from} file.</li>
              <li>Pick settings (optional).</li>
              <li>Download your {conversion.to} file.</li>
            </ol>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">Why MegaConvert</div>
            <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
              <li>Fast conversions at scale</li>
              <li>Secure processing</li>
              <li>Batch conversion supported</li>
            </ul>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="font-semibold mb-2">Supported formats</div>
            <div className="text-sm text-slate-600">
              {conversion.from} → {conversion.to}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border rounded-2xl p-6 mb-12">
          <h2 className="text-2xl font-bold mb-3">FAQ</h2>
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <div className="font-semibold">Is it free?</div>
              <div>Yes. Free conversions with optional PRO features.</div>
            </div>
            <div>
              <div className="font-semibold">How fast is it?</div>
              <div>Most files finish in seconds. Large files can take longer.</div>
            </div>
            <div>
              <div className="font-semibold">Are my files safe?</div>
              <div>We process files securely and don’t expose them publicly.</div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Related conversions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => onNavigate(`/convert/${c.slug}`)}
                  className="bg-white border rounded-2xl p-4 text-left hover:shadow-md transition"
                >
                  <div className="font-semibold">{c.from} → {c.to}</div>
                  <div className="text-xs text-slate-500 mt-1">Open converter</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
