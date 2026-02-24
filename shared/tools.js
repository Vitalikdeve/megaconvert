const TOOL_DEFS = [
  {
    "id": "pdf-word",
    "from": "PDF",
    "to": "Word",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "docx"
  },
  {
    "id": "word-pdf",
    "from": "Word",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "docx",
      "doc"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-jpg",
    "from": "PDF",
    "to": "JPG",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "jpg-pdf",
    "from": "JPG",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "heic",
      "heif",
      "gif",
      "bmp",
      "tif",
      "tiff",
      "avif"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-png",
    "from": "PDF",
    "to": "PNG",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "png"
  },
  {
    "id": "png-pdf",
    "from": "PNG",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "png"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-txt",
    "from": "PDF",
    "to": "TXT",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "txt"
  },
  {
    "id": "txt-pdf",
    "from": "TXT",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "txt"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-html",
    "from": "PDF",
    "to": "HTML",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "html"
  },
  {
    "id": "html-pdf",
    "from": "HTML",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "html",
      "htm"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-epub",
    "from": "PDF",
    "to": "EPUB",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "epub"
  },
  {
    "id": "epub-pdf",
    "from": "EPUB",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "epub"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-mobi",
    "from": "PDF",
    "to": "MOBI",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "mobi"
  },
  {
    "id": "mobi-pdf",
    "from": "MOBI",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "mobi",
      "azw",
      "azw3"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "docx-txt",
    "from": "DOCX",
    "to": "TXT",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "docx"
    ],
    "outputExt": "txt"
  },
  {
    "id": "txt-docx",
    "from": "TXT",
    "to": "DOCX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "txt"
    ],
    "outputExt": "docx"
  },
  {
    "id": "doc-docx",
    "from": "DOC",
    "to": "DOCX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "doc"
    ],
    "outputExt": "docx"
  },
  {
    "id": "docx-doc",
    "from": "DOCX",
    "to": "DOC",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "docx"
    ],
    "outputExt": "doc"
  },
  {
    "id": "doc-pdf",
    "from": "DOC",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "doc"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "rtf-pdf",
    "from": "RTF",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "rtf"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-rtf",
    "from": "PDF",
    "to": "RTF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "rtf"
  },
  {
    "id": "odt-docx",
    "from": "ODT",
    "to": "DOCX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "odt"
    ],
    "outputExt": "docx"
  },
  {
    "id": "docx-odt",
    "from": "DOCX",
    "to": "ODT",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "docx"
    ],
    "outputExt": "odt"
  },
  {
    "id": "odt-pdf",
    "from": "ODT",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "odt"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "ppt-pdf",
    "from": "PPT",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "ppt"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pptx-pdf",
    "from": "PPTX",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pptx"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-pptx",
    "from": "PDF",
    "to": "PPTX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "pptx"
  },
  {
    "id": "pdf-ppt",
    "from": "PDF",
    "to": "PPT",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "ppt"
  },
  {
    "id": "xls-pdf",
    "from": "XLS",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "xls"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "xlsx-pdf",
    "from": "XLSX",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "xlsx"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-xlsx",
    "from": "PDF",
    "to": "XLSX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "xlsx"
  },
  {
    "id": "pdf-xls",
    "from": "PDF",
    "to": "XLS",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "xls"
  },
  {
    "id": "csv-xlsx",
    "from": "CSV",
    "to": "XLSX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "xlsx"
  },
  {
    "id": "xlsx-csv",
    "from": "XLSX",
    "to": "CSV",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "xlsx"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-pdf",
    "from": "CSV",
    "to": "PDF",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-csv",
    "from": "PDF",
    "to": "CSV",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "csv"
  },
  {
    "id": "tsv-csv",
    "from": "TSV",
    "to": "CSV",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "tsv",
      "txt"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-tsv",
    "from": "CSV",
    "to": "TSV",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "tsv"
  },
  {
    "id": "docx-html",
    "from": "DOCX",
    "to": "HTML",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "docx"
    ],
    "outputExt": "html"
  },
  {
    "id": "html-docx",
    "from": "HTML",
    "to": "DOCX",
    "category": "documents",
    "type": "doc",
    "timeoutMs": 240000,
    "inputExts": [
      "html",
      "htm"
    ],
    "outputExt": "docx"
  },
  {
    "id": "jpg-png",
    "from": "JPG",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "jpg",
      "jpeg"
    ],
    "outputExt": "png"
  },
  {
    "id": "png-jpg",
    "from": "PNG",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "jpg-webp",
    "from": "JPG",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "jpg",
      "jpeg"
    ],
    "outputExt": "webp"
  },
  {
    "id": "webp-jpg",
    "from": "WEBP",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "webp"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "png-webp",
    "from": "PNG",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "webp"
  },
  {
    "id": "webp-png",
    "from": "WEBP",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "webp"
    ],
    "outputExt": "png"
  },
  {
    "id": "heic-jpg",
    "from": "HEIC",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "heic",
      "heif"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "heic-png",
    "from": "HEIC",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "heic",
      "heif"
    ],
    "outputExt": "png"
  },
  {
    "id": "avif-jpg",
    "from": "AVIF",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "avif"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "avif-png",
    "from": "AVIF",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "avif"
    ],
    "outputExt": "png"
  },
  {
    "id": "jpg-avif",
    "from": "JPG",
    "to": "AVIF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "jpg",
      "jpeg"
    ],
    "outputExt": "avif"
  },
  {
    "id": "png-avif",
    "from": "PNG",
    "to": "AVIF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "avif"
  },
  {
    "id": "tiff-jpg",
    "from": "TIFF",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "tiff",
      "tif"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "tiff-png",
    "from": "TIFF",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "tiff",
      "tif"
    ],
    "outputExt": "png"
  },
  {
    "id": "bmp-jpg",
    "from": "BMP",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "bmp"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "bmp-png",
    "from": "BMP",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "bmp"
    ],
    "outputExt": "png"
  },
  {
    "id": "gif-jpg",
    "from": "GIF",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "gif"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "gif-png",
    "from": "GIF",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "gif"
    ],
    "outputExt": "png"
  },
  {
    "id": "svg-png",
    "from": "SVG",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "svg"
    ],
    "outputExt": "png"
  },
  {
    "id": "svg-jpg",
    "from": "SVG",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "svg"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "png-svg",
    "from": "PNG",
    "to": "SVG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "svg"
  },
  {
    "id": "ico-png",
    "from": "ICO",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "ico"
    ],
    "outputExt": "png"
  },
  {
    "id": "png-ico",
    "from": "PNG",
    "to": "ICO",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "ico"
  },
  {
    "id": "psd-jpg",
    "from": "PSD",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "psd"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "psd-png",
    "from": "PSD",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "psd"
    ],
    "outputExt": "png"
  },
  {
    "id": "raw-jpg",
    "from": "RAW",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "raw",
      "cr2",
      "nef",
      "orf",
      "dng",
      "arw"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "raw-png",
    "from": "RAW",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "raw",
      "cr2",
      "nef",
      "orf",
      "dng",
      "arw"
    ],
    "outputExt": "png"
  },
  {
    "id": "cr2-jpg",
    "from": "CR2",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "cr2"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "nef-jpg",
    "from": "NEF",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "nef"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "orf-jpg",
    "from": "ORF",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "orf"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "dng-jpg",
    "from": "DNG",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "dng"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "jpg-tiff",
    "from": "JPG",
    "to": "TIFF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "jpg",
      "jpeg"
    ],
    "outputExt": "tiff"
  },
  {
    "id": "png-tiff",
    "from": "PNG",
    "to": "TIFF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "tiff"
  },
  {
    "id": "tiff-webp",
    "from": "TIFF",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "tiff",
      "tif"
    ],
    "outputExt": "webp"
  },
  {
    "id": "gif-webp",
    "from": "GIF",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "gif"
    ],
    "outputExt": "webp"
  },
  {
    "id": "webp-gif",
    "from": "WEBP",
    "to": "GIF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "webp"
    ],
    "outputExt": "gif"
  },
  {
    "id": "jpg-gif",
    "from": "JPG",
    "to": "GIF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "jpg",
      "jpeg"
    ],
    "outputExt": "gif"
  },
  {
    "id": "png-gif",
    "from": "PNG",
    "to": "GIF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "gif"
  },
  {
    "id": "svg-webp",
    "from": "SVG",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "svg"
    ],
    "outputExt": "webp"
  },
  {
    "id": "webp-svg",
    "from": "WEBP",
    "to": "SVG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "webp"
    ],
    "outputExt": "svg"
  },
  {
    "id": "heic-webp",
    "from": "HEIC",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "heic",
      "heif"
    ],
    "outputExt": "webp"
  },
  {
    "id": "avif-webp",
    "from": "AVIF",
    "to": "WEBP",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "avif"
    ],
    "outputExt": "webp"
  },
  {
    "id": "eps-jpg",
    "from": "EPS",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "eps"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "eps-png",
    "from": "EPS",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "eps"
    ],
    "outputExt": "png"
  },
  {
    "id": "ai-png",
    "from": "AI",
    "to": "PNG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "ai"
    ],
    "outputExt": "png"
  },
  {
    "id": "ai-jpg",
    "from": "AI",
    "to": "JPG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "ai"
    ],
    "outputExt": "jpg"
  },
  {
    "id": "pdf-svg",
    "from": "PDF",
    "to": "SVG",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "svg"
  },
  {
    "id": "svg-pdf",
    "from": "SVG",
    "to": "PDF",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "svg"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "pdf-png-hires",
    "from": "PDF",
    "to": "PNG (Hi-Res)",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "pdf"
    ],
    "outputExt": "png"
  },
  {
    "id": "png-pdf-multi-page",
    "from": "PNG",
    "to": "PDF (Multi-Page)",
    "category": "images",
    "type": "image",
    "timeoutMs": 120000,
    "inputExts": [
      "png"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "mp4-mp3",
    "from": "MP4",
    "to": "MP3",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp4-wav",
    "from": "MP4",
    "to": "WAV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "wav"
  },
  {
    "id": "mp4-gif",
    "from": "MP4",
    "to": "GIF",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "gif"
  },
  {
    "id": "mp4-webm",
    "from": "MP4",
    "to": "WEBM",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "webm"
  },
  {
    "id": "mp4-avi",
    "from": "MP4",
    "to": "AVI",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "avi"
  },
  {
    "id": "mp4-mov",
    "from": "MP4",
    "to": "MOV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "mov"
  },
  {
    "id": "mp4-mkv",
    "from": "MP4",
    "to": "MKV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "mkv"
  },
  {
    "id": "mov-mp4",
    "from": "MOV",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mov"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "mkv-mp4",
    "from": "MKV",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mkv"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "avi-mp4",
    "from": "AVI",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "avi"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "webm-mp4",
    "from": "WEBM",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "webm"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "flv-mp4",
    "from": "FLV",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "flv"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "wmv-mp4",
    "from": "WMV",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "wmv"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "mpg-mp4",
    "from": "MPG",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mpg",
      "mpeg"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "3gp-mp4",
    "from": "3GP",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "3gp"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "m4v-mp4",
    "from": "M4V",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "m4v"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "mp4-flv",
    "from": "MP4",
    "to": "FLV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "flv"
  },
  {
    "id": "mp4-wmv",
    "from": "MP4",
    "to": "WMV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "wmv"
  },
  {
    "id": "mp4-m4v",
    "from": "MP4",
    "to": "M4V",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "m4v"
  },
  {
    "id": "mov-gif",
    "from": "MOV",
    "to": "GIF",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mov"
    ],
    "outputExt": "gif"
  },
  {
    "id": "mkv-gif",
    "from": "MKV",
    "to": "GIF",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mkv"
    ],
    "outputExt": "gif"
  },
  {
    "id": "avi-gif",
    "from": "AVI",
    "to": "GIF",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "avi"
    ],
    "outputExt": "gif"
  },
  {
    "id": "webm-gif",
    "from": "WEBM",
    "to": "GIF",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "webm"
    ],
    "outputExt": "gif"
  },
  {
    "id": "mp4-jpg-frames",
    "from": "MP4",
    "to": "JPG Frames",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "zip"
  },
  {
    "id": "mp4-png-frames",
    "from": "MP4",
    "to": "PNG Frames",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "zip"
  },
  {
    "id": "gif-mp4",
    "from": "GIF",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "gif"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "gif-webm",
    "from": "GIF",
    "to": "WEBM",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "gif"
    ],
    "outputExt": "webm"
  },
  {
    "id": "ts-mp4",
    "from": "TS",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "ts"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "vob-mp4",
    "from": "VOB",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "vob"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "ogv-mp4",
    "from": "OGV",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "ogv"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "mp4-ogv",
    "from": "MP4",
    "to": "OGV",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "ogv"
  },
  {
    "id": "mp4-hls",
    "from": "MP4",
    "to": "HLS",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "zip"
  },
  {
    "id": "mp4-dash",
    "from": "MP4",
    "to": "DASH",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "zip"
  },
  {
    "id": "mov-webm",
    "from": "MOV",
    "to": "WEBM",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mov"
    ],
    "outputExt": "webm"
  },
  {
    "id": "mkv-webm",
    "from": "MKV",
    "to": "WEBM",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mkv"
    ],
    "outputExt": "webm"
  },
  {
    "id": "avi-webm",
    "from": "AVI",
    "to": "WEBM",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "avi"
    ],
    "outputExt": "webm"
  },
  {
    "id": "webm-avi",
    "from": "WEBM",
    "to": "AVI",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "webm"
    ],
    "outputExt": "avi"
  },
  {
    "id": "mp4-prores",
    "from": "MP4",
    "to": "ProRes",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "mov"
  },
  {
    "id": "prores-mp4",
    "from": "ProRes",
    "to": "MP4",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mov",
      "mxf",
      "prores"
    ],
    "outputExt": "mp4"
  },
  {
    "id": "mp4-vp9",
    "from": "MP4",
    "to": "VP9",
    "category": "video",
    "type": "video",
    "timeoutMs": 300000,
    "inputExts": [
      "mp4"
    ],
    "outputExt": "webm"
  },
  {
    "id": "mp3-wav",
    "from": "MP3",
    "to": "WAV",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "wav"
  },
  {
    "id": "wav-mp3",
    "from": "WAV",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wav"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "flac-mp3",
    "from": "FLAC",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "flac"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-flac",
    "from": "MP3",
    "to": "FLAC",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "flac"
  },
  {
    "id": "aac-mp3",
    "from": "AAC",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "aac"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-aac",
    "from": "MP3",
    "to": "AAC",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "aac"
  },
  {
    "id": "m4a-mp3",
    "from": "M4A",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "m4a"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-m4a",
    "from": "MP3",
    "to": "M4A",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "m4a"
  },
  {
    "id": "ogg-mp3",
    "from": "OGG",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "ogg"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-ogg",
    "from": "MP3",
    "to": "OGG",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "ogg"
  },
  {
    "id": "wma-mp3",
    "from": "WMA",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wma"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-wma",
    "from": "MP3",
    "to": "WMA",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "wma"
  },
  {
    "id": "aiff-mp3",
    "from": "AIFF",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "aiff",
      "aif"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-aiff",
    "from": "MP3",
    "to": "AIFF",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "aiff"
  },
  {
    "id": "amr-mp3",
    "from": "AMR",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "amr"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-amr",
    "from": "MP3",
    "to": "AMR",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "amr"
  },
  {
    "id": "opus-mp3",
    "from": "OPUS",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "opus"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-opus",
    "from": "MP3",
    "to": "OPUS",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "opus"
  },
  {
    "id": "wav-flac",
    "from": "WAV",
    "to": "FLAC",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wav"
    ],
    "outputExt": "flac"
  },
  {
    "id": "flac-wav",
    "from": "FLAC",
    "to": "WAV",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "flac"
    ],
    "outputExt": "wav"
  },
  {
    "id": "aac-wav",
    "from": "AAC",
    "to": "WAV",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "aac"
    ],
    "outputExt": "wav"
  },
  {
    "id": "wav-aac",
    "from": "WAV",
    "to": "AAC",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wav"
    ],
    "outputExt": "aac"
  },
  {
    "id": "ogg-wav",
    "from": "OGG",
    "to": "WAV",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "ogg"
    ],
    "outputExt": "wav"
  },
  {
    "id": "wav-ogg",
    "from": "WAV",
    "to": "OGG",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wav"
    ],
    "outputExt": "ogg"
  },
  {
    "id": "m4a-wav",
    "from": "M4A",
    "to": "WAV",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "m4a"
    ],
    "outputExt": "wav"
  },
  {
    "id": "wav-m4a",
    "from": "WAV",
    "to": "M4A",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "wav"
    ],
    "outputExt": "m4a"
  },
  {
    "id": "mp3-m4r",
    "from": "MP3",
    "to": "Ringtone (M4R)",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "m4r"
  },
  {
    "id": "m4r-mp3",
    "from": "M4R",
    "to": "MP3",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "m4r"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-320kbps",
    "from": "MP3",
    "to": "320kbps",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "mp3-128kbps",
    "from": "MP3",
    "to": "128kbps",
    "category": "audio",
    "type": "audio",
    "timeoutMs": 240000,
    "inputExts": [
      "mp3"
    ],
    "outputExt": "mp3"
  },
  {
    "id": "zip-rar",
    "from": "ZIP",
    "to": "RAR",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "zip"
    ],
    "outputExt": "rar"
  },
  {
    "id": "rar-zip",
    "from": "RAR",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "rar"
    ],
    "outputExt": "zip"
  },
  {
    "id": "7z-zip",
    "from": "7Z",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "7z"
    ],
    "outputExt": "zip"
  },
  {
    "id": "zip-7z",
    "from": "ZIP",
    "to": "7Z",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "zip"
    ],
    "outputExt": "7z"
  },
  {
    "id": "tar-zip",
    "from": "TAR",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "tar"
    ],
    "outputExt": "zip"
  },
  {
    "id": "zip-tar",
    "from": "ZIP",
    "to": "TAR",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "zip"
    ],
    "outputExt": "tar"
  },
  {
    "id": "tar-gz-zip",
    "from": "TAR.GZ",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "tgz",
      "tar.gz",
      "gz"
    ],
    "outputExt": "zip"
  },
  {
    "id": "zip-tar-gz",
    "from": "ZIP",
    "to": "TAR.GZ",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "zip"
    ],
    "outputExt": "tar.gz"
  },
  {
    "id": "gz-zip",
    "from": "GZ",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "gz"
    ],
    "outputExt": "zip"
  },
  {
    "id": "bz2-zip",
    "from": "BZ2",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "bz2"
    ],
    "outputExt": "zip"
  },
  {
    "id": "xz-zip",
    "from": "XZ",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "xz"
    ],
    "outputExt": "zip"
  },
  {
    "id": "iso-zip",
    "from": "ISO",
    "to": "ZIP",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "iso"
    ],
    "outputExt": "zip"
  },
  {
    "id": "zip-iso",
    "from": "ZIP",
    "to": "ISO",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "zip"
    ],
    "outputExt": "iso"
  },
  {
    "id": "rar-7z",
    "from": "RAR",
    "to": "7Z",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "rar"
    ],
    "outputExt": "7z"
  },
  {
    "id": "7z-rar",
    "from": "7Z",
    "to": "RAR",
    "category": "archives",
    "type": "archive",
    "timeoutMs": 300000,
    "inputExts": [
      "7z"
    ],
    "outputExt": "rar"
  },
  {
    "id": "json-csv",
    "from": "JSON",
    "to": "CSV",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-json",
    "from": "CSV",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "json"
  },
  {
    "id": "json-xml",
    "from": "JSON",
    "to": "XML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "xml"
  },
  {
    "id": "xml-json",
    "from": "XML",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "xml"
    ],
    "outputExt": "json"
  },
  {
    "id": "yaml-json",
    "from": "YAML",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "yaml",
      "yml"
    ],
    "outputExt": "json"
  },
  {
    "id": "json-yaml",
    "from": "JSON",
    "to": "YAML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "yaml"
  },
  {
    "id": "xml-csv",
    "from": "XML",
    "to": "CSV",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "xml"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-xml",
    "from": "CSV",
    "to": "XML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "xml"
  },
  {
    "id": "markdown-html",
    "from": "Markdown",
    "to": "HTML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "md",
      "markdown"
    ],
    "outputExt": "html"
  },
  {
    "id": "html-markdown",
    "from": "HTML",
    "to": "Markdown",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "html",
      "htm"
    ],
    "outputExt": "md"
  },
  {
    "id": "markdown-pdf",
    "from": "Markdown",
    "to": "PDF",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "md",
      "markdown"
    ],
    "outputExt": "pdf"
  },
  {
    "id": "html-txt",
    "from": "HTML",
    "to": "TXT",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "html",
      "htm"
    ],
    "outputExt": "txt"
  },
  {
    "id": "txt-html",
    "from": "TXT",
    "to": "HTML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "txt"
    ],
    "outputExt": "html"
  },
  {
    "id": "sql-csv",
    "from": "SQL",
    "to": "CSV",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "sql"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-sql",
    "from": "CSV",
    "to": "SQL",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "sql"
  },
  {
    "id": "base64-file",
    "from": "Base64",
    "to": "File",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "txt",
      "base64"
    ],
    "outputExt": "bin"
  },
  {
    "id": "file-base64",
    "from": "File",
    "to": "Base64",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [],
    "outputExt": "txt"
  },
  {
    "id": "log-csv",
    "from": "Log",
    "to": "CSV",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "log",
      "txt"
    ],
    "outputExt": "csv"
  },
  {
    "id": "csv-tsv-data",
    "from": "CSV",
    "to": "TSV (Data)",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "csv"
    ],
    "outputExt": "tsv"
  },
  {
    "id": "tsv-json",
    "from": "TSV",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "tsv",
      "txt"
    ],
    "outputExt": "json"
  },
  {
    "id": "json-tsv",
    "from": "JSON",
    "to": "TSV",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "tsv"
  },
  {
    "id": "toml-json",
    "from": "TOML",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "toml"
    ],
    "outputExt": "json"
  },
  {
    "id": "json-toml",
    "from": "JSON",
    "to": "TOML",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "toml"
  },
  {
    "id": "ini-json",
    "from": "INI",
    "to": "JSON",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "ini",
      "cfg"
    ],
    "outputExt": "json"
  },
  {
    "id": "json-ini",
    "from": "JSON",
    "to": "INI",
    "category": "data",
    "type": "data",
    "timeoutMs": 120000,
    "inputExts": [
      "json"
    ],
    "outputExt": "ini"
  }
];

const TOOL_EXT = TOOL_DEFS.reduce((acc, tool) => {
  acc[tool.id] = tool.outputExt;
  return acc;
}, {});

const TOOL_IDS = new Set(TOOL_DEFS.map((tool) => tool.id));

const TOOL_META = TOOL_DEFS.reduce((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {});

export {
  TOOL_DEFS,
  TOOL_EXT,
  TOOL_IDS,
  TOOL_META
};
