export const BLOG_ARTICLES = [
  {
    slug: 'pdf-to-word-layout-guide',
    title: 'How to Convert PDF to Word Without Breaking Layout',
    excerpt: 'A practical workflow to keep tables, fonts, spacing, and signatures stable after conversion.',
    date: 'February 12, 2026',
    readTime: '7 min read',
    category: 'Documents',
    toolId: 'pdf-word',
    sections: [
      {
        heading: '1. Start with a clean source file',
        paragraphs: [
          'Layout problems usually come from the source PDF, not the converter. If the PDF has missing fonts, low-resolution scans, or mixed page sizes, DOCX output becomes harder to edit.',
          'Before converting, quickly inspect 3 things: page orientation, embedded fonts, and whether text is selectable or image-only.'
        ],
        bullets: [
          'Use text-based PDFs for best editable output',
          'Keep one document orientation per file when possible',
          'Avoid heavily compressed scans if you need accurate text'
        ]
      },
      {
        heading: '2. Validate headers, tables, and page breaks first',
        paragraphs: [
          'After conversion, do not review line by line. Validate structure blocks first: title, section headers, table widths, and page break points. This catches 90% of formatting issues quickly.',
          'When a table shifts, set fixed column width in Word and disable auto-resize to content.'
        ],
        bullets: [
          'Check first page and one random middle page',
          'Lock table width before editing content',
          'Reapply only missing styles, not full reformatting'
        ]
      },
      {
        heading: '3. Build a reusable correction checklist',
        paragraphs: [
          'Teams lose time because every person checks different things. Create one short checklist and reuse it for invoices, contracts, and reports.',
          'A repeatable QA flow reduces manual editing time and improves consistency across exports.'
        ],
        bullets: [
          'Header/footer alignment',
          'Page numbers and section breaks',
          'Table borders and merged cells',
          'Special characters and currency symbols'
        ]
      }
    ]
  },
  {
    slug: 'scan-quality-for-ocr-results',
    title: 'Scan Quality Rules That Improve OCR Accuracy',
    excerpt: 'Simple preparation steps for cleaner text extraction from scanned pages and photos.',
    date: 'February 10, 2026',
    readTime: '6 min read',
    category: 'OCR',
    toolId: 'pdf-txt',
    sections: [
      {
        heading: '1. Resolution and contrast are non-negotiable',
        paragraphs: [
          'OCR engines perform best when character edges are clear. 300 DPI with strong contrast is the minimum baseline for documents with small fonts.',
          'Blur, shadows, and perspective distortion produce broken words and punctuation noise.'
        ],
        bullets: [
          'Target 300 DPI for documents, 400 DPI for tiny print',
          'Keep pages flat and evenly lit',
          'Avoid aggressive JPG compression before OCR'
        ]
      },
      {
        heading: '2. Language and encoding must match content',
        paragraphs: [
          'Mixed languages in one file are common in forms and visas. Make sure output is handled as UTF-8 so Cyrillic, accented Latin, and symbols remain readable.',
          'If your output looks like gibberish, this is usually an encoding mismatch after extraction, not a recognition failure.'
        ],
        bullets: [
          'Prefer UTF-8 output for multilingual text',
          'Keep one language block per page where possible',
          'Verify quotes, dashes, and currency symbols'
        ]
      },
      {
        heading: '3. Post-process with structure, not manual rewriting',
        paragraphs: [
          'After OCR, first normalize line breaks and remove duplicated spaces. Then fix names, numbers, and legal references.',
          'A two-pass cleanup process is faster and safer than rewriting text manually from scratch.'
        ],
        bullets: [
          'Normalize spacing and line endings',
          'Search for common OCR confusions (O/0, I/1)',
          'Run quick spell-check in the target language'
        ]
      }
    ]
  },
  {
    slug: 'image-to-pdf-for-visa-packs',
    title: 'Image to PDF for Visa Packages: A Reliable Checklist',
    excerpt: 'How to assemble multi-page PDF packs from phone scans without rejection risks.',
    date: 'February 8, 2026',
    readTime: '8 min read',
    category: 'Images',
    toolId: 'image-pdf',
    sections: [
      {
        heading: '1. Normalize page dimensions before merge',
        paragraphs: [
          'Consulates and offices often reject packs with inconsistent page sizes or rotated pages. Normalize all images to one orientation and paper ratio before converting to PDF.',
          'Do not mix landscape and portrait pages in a single official packet unless specifically requested.'
        ],
        bullets: [
          'Use consistent A4 or Letter ratio',
          'Rotate pages to upright orientation',
          'Keep margins visible for stamps and seals'
        ]
      },
      {
        heading: '2. Preserve readability over aggressive compression',
        paragraphs: [
          'File-size limits matter, but unreadable stamps or signatures are worse than a larger file. Keep text and seals sharp first, then optimize size.',
          'If a page includes fine print, export that page at higher quality.'
        ],
        bullets: [
          'Prioritize readability for signatures and numbers',
          'Compress in steps and verify after each step',
          'Avoid converting text-heavy pages to low-quality JPG twice'
        ]
      },
      {
        heading: '3. Final QA before upload',
        paragraphs: [
          'Open the final PDF on both desktop and mobile to confirm orientation, page order, and legibility. This prevents upload retries and deadline issues.',
          'Maintain a naming standard so support teams can identify each packet quickly.'
        ],
        bullets: [
          'Check page order and total page count',
          'Confirm all pages are searchable or readable',
          'Use clear filenames like passport-pack-v2.pdf'
        ]
      }
    ]
  },
  {
    slug: 'video-compression-without-quality-loss',
    title: 'Video Compression Without Visible Quality Loss',
    excerpt: 'A balanced method for reducing MP4 size while keeping text overlays and motion clean.',
    date: 'February 5, 2026',
    readTime: '7 min read',
    category: 'Video',
    toolId: 'mov-mp4',
    sections: [
      {
        heading: '1. Pick the target first: web, social, or archive',
        paragraphs: [
          'Compression settings depend on destination. A web preview and an archive master should not share the same bitrate target.',
          'Define platform and maximum upload size before conversion to avoid multiple re-encodes.'
        ],
        bullets: [
          'Social uploads: optimize for faster playback',
          'Internal review: medium bitrate with readable overlays',
          'Archive: higher bitrate and original frame rate'
        ]
      },
      {
        heading: '2. Control bitrate and frame rate deliberately',
        paragraphs: [
          'Most quality loss comes from unnecessary frame-rate changes or too low bitrate for motion-heavy scenes.',
          'For screen recordings, text clarity benefits from stable frame rate and moderate bitrate rather than extreme compression.'
        ],
        bullets: [
          'Keep native frame rate when possible',
          'Lower bitrate gradually, then compare output',
          'Review fast-motion segments, not only static shots'
        ]
      },
      {
        heading: '3. Use a two-file strategy',
        paragraphs: [
          'Keep a high-quality master and a distribution version. This saves time when a platform requests a new format later.',
          'Re-encoding from already compressed output compounds artifacts, so always re-export from source or master.'
        ],
        bullets: [
          'Master file for future edits',
          'Delivery file for upload limits',
          'Document conversion settings in project notes'
        ]
      }
    ]
  },
  {
    slug: 'secure-file-sharing-after-conversion',
    title: 'Secure File Sharing After Conversion: Team Playbook',
    excerpt: 'Operational rules for sharing converted files safely across teams and clients.',
    date: 'February 3, 2026',
    readTime: '6 min read',
    category: 'Security',
    toolId: 'pdf-word',
    sections: [
      {
        heading: '1. Share by sensitivity tier, not convenience',
        paragraphs: [
          'Do not treat all converted files equally. Contracts, IDs, and medical forms need stricter access windows and recipients.',
          'Define at least three tiers: public, internal, restricted.'
        ],
        bullets: [
          'Restricted files: shortest link validity',
          'Internal files: team-only channels',
          'Public files: sanitized and approved versions'
        ]
      },
      {
        heading: '2. Minimize file lifetime and duplication',
        paragraphs: [
          'Most leakage events happen through duplicates in chats, email threads, and local downloads. Limit copies and keep one canonical shared location.',
          'Expire download links and remove stale artifacts from collaboration threads.'
        ],
        bullets: [
          'Use temporary links for sensitive exports',
          'Avoid re-uploading the same document in multiple chats',
          'Schedule periodic cleanup of stale attachments'
        ]
      },
      {
        heading: '3. Keep an audit-friendly naming policy',
        paragraphs: [
          'A clear naming convention helps legal and operations teams trace which file version was sent and when.',
          'Include project code, date, and revision in filename metadata.'
        ],
        bullets: [
          'Example: contract-acme-2026-02-03-r2.pdf',
          'Track who approved final output',
          'Store final versions in one controlled folder'
        ]
      }
    ]
  },
  {
    slug: 'api-readiness-for-file-automation',
    title: 'API Readiness Checklist for File Conversion Automation',
    excerpt: 'How to prepare your workflow for future API integration with fewer production surprises.',
    date: 'February 1, 2026',
    readTime: '9 min read',
    category: 'API',
    toolId: 'png-jpg',
    sections: [
      {
        heading: '1. Define contract rules before coding',
        paragraphs: [
          'Teams often start integration before agreeing on accepted formats, max file size, and retry behavior. That creates fragile automation.',
          'Create a short conversion contract document first and align product + operations.'
        ],
        bullets: [
          'Allowed input formats and expected outputs',
          'Timeouts and retry limits',
          'Error classes and user-facing messages'
        ]
      },
      {
        heading: '2. Design idempotent job handling',
        paragraphs: [
          'Automations must survive duplicate callbacks and temporary network failures. Use job IDs and idempotency keys to avoid duplicated output or billing drift.',
          'Always separate upload, process, and delivery states in logs.'
        ],
        bullets: [
          'Unique request IDs for every job',
          'Safe retry strategy without duplicate effects',
          'Clear final states: completed, failed, expired'
        ]
      },
      {
        heading: '3. Add observability from day one',
        paragraphs: [
          'Track queue time, processing time, and failure reasons. Without these metrics, SLA conversations become guesswork.',
          'Start with basic dashboards and alerts, then tune thresholds based on real traffic.'
        ],
        bullets: [
          'Median and p95 processing duration',
          'Top 5 error categories by volume',
          'Storage, worker, and API health in one view'
        ]
      }
    ]
  }
];

export default BLOG_ARTICLES;
