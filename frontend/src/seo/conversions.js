const CONVERSIONS = [
  {
    "id": "pdf-word",
    "slug": "pdf-to-word",
    "from": "PDF",
    "to": "Word",
    "category": "documents"
  },
  {
    "id": "word-pdf",
    "slug": "word-to-pdf",
    "from": "Word",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-jpg",
    "slug": "pdf-to-jpg",
    "from": "PDF",
    "to": "JPG",
    "category": "documents"
  },
  {
    "id": "jpg-pdf",
    "slug": "jpg-to-pdf",
    "from": "JPG",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-png",
    "slug": "pdf-to-png",
    "from": "PDF",
    "to": "PNG",
    "category": "documents"
  },
  {
    "id": "png-pdf",
    "slug": "png-to-pdf",
    "from": "PNG",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-txt",
    "slug": "pdf-to-txt",
    "from": "PDF",
    "to": "TXT",
    "category": "documents"
  },
  {
    "id": "txt-pdf",
    "slug": "txt-to-pdf",
    "from": "TXT",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-html",
    "slug": "pdf-to-html",
    "from": "PDF",
    "to": "HTML",
    "category": "documents"
  },
  {
    "id": "html-pdf",
    "slug": "html-to-pdf",
    "from": "HTML",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-epub",
    "slug": "pdf-to-epub",
    "from": "PDF",
    "to": "EPUB",
    "category": "documents"
  },
  {
    "id": "epub-pdf",
    "slug": "epub-to-pdf",
    "from": "EPUB",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-mobi",
    "slug": "pdf-to-mobi",
    "from": "PDF",
    "to": "MOBI",
    "category": "documents"
  },
  {
    "id": "mobi-pdf",
    "slug": "mobi-to-pdf",
    "from": "MOBI",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "docx-txt",
    "slug": "docx-to-txt",
    "from": "DOCX",
    "to": "TXT",
    "category": "documents"
  },
  {
    "id": "txt-docx",
    "slug": "txt-to-docx",
    "from": "TXT",
    "to": "DOCX",
    "category": "documents"
  },
  {
    "id": "doc-docx",
    "slug": "doc-to-docx",
    "from": "DOC",
    "to": "DOCX",
    "category": "documents"
  },
  {
    "id": "docx-doc",
    "slug": "docx-to-doc",
    "from": "DOCX",
    "to": "DOC",
    "category": "documents"
  },
  {
    "id": "doc-pdf",
    "slug": "doc-to-pdf",
    "from": "DOC",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "rtf-pdf",
    "slug": "rtf-to-pdf",
    "from": "RTF",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-rtf",
    "slug": "pdf-to-rtf",
    "from": "PDF",
    "to": "RTF",
    "category": "documents"
  },
  {
    "id": "odt-docx",
    "slug": "odt-to-docx",
    "from": "ODT",
    "to": "DOCX",
    "category": "documents"
  },
  {
    "id": "docx-odt",
    "slug": "docx-to-odt",
    "from": "DOCX",
    "to": "ODT",
    "category": "documents"
  },
  {
    "id": "odt-pdf",
    "slug": "odt-to-pdf",
    "from": "ODT",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "ppt-pdf",
    "slug": "ppt-to-pdf",
    "from": "PPT",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pptx-pdf",
    "slug": "pptx-to-pdf",
    "from": "PPTX",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-pptx",
    "slug": "pdf-to-pptx",
    "from": "PDF",
    "to": "PPTX",
    "category": "documents"
  },
  {
    "id": "pdf-ppt",
    "slug": "pdf-to-ppt",
    "from": "PDF",
    "to": "PPT",
    "category": "documents"
  },
  {
    "id": "xls-pdf",
    "slug": "xls-to-pdf",
    "from": "XLS",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "xlsx-pdf",
    "slug": "xlsx-to-pdf",
    "from": "XLSX",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-xlsx",
    "slug": "pdf-to-xlsx",
    "from": "PDF",
    "to": "XLSX",
    "category": "documents"
  },
  {
    "id": "pdf-xls",
    "slug": "pdf-to-xls",
    "from": "PDF",
    "to": "XLS",
    "category": "documents"
  },
  {
    "id": "csv-xlsx",
    "slug": "csv-to-xlsx",
    "from": "CSV",
    "to": "XLSX",
    "category": "documents"
  },
  {
    "id": "xlsx-csv",
    "slug": "xlsx-to-csv",
    "from": "XLSX",
    "to": "CSV",
    "category": "documents"
  },
  {
    "id": "csv-pdf",
    "slug": "csv-to-pdf",
    "from": "CSV",
    "to": "PDF",
    "category": "documents"
  },
  {
    "id": "pdf-csv",
    "slug": "pdf-to-csv",
    "from": "PDF",
    "to": "CSV",
    "category": "documents"
  },
  {
    "id": "tsv-csv",
    "slug": "tsv-to-csv",
    "from": "TSV",
    "to": "CSV",
    "category": "documents"
  },
  {
    "id": "csv-tsv",
    "slug": "csv-to-tsv",
    "from": "CSV",
    "to": "TSV",
    "category": "documents"
  },
  {
    "id": "docx-html",
    "slug": "docx-to-html",
    "from": "DOCX",
    "to": "HTML",
    "category": "documents"
  },
  {
    "id": "html-docx",
    "slug": "html-to-docx",
    "from": "HTML",
    "to": "DOCX",
    "category": "documents"
  },
  {
    "id": "jpg-png",
    "slug": "jpg-to-png",
    "from": "JPG",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "png-jpg",
    "slug": "png-to-jpg",
    "from": "PNG",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "jpg-webp",
    "slug": "jpg-to-webp",
    "from": "JPG",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "webp-jpg",
    "slug": "webp-to-jpg",
    "from": "WEBP",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "png-webp",
    "slug": "png-to-webp",
    "from": "PNG",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "webp-png",
    "slug": "webp-to-png",
    "from": "WEBP",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "heic-jpg",
    "slug": "heic-to-jpg",
    "from": "HEIC",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "heic-png",
    "slug": "heic-to-png",
    "from": "HEIC",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "avif-jpg",
    "slug": "avif-to-jpg",
    "from": "AVIF",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "avif-png",
    "slug": "avif-to-png",
    "from": "AVIF",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "jpg-avif",
    "slug": "jpg-to-avif",
    "from": "JPG",
    "to": "AVIF",
    "category": "images"
  },
  {
    "id": "png-avif",
    "slug": "png-to-avif",
    "from": "PNG",
    "to": "AVIF",
    "category": "images"
  },
  {
    "id": "tiff-jpg",
    "slug": "tiff-to-jpg",
    "from": "TIFF",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "tiff-png",
    "slug": "tiff-to-png",
    "from": "TIFF",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "bmp-jpg",
    "slug": "bmp-to-jpg",
    "from": "BMP",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "bmp-png",
    "slug": "bmp-to-png",
    "from": "BMP",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "gif-jpg",
    "slug": "gif-to-jpg",
    "from": "GIF",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "gif-png",
    "slug": "gif-to-png",
    "from": "GIF",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "svg-png",
    "slug": "svg-to-png",
    "from": "SVG",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "svg-jpg",
    "slug": "svg-to-jpg",
    "from": "SVG",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "png-svg",
    "slug": "png-to-svg",
    "from": "PNG",
    "to": "SVG",
    "category": "images"
  },
  {
    "id": "ico-png",
    "slug": "ico-to-png",
    "from": "ICO",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "png-ico",
    "slug": "png-to-ico",
    "from": "PNG",
    "to": "ICO",
    "category": "images"
  },
  {
    "id": "psd-jpg",
    "slug": "psd-to-jpg",
    "from": "PSD",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "psd-png",
    "slug": "psd-to-png",
    "from": "PSD",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "raw-jpg",
    "slug": "raw-to-jpg",
    "from": "RAW",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "raw-png",
    "slug": "raw-to-png",
    "from": "RAW",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "cr2-jpg",
    "slug": "cr2-to-jpg",
    "from": "CR2",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "nef-jpg",
    "slug": "nef-to-jpg",
    "from": "NEF",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "orf-jpg",
    "slug": "orf-to-jpg",
    "from": "ORF",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "dng-jpg",
    "slug": "dng-to-jpg",
    "from": "DNG",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "jpg-tiff",
    "slug": "jpg-to-tiff",
    "from": "JPG",
    "to": "TIFF",
    "category": "images"
  },
  {
    "id": "png-tiff",
    "slug": "png-to-tiff",
    "from": "PNG",
    "to": "TIFF",
    "category": "images"
  },
  {
    "id": "tiff-webp",
    "slug": "tiff-to-webp",
    "from": "TIFF",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "gif-webp",
    "slug": "gif-to-webp",
    "from": "GIF",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "webp-gif",
    "slug": "webp-to-gif",
    "from": "WEBP",
    "to": "GIF",
    "category": "images"
  },
  {
    "id": "jpg-gif",
    "slug": "jpg-to-gif",
    "from": "JPG",
    "to": "GIF",
    "category": "images"
  },
  {
    "id": "png-gif",
    "slug": "png-to-gif",
    "from": "PNG",
    "to": "GIF",
    "category": "images"
  },
  {
    "id": "svg-webp",
    "slug": "svg-to-webp",
    "from": "SVG",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "webp-svg",
    "slug": "webp-to-svg",
    "from": "WEBP",
    "to": "SVG",
    "category": "images"
  },
  {
    "id": "heic-webp",
    "slug": "heic-to-webp",
    "from": "HEIC",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "avif-webp",
    "slug": "avif-to-webp",
    "from": "AVIF",
    "to": "WEBP",
    "category": "images"
  },
  {
    "id": "eps-jpg",
    "slug": "eps-to-jpg",
    "from": "EPS",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "eps-png",
    "slug": "eps-to-png",
    "from": "EPS",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "ai-png",
    "slug": "ai-to-png",
    "from": "AI",
    "to": "PNG",
    "category": "images"
  },
  {
    "id": "ai-jpg",
    "slug": "ai-to-jpg",
    "from": "AI",
    "to": "JPG",
    "category": "images"
  },
  {
    "id": "pdf-svg",
    "slug": "pdf-to-svg",
    "from": "PDF",
    "to": "SVG",
    "category": "images"
  },
  {
    "id": "svg-pdf",
    "slug": "svg-to-pdf",
    "from": "SVG",
    "to": "PDF",
    "category": "images"
  },
  {
    "id": "pdf-png-hires",
    "slug": "pdf-to-png-hi-res",
    "from": "PDF",
    "to": "PNG (Hi-Res)",
    "category": "images"
  },
  {
    "id": "png-pdf-multi-page",
    "slug": "png-to-pdf-multi-page",
    "from": "PNG",
    "to": "PDF (Multi-Page)",
    "category": "images"
  },
  {
    "id": "mp4-mp3",
    "slug": "mp4-to-mp3",
    "from": "MP4",
    "to": "MP3",
    "category": "video"
  },
  {
    "id": "mp4-wav",
    "slug": "mp4-to-wav",
    "from": "MP4",
    "to": "WAV",
    "category": "video"
  },
  {
    "id": "mp4-gif",
    "slug": "mp4-to-gif",
    "from": "MP4",
    "to": "GIF",
    "category": "video"
  },
  {
    "id": "mp4-webm",
    "slug": "mp4-to-webm",
    "from": "MP4",
    "to": "WEBM",
    "category": "video"
  },
  {
    "id": "mp4-avi",
    "slug": "mp4-to-avi",
    "from": "MP4",
    "to": "AVI",
    "category": "video"
  },
  {
    "id": "mp4-mov",
    "slug": "mp4-to-mov",
    "from": "MP4",
    "to": "MOV",
    "category": "video"
  },
  {
    "id": "mp4-mkv",
    "slug": "mp4-to-mkv",
    "from": "MP4",
    "to": "MKV",
    "category": "video"
  },
  {
    "id": "mov-mp4",
    "slug": "mov-to-mp4",
    "from": "MOV",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "mkv-mp4",
    "slug": "mkv-to-mp4",
    "from": "MKV",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "avi-mp4",
    "slug": "avi-to-mp4",
    "from": "AVI",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "webm-mp4",
    "slug": "webm-to-mp4",
    "from": "WEBM",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "flv-mp4",
    "slug": "flv-to-mp4",
    "from": "FLV",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "wmv-mp4",
    "slug": "wmv-to-mp4",
    "from": "WMV",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "mpg-mp4",
    "slug": "mpg-to-mp4",
    "from": "MPG",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "3gp-mp4",
    "slug": "3gp-to-mp4",
    "from": "3GP",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "m4v-mp4",
    "slug": "m4v-to-mp4",
    "from": "M4V",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "mp4-flv",
    "slug": "mp4-to-flv",
    "from": "MP4",
    "to": "FLV",
    "category": "video"
  },
  {
    "id": "mp4-wmv",
    "slug": "mp4-to-wmv",
    "from": "MP4",
    "to": "WMV",
    "category": "video"
  },
  {
    "id": "mp4-m4v",
    "slug": "mp4-to-m4v",
    "from": "MP4",
    "to": "M4V",
    "category": "video"
  },
  {
    "id": "mov-gif",
    "slug": "mov-to-gif",
    "from": "MOV",
    "to": "GIF",
    "category": "video"
  },
  {
    "id": "mkv-gif",
    "slug": "mkv-to-gif",
    "from": "MKV",
    "to": "GIF",
    "category": "video"
  },
  {
    "id": "avi-gif",
    "slug": "avi-to-gif",
    "from": "AVI",
    "to": "GIF",
    "category": "video"
  },
  {
    "id": "webm-gif",
    "slug": "webm-to-gif",
    "from": "WEBM",
    "to": "GIF",
    "category": "video"
  },
  {
    "id": "mp4-jpg-frames",
    "slug": "mp4-to-jpg-frames",
    "from": "MP4",
    "to": "JPG Frames",
    "category": "video"
  },
  {
    "id": "mp4-png-frames",
    "slug": "mp4-to-png-frames",
    "from": "MP4",
    "to": "PNG Frames",
    "category": "video"
  },
  {
    "id": "gif-mp4",
    "slug": "gif-to-mp4",
    "from": "GIF",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "gif-webm",
    "slug": "gif-to-webm",
    "from": "GIF",
    "to": "WEBM",
    "category": "video"
  },
  {
    "id": "ts-mp4",
    "slug": "ts-to-mp4",
    "from": "TS",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "vob-mp4",
    "slug": "vob-to-mp4",
    "from": "VOB",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "ogv-mp4",
    "slug": "ogv-to-mp4",
    "from": "OGV",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "mp4-ogv",
    "slug": "mp4-to-ogv",
    "from": "MP4",
    "to": "OGV",
    "category": "video"
  },
  {
    "id": "mp4-hls",
    "slug": "mp4-to-hls",
    "from": "MP4",
    "to": "HLS",
    "category": "video"
  },
  {
    "id": "mp4-dash",
    "slug": "mp4-to-dash",
    "from": "MP4",
    "to": "DASH",
    "category": "video"
  },
  {
    "id": "mov-webm",
    "slug": "mov-to-webm",
    "from": "MOV",
    "to": "WEBM",
    "category": "video"
  },
  {
    "id": "mkv-webm",
    "slug": "mkv-to-webm",
    "from": "MKV",
    "to": "WEBM",
    "category": "video"
  },
  {
    "id": "avi-webm",
    "slug": "avi-to-webm",
    "from": "AVI",
    "to": "WEBM",
    "category": "video"
  },
  {
    "id": "webm-avi",
    "slug": "webm-to-avi",
    "from": "WEBM",
    "to": "AVI",
    "category": "video"
  },
  {
    "id": "mp4-prores",
    "slug": "mp4-to-prores",
    "from": "MP4",
    "to": "ProRes",
    "category": "video"
  },
  {
    "id": "prores-mp4",
    "slug": "prores-to-mp4",
    "from": "ProRes",
    "to": "MP4",
    "category": "video"
  },
  {
    "id": "mp4-vp9",
    "slug": "mp4-to-vp9",
    "from": "MP4",
    "to": "VP9",
    "category": "video"
  },
  {
    "id": "mp3-wav",
    "slug": "mp3-to-wav",
    "from": "MP3",
    "to": "WAV",
    "category": "audio"
  },
  {
    "id": "wav-mp3",
    "slug": "wav-to-mp3",
    "from": "WAV",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "flac-mp3",
    "slug": "flac-to-mp3",
    "from": "FLAC",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-flac",
    "slug": "mp3-to-flac",
    "from": "MP3",
    "to": "FLAC",
    "category": "audio"
  },
  {
    "id": "aac-mp3",
    "slug": "aac-to-mp3",
    "from": "AAC",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-aac",
    "slug": "mp3-to-aac",
    "from": "MP3",
    "to": "AAC",
    "category": "audio"
  },
  {
    "id": "m4a-mp3",
    "slug": "m4a-to-mp3",
    "from": "M4A",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-m4a",
    "slug": "mp3-to-m4a",
    "from": "MP3",
    "to": "M4A",
    "category": "audio"
  },
  {
    "id": "ogg-mp3",
    "slug": "ogg-to-mp3",
    "from": "OGG",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-ogg",
    "slug": "mp3-to-ogg",
    "from": "MP3",
    "to": "OGG",
    "category": "audio"
  },
  {
    "id": "wma-mp3",
    "slug": "wma-to-mp3",
    "from": "WMA",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-wma",
    "slug": "mp3-to-wma",
    "from": "MP3",
    "to": "WMA",
    "category": "audio"
  },
  {
    "id": "aiff-mp3",
    "slug": "aiff-to-mp3",
    "from": "AIFF",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-aiff",
    "slug": "mp3-to-aiff",
    "from": "MP3",
    "to": "AIFF",
    "category": "audio"
  },
  {
    "id": "amr-mp3",
    "slug": "amr-to-mp3",
    "from": "AMR",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-amr",
    "slug": "mp3-to-amr",
    "from": "MP3",
    "to": "AMR",
    "category": "audio"
  },
  {
    "id": "opus-mp3",
    "slug": "opus-to-mp3",
    "from": "OPUS",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-opus",
    "slug": "mp3-to-opus",
    "from": "MP3",
    "to": "OPUS",
    "category": "audio"
  },
  {
    "id": "wav-flac",
    "slug": "wav-to-flac",
    "from": "WAV",
    "to": "FLAC",
    "category": "audio"
  },
  {
    "id": "flac-wav",
    "slug": "flac-to-wav",
    "from": "FLAC",
    "to": "WAV",
    "category": "audio"
  },
  {
    "id": "aac-wav",
    "slug": "aac-to-wav",
    "from": "AAC",
    "to": "WAV",
    "category": "audio"
  },
  {
    "id": "wav-aac",
    "slug": "wav-to-aac",
    "from": "WAV",
    "to": "AAC",
    "category": "audio"
  },
  {
    "id": "ogg-wav",
    "slug": "ogg-to-wav",
    "from": "OGG",
    "to": "WAV",
    "category": "audio"
  },
  {
    "id": "wav-ogg",
    "slug": "wav-to-ogg",
    "from": "WAV",
    "to": "OGG",
    "category": "audio"
  },
  {
    "id": "m4a-wav",
    "slug": "m4a-to-wav",
    "from": "M4A",
    "to": "WAV",
    "category": "audio"
  },
  {
    "id": "wav-m4a",
    "slug": "wav-to-m4a",
    "from": "WAV",
    "to": "M4A",
    "category": "audio"
  },
  {
    "id": "mp3-m4r",
    "slug": "mp3-to-ringtone-m4r",
    "from": "MP3",
    "to": "Ringtone (M4R)",
    "category": "audio"
  },
  {
    "id": "m4r-mp3",
    "slug": "m4r-to-mp3",
    "from": "M4R",
    "to": "MP3",
    "category": "audio"
  },
  {
    "id": "mp3-320kbps",
    "slug": "mp3-to-320kbps",
    "from": "MP3",
    "to": "320kbps",
    "category": "audio"
  },
  {
    "id": "mp3-128kbps",
    "slug": "mp3-to-128kbps",
    "from": "MP3",
    "to": "128kbps",
    "category": "audio"
  },
  {
    "id": "zip-rar",
    "slug": "zip-to-rar",
    "from": "ZIP",
    "to": "RAR",
    "category": "archives"
  },
  {
    "id": "rar-zip",
    "slug": "rar-to-zip",
    "from": "RAR",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "7z-zip",
    "slug": "7z-to-zip",
    "from": "7Z",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "zip-7z",
    "slug": "zip-to-7z",
    "from": "ZIP",
    "to": "7Z",
    "category": "archives"
  },
  {
    "id": "tar-zip",
    "slug": "tar-to-zip",
    "from": "TAR",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "zip-tar",
    "slug": "zip-to-tar",
    "from": "ZIP",
    "to": "TAR",
    "category": "archives"
  },
  {
    "id": "tar-gz-zip",
    "slug": "tar-gz-to-zip",
    "from": "TAR.GZ",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "zip-tar-gz",
    "slug": "zip-to-tar-gz",
    "from": "ZIP",
    "to": "TAR.GZ",
    "category": "archives"
  },
  {
    "id": "gz-zip",
    "slug": "gz-to-zip",
    "from": "GZ",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "bz2-zip",
    "slug": "bz2-to-zip",
    "from": "BZ2",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "xz-zip",
    "slug": "xz-to-zip",
    "from": "XZ",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "iso-zip",
    "slug": "iso-to-zip",
    "from": "ISO",
    "to": "ZIP",
    "category": "archives"
  },
  {
    "id": "zip-iso",
    "slug": "zip-to-iso",
    "from": "ZIP",
    "to": "ISO",
    "category": "archives"
  },
  {
    "id": "rar-7z",
    "slug": "rar-to-7z",
    "from": "RAR",
    "to": "7Z",
    "category": "archives"
  },
  {
    "id": "7z-rar",
    "slug": "7z-to-rar",
    "from": "7Z",
    "to": "RAR",
    "category": "archives"
  },
  {
    "id": "json-csv",
    "slug": "json-to-csv",
    "from": "JSON",
    "to": "CSV",
    "category": "data"
  },
  {
    "id": "csv-json",
    "slug": "csv-to-json",
    "from": "CSV",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "json-xml",
    "slug": "json-to-xml",
    "from": "JSON",
    "to": "XML",
    "category": "data"
  },
  {
    "id": "xml-json",
    "slug": "xml-to-json",
    "from": "XML",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "yaml-json",
    "slug": "yaml-to-json",
    "from": "YAML",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "json-yaml",
    "slug": "json-to-yaml",
    "from": "JSON",
    "to": "YAML",
    "category": "data"
  },
  {
    "id": "xml-csv",
    "slug": "xml-to-csv",
    "from": "XML",
    "to": "CSV",
    "category": "data"
  },
  {
    "id": "csv-xml",
    "slug": "csv-to-xml",
    "from": "CSV",
    "to": "XML",
    "category": "data"
  },
  {
    "id": "markdown-html",
    "slug": "markdown-to-html",
    "from": "Markdown",
    "to": "HTML",
    "category": "data"
  },
  {
    "id": "html-markdown",
    "slug": "html-to-markdown",
    "from": "HTML",
    "to": "Markdown",
    "category": "data"
  },
  {
    "id": "markdown-pdf",
    "slug": "markdown-to-pdf",
    "from": "Markdown",
    "to": "PDF",
    "category": "data"
  },
  {
    "id": "html-txt",
    "slug": "html-to-txt",
    "from": "HTML",
    "to": "TXT",
    "category": "data"
  },
  {
    "id": "txt-html",
    "slug": "txt-to-html",
    "from": "TXT",
    "to": "HTML",
    "category": "data"
  },
  {
    "id": "sql-csv",
    "slug": "sql-to-csv",
    "from": "SQL",
    "to": "CSV",
    "category": "data"
  },
  {
    "id": "csv-sql",
    "slug": "csv-to-sql",
    "from": "CSV",
    "to": "SQL",
    "category": "data"
  },
  {
    "id": "base64-file",
    "slug": "base64-to-file",
    "from": "Base64",
    "to": "File",
    "category": "data"
  },
  {
    "id": "file-base64",
    "slug": "file-to-base64",
    "from": "File",
    "to": "Base64",
    "category": "data"
  },
  {
    "id": "log-csv",
    "slug": "log-to-csv",
    "from": "Log",
    "to": "CSV",
    "category": "data"
  },
  {
    "id": "csv-tsv-data",
    "slug": "csv-to-tsv-data",
    "from": "CSV",
    "to": "TSV (Data)",
    "category": "data"
  },
  {
    "id": "tsv-json",
    "slug": "tsv-to-json",
    "from": "TSV",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "json-tsv",
    "slug": "json-to-tsv",
    "from": "JSON",
    "to": "TSV",
    "category": "data"
  },
  {
    "id": "toml-json",
    "slug": "toml-to-json",
    "from": "TOML",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "json-toml",
    "slug": "json-to-toml",
    "from": "JSON",
    "to": "TOML",
    "category": "data"
  },
  {
    "id": "ini-json",
    "slug": "ini-to-json",
    "from": "INI",
    "to": "JSON",
    "category": "data"
  },
  {
    "id": "json-ini",
    "slug": "json-to-ini",
    "from": "JSON",
    "to": "INI",
    "category": "data"
  }
];

const getConversionBySlug = (slug) => CONVERSIONS.find((c) => c.slug === slug);

const getRelatedConversions = (category, excludeSlug, limit = 8) => {
  return CONVERSIONS.filter((c) => c.category === category && c.slug !== excludeSlug).slice(0, limit);
};

export { CONVERSIONS, getConversionBySlug, getRelatedConversions };
