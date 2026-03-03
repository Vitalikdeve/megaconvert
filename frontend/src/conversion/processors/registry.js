const createProcessor = ({ id, category, inputs, output }) => ({
  id,
  category,
  inputs,
  output
});

const PROCESSORS = [
  {
    "id": "pdf-word",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "docx"
  },
  {
    "id": "word-pdf",
    "category": "doc",
    "inputs": [
      "docx",
      "doc"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-jpg",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "jpg"
  },
  {
    "id": "jpg-pdf",
    "category": "doc",
    "inputs": [
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
    "output": "pdf"
  },
  {
    "id": "pdf-png",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "png"
  },
  {
    "id": "png-pdf",
    "category": "doc",
    "inputs": [
      "png"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-txt",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "txt"
  },
  {
    "id": "txt-pdf",
    "category": "doc",
    "inputs": [
      "txt"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-html",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "html"
  },
  {
    "id": "html-pdf",
    "category": "doc",
    "inputs": [
      "html",
      "htm"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-epub",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "epub"
  },
  {
    "id": "epub-pdf",
    "category": "doc",
    "inputs": [
      "epub"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-mobi",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "mobi"
  },
  {
    "id": "mobi-pdf",
    "category": "doc",
    "inputs": [
      "mobi",
      "azw",
      "azw3"
    ],
    "output": "pdf"
  },
  {
    "id": "docx-txt",
    "category": "doc",
    "inputs": [
      "docx"
    ],
    "output": "txt"
  },
  {
    "id": "txt-docx",
    "category": "doc",
    "inputs": [
      "txt"
    ],
    "output": "docx"
  },
  {
    "id": "doc-docx",
    "category": "doc",
    "inputs": [
      "doc"
    ],
    "output": "docx"
  },
  {
    "id": "docx-doc",
    "category": "doc",
    "inputs": [
      "docx"
    ],
    "output": "doc"
  },
  {
    "id": "doc-pdf",
    "category": "doc",
    "inputs": [
      "doc"
    ],
    "output": "pdf"
  },
  {
    "id": "rtf-pdf",
    "category": "doc",
    "inputs": [
      "rtf"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-rtf",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "rtf"
  },
  {
    "id": "odt-docx",
    "category": "doc",
    "inputs": [
      "odt"
    ],
    "output": "docx"
  },
  {
    "id": "docx-odt",
    "category": "doc",
    "inputs": [
      "docx"
    ],
    "output": "odt"
  },
  {
    "id": "odt-pdf",
    "category": "doc",
    "inputs": [
      "odt"
    ],
    "output": "pdf"
  },
  {
    "id": "ppt-pdf",
    "category": "doc",
    "inputs": [
      "ppt"
    ],
    "output": "pdf"
  },
  {
    "id": "pptx-pdf",
    "category": "doc",
    "inputs": [
      "pptx"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-pptx",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "pptx"
  },
  {
    "id": "pdf-ppt",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "ppt"
  },
  {
    "id": "xls-pdf",
    "category": "doc",
    "inputs": [
      "xls"
    ],
    "output": "pdf"
  },
  {
    "id": "xlsx-pdf",
    "category": "doc",
    "inputs": [
      "xlsx"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-xlsx",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "xlsx"
  },
  {
    "id": "pdf-xls",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "xls"
  },
  {
    "id": "csv-xlsx",
    "category": "doc",
    "inputs": [
      "csv"
    ],
    "output": "xlsx"
  },
  {
    "id": "xlsx-csv",
    "category": "doc",
    "inputs": [
      "xlsx"
    ],
    "output": "csv"
  },
  {
    "id": "csv-pdf",
    "category": "doc",
    "inputs": [
      "csv"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-csv",
    "category": "doc",
    "inputs": [
      "pdf"
    ],
    "output": "csv"
  },
  {
    "id": "tsv-csv",
    "category": "doc",
    "inputs": [
      "tsv",
      "txt"
    ],
    "output": "csv"
  },
  {
    "id": "csv-tsv",
    "category": "doc",
    "inputs": [
      "csv"
    ],
    "output": "tsv"
  },
  {
    "id": "docx-html",
    "category": "doc",
    "inputs": [
      "docx"
    ],
    "output": "html"
  },
  {
    "id": "html-docx",
    "category": "doc",
    "inputs": [
      "html",
      "htm"
    ],
    "output": "docx"
  },
  {
    "id": "jpg-png",
    "category": "image",
    "inputs": [
      "jpg",
      "jpeg"
    ],
    "output": "png"
  },
  {
    "id": "png-jpg",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "jpg"
  },
  {
    "id": "jpg-webp",
    "category": "image",
    "inputs": [
      "jpg",
      "jpeg"
    ],
    "output": "webp"
  },
  {
    "id": "webp-jpg",
    "category": "image",
    "inputs": [
      "webp"
    ],
    "output": "jpg"
  },
  {
    "id": "png-webp",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "webp"
  },
  {
    "id": "webp-png",
    "category": "image",
    "inputs": [
      "webp"
    ],
    "output": "png"
  },
  {
    "id": "heic-jpg",
    "category": "image",
    "inputs": [
      "heic",
      "heif"
    ],
    "output": "jpg"
  },
  {
    "id": "heic-png",
    "category": "image",
    "inputs": [
      "heic",
      "heif"
    ],
    "output": "png"
  },
  {
    "id": "avif-jpg",
    "category": "image",
    "inputs": [
      "avif"
    ],
    "output": "jpg"
  },
  {
    "id": "avif-png",
    "category": "image",
    "inputs": [
      "avif"
    ],
    "output": "png"
  },
  {
    "id": "jpg-avif",
    "category": "image",
    "inputs": [
      "jpg",
      "jpeg"
    ],
    "output": "avif"
  },
  {
    "id": "png-avif",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "avif"
  },
  {
    "id": "tiff-jpg",
    "category": "image",
    "inputs": [
      "tiff",
      "tif"
    ],
    "output": "jpg"
  },
  {
    "id": "tiff-png",
    "category": "image",
    "inputs": [
      "tiff",
      "tif"
    ],
    "output": "png"
  },
  {
    "id": "bmp-jpg",
    "category": "image",
    "inputs": [
      "bmp"
    ],
    "output": "jpg"
  },
  {
    "id": "bmp-png",
    "category": "image",
    "inputs": [
      "bmp"
    ],
    "output": "png"
  },
  {
    "id": "gif-jpg",
    "category": "image",
    "inputs": [
      "gif"
    ],
    "output": "jpg"
  },
  {
    "id": "gif-png",
    "category": "image",
    "inputs": [
      "gif"
    ],
    "output": "png"
  },
  {
    "id": "svg-png",
    "category": "image",
    "inputs": [
      "svg"
    ],
    "output": "png"
  },
  {
    "id": "svg-jpg",
    "category": "image",
    "inputs": [
      "svg"
    ],
    "output": "jpg"
  },
  {
    "id": "png-svg",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "svg"
  },
  {
    "id": "ico-png",
    "category": "image",
    "inputs": [
      "ico"
    ],
    "output": "png"
  },
  {
    "id": "png-ico",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "ico"
  },
  {
    "id": "psd-jpg",
    "category": "image",
    "inputs": [
      "psd"
    ],
    "output": "jpg"
  },
  {
    "id": "psd-png",
    "category": "image",
    "inputs": [
      "psd"
    ],
    "output": "png"
  },
  {
    "id": "raw-jpg",
    "category": "image",
    "inputs": [
      "raw",
      "cr2",
      "nef",
      "orf",
      "dng",
      "arw"
    ],
    "output": "jpg"
  },
  {
    "id": "raw-png",
    "category": "image",
    "inputs": [
      "raw",
      "cr2",
      "nef",
      "orf",
      "dng",
      "arw"
    ],
    "output": "png"
  },
  {
    "id": "cr2-jpg",
    "category": "image",
    "inputs": [
      "cr2"
    ],
    "output": "jpg"
  },
  {
    "id": "nef-jpg",
    "category": "image",
    "inputs": [
      "nef"
    ],
    "output": "jpg"
  },
  {
    "id": "orf-jpg",
    "category": "image",
    "inputs": [
      "orf"
    ],
    "output": "jpg"
  },
  {
    "id": "dng-jpg",
    "category": "image",
    "inputs": [
      "dng"
    ],
    "output": "jpg"
  },
  {
    "id": "jpg-tiff",
    "category": "image",
    "inputs": [
      "jpg",
      "jpeg"
    ],
    "output": "tiff"
  },
  {
    "id": "png-tiff",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "tiff"
  },
  {
    "id": "tiff-webp",
    "category": "image",
    "inputs": [
      "tiff",
      "tif"
    ],
    "output": "webp"
  },
  {
    "id": "gif-webp",
    "category": "image",
    "inputs": [
      "gif"
    ],
    "output": "webp"
  },
  {
    "id": "webp-gif",
    "category": "image",
    "inputs": [
      "webp"
    ],
    "output": "gif"
  },
  {
    "id": "jpg-gif",
    "category": "image",
    "inputs": [
      "jpg",
      "jpeg"
    ],
    "output": "gif"
  },
  {
    "id": "png-gif",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "gif"
  },
  {
    "id": "svg-webp",
    "category": "image",
    "inputs": [
      "svg"
    ],
    "output": "webp"
  },
  {
    "id": "webp-svg",
    "category": "image",
    "inputs": [
      "webp"
    ],
    "output": "svg"
  },
  {
    "id": "heic-webp",
    "category": "image",
    "inputs": [
      "heic",
      "heif"
    ],
    "output": "webp"
  },
  {
    "id": "avif-webp",
    "category": "image",
    "inputs": [
      "avif"
    ],
    "output": "webp"
  },
  {
    "id": "eps-jpg",
    "category": "image",
    "inputs": [
      "eps"
    ],
    "output": "jpg"
  },
  {
    "id": "eps-png",
    "category": "image",
    "inputs": [
      "eps"
    ],
    "output": "png"
  },
  {
    "id": "ai-png",
    "category": "image",
    "inputs": [
      "ai"
    ],
    "output": "png"
  },
  {
    "id": "ai-jpg",
    "category": "image",
    "inputs": [
      "ai"
    ],
    "output": "jpg"
  },
  {
    "id": "pdf-svg",
    "category": "image",
    "inputs": [
      "pdf"
    ],
    "output": "svg"
  },
  {
    "id": "svg-pdf",
    "category": "image",
    "inputs": [
      "svg"
    ],
    "output": "pdf"
  },
  {
    "id": "pdf-png-hires",
    "category": "image",
    "inputs": [
      "pdf"
    ],
    "output": "png"
  },
  {
    "id": "png-pdf-multi-page",
    "category": "image",
    "inputs": [
      "png"
    ],
    "output": "pdf"
  },
  {
    "id": "mp4-mp3",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "mp3"
  },
  {
    "id": "mp4-wav",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "wav"
  },
  {
    "id": "mp4-gif",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "gif"
  },
  {
    "id": "mp4-webm",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "webm"
  },
  {
    "id": "mp4-avi",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "avi"
  },
  {
    "id": "mp4-mov",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "mov"
  },
  {
    "id": "mp4-mkv",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "mkv"
  },
  {
    "id": "mov-mp4",
    "category": "video",
    "inputs": [
      "mov"
    ],
    "output": "mp4"
  },
  {
    "id": "mkv-mp4",
    "category": "video",
    "inputs": [
      "mkv"
    ],
    "output": "mp4"
  },
  {
    "id": "avi-mp4",
    "category": "video",
    "inputs": [
      "avi"
    ],
    "output": "mp4"
  },
  {
    "id": "webm-mp4",
    "category": "video",
    "inputs": [
      "webm"
    ],
    "output": "mp4"
  },
  {
    "id": "flv-mp4",
    "category": "video",
    "inputs": [
      "flv"
    ],
    "output": "mp4"
  },
  {
    "id": "wmv-mp4",
    "category": "video",
    "inputs": [
      "wmv"
    ],
    "output": "mp4"
  },
  {
    "id": "mpg-mp4",
    "category": "video",
    "inputs": [
      "mpg",
      "mpeg"
    ],
    "output": "mp4"
  },
  {
    "id": "3gp-mp4",
    "category": "video",
    "inputs": [
      "3gp"
    ],
    "output": "mp4"
  },
  {
    "id": "m4v-mp4",
    "category": "video",
    "inputs": [
      "m4v"
    ],
    "output": "mp4"
  },
  {
    "id": "mp4-flv",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "flv"
  },
  {
    "id": "mp4-wmv",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "wmv"
  },
  {
    "id": "mp4-m4v",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "m4v"
  },
  {
    "id": "mov-gif",
    "category": "video",
    "inputs": [
      "mov"
    ],
    "output": "gif"
  },
  {
    "id": "mkv-gif",
    "category": "video",
    "inputs": [
      "mkv"
    ],
    "output": "gif"
  },
  {
    "id": "avi-gif",
    "category": "video",
    "inputs": [
      "avi"
    ],
    "output": "gif"
  },
  {
    "id": "webm-gif",
    "category": "video",
    "inputs": [
      "webm"
    ],
    "output": "gif"
  },
  {
    "id": "mp4-jpg-frames",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "zip"
  },
  {
    "id": "mp4-png-frames",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "zip"
  },
  {
    "id": "gif-mp4",
    "category": "video",
    "inputs": [
      "gif"
    ],
    "output": "mp4"
  },
  {
    "id": "gif-webm",
    "category": "video",
    "inputs": [
      "gif"
    ],
    "output": "webm"
  },
  {
    "id": "ts-mp4",
    "category": "video",
    "inputs": [
      "ts"
    ],
    "output": "mp4"
  },
  {
    "id": "vob-mp4",
    "category": "video",
    "inputs": [
      "vob"
    ],
    "output": "mp4"
  },
  {
    "id": "ogv-mp4",
    "category": "video",
    "inputs": [
      "ogv"
    ],
    "output": "mp4"
  },
  {
    "id": "mp4-ogv",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "ogv"
  },
  {
    "id": "mp4-hls",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "zip"
  },
  {
    "id": "mp4-dash",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "zip"
  },
  {
    "id": "mov-webm",
    "category": "video",
    "inputs": [
      "mov"
    ],
    "output": "webm"
  },
  {
    "id": "mkv-webm",
    "category": "video",
    "inputs": [
      "mkv"
    ],
    "output": "webm"
  },
  {
    "id": "avi-webm",
    "category": "video",
    "inputs": [
      "avi"
    ],
    "output": "webm"
  },
  {
    "id": "webm-avi",
    "category": "video",
    "inputs": [
      "webm"
    ],
    "output": "avi"
  },
  {
    "id": "mp4-prores",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "mov"
  },
  {
    "id": "prores-mp4",
    "category": "video",
    "inputs": [
      "mov",
      "mxf",
      "prores"
    ],
    "output": "mp4"
  },
  {
    "id": "mp4-vp9",
    "category": "video",
    "inputs": [
      "mp4"
    ],
    "output": "webm"
  },
  {
    "id": "mp3-wav",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "wav"
  },
  {
    "id": "wav-mp3",
    "category": "audio",
    "inputs": [
      "wav"
    ],
    "output": "mp3"
  },
  {
    "id": "flac-mp3",
    "category": "audio",
    "inputs": [
      "flac"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-flac",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "flac"
  },
  {
    "id": "aac-mp3",
    "category": "audio",
    "inputs": [
      "aac"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-aac",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "aac"
  },
  {
    "id": "m4a-mp3",
    "category": "audio",
    "inputs": [
      "m4a"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-m4a",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "m4a"
  },
  {
    "id": "ogg-mp3",
    "category": "audio",
    "inputs": [
      "ogg"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-ogg",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "ogg"
  },
  {
    "id": "wma-mp3",
    "category": "audio",
    "inputs": [
      "wma"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-wma",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "wma"
  },
  {
    "id": "aiff-mp3",
    "category": "audio",
    "inputs": [
      "aiff",
      "aif"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-aiff",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "aiff"
  },
  {
    "id": "amr-mp3",
    "category": "audio",
    "inputs": [
      "amr"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-amr",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "amr"
  },
  {
    "id": "opus-mp3",
    "category": "audio",
    "inputs": [
      "opus"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-opus",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "opus"
  },
  {
    "id": "wav-flac",
    "category": "audio",
    "inputs": [
      "wav"
    ],
    "output": "flac"
  },
  {
    "id": "flac-wav",
    "category": "audio",
    "inputs": [
      "flac"
    ],
    "output": "wav"
  },
  {
    "id": "aac-wav",
    "category": "audio",
    "inputs": [
      "aac"
    ],
    "output": "wav"
  },
  {
    "id": "wav-aac",
    "category": "audio",
    "inputs": [
      "wav"
    ],
    "output": "aac"
  },
  {
    "id": "ogg-wav",
    "category": "audio",
    "inputs": [
      "ogg"
    ],
    "output": "wav"
  },
  {
    "id": "wav-ogg",
    "category": "audio",
    "inputs": [
      "wav"
    ],
    "output": "ogg"
  },
  {
    "id": "m4a-wav",
    "category": "audio",
    "inputs": [
      "m4a"
    ],
    "output": "wav"
  },
  {
    "id": "wav-m4a",
    "category": "audio",
    "inputs": [
      "wav"
    ],
    "output": "m4a"
  },
  {
    "id": "mp3-m4r",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "m4r"
  },
  {
    "id": "m4r-mp3",
    "category": "audio",
    "inputs": [
      "m4r"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-320kbps",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "mp3"
  },
  {
    "id": "mp3-128kbps",
    "category": "audio",
    "inputs": [
      "mp3"
    ],
    "output": "mp3"
  },
  {
    "id": "zip-rar",
    "category": "archive",
    "inputs": [
      "zip"
    ],
    "output": "rar"
  },
  {
    "id": "rar-zip",
    "category": "archive",
    "inputs": [
      "rar"
    ],
    "output": "zip"
  },
  {
    "id": "7z-zip",
    "category": "archive",
    "inputs": [
      "7z"
    ],
    "output": "zip"
  },
  {
    "id": "zip-7z",
    "category": "archive",
    "inputs": [
      "zip"
    ],
    "output": "7z"
  },
  {
    "id": "tar-zip",
    "category": "archive",
    "inputs": [
      "tar"
    ],
    "output": "zip"
  },
  {
    "id": "zip-tar",
    "category": "archive",
    "inputs": [
      "zip"
    ],
    "output": "tar"
  },
  {
    "id": "tar-gz-zip",
    "category": "archive",
    "inputs": [
      "tgz",
      "tar.gz",
      "gz"
    ],
    "output": "zip"
  },
  {
    "id": "zip-tar-gz",
    "category": "archive",
    "inputs": [
      "zip"
    ],
    "output": "tar.gz"
  },
  {
    "id": "gz-zip",
    "category": "archive",
    "inputs": [
      "gz"
    ],
    "output": "zip"
  },
  {
    "id": "bz2-zip",
    "category": "archive",
    "inputs": [
      "bz2"
    ],
    "output": "zip"
  },
  {
    "id": "xz-zip",
    "category": "archive",
    "inputs": [
      "xz"
    ],
    "output": "zip"
  },
  {
    "id": "iso-zip",
    "category": "archive",
    "inputs": [
      "iso"
    ],
    "output": "zip"
  },
  {
    "id": "zip-iso",
    "category": "archive",
    "inputs": [
      "zip"
    ],
    "output": "iso"
  },
  {
    "id": "rar-7z",
    "category": "archive",
    "inputs": [
      "rar"
    ],
    "output": "7z"
  },
  {
    "id": "7z-rar",
    "category": "archive",
    "inputs": [
      "7z"
    ],
    "output": "rar"
  },
  {
    "id": "json-csv",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "csv"
  },
  {
    "id": "csv-json",
    "category": "data",
    "inputs": [
      "csv"
    ],
    "output": "json"
  },
  {
    "id": "json-xml",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "xml"
  },
  {
    "id": "xml-json",
    "category": "data",
    "inputs": [
      "xml"
    ],
    "output": "json"
  },
  {
    "id": "yaml-json",
    "category": "data",
    "inputs": [
      "yaml",
      "yml"
    ],
    "output": "json"
  },
  {
    "id": "json-yaml",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "yaml"
  },
  {
    "id": "xml-csv",
    "category": "data",
    "inputs": [
      "xml"
    ],
    "output": "csv"
  },
  {
    "id": "csv-xml",
    "category": "data",
    "inputs": [
      "csv"
    ],
    "output": "xml"
  },
  {
    "id": "markdown-html",
    "category": "data",
    "inputs": [
      "md",
      "markdown"
    ],
    "output": "html"
  },
  {
    "id": "html-markdown",
    "category": "data",
    "inputs": [
      "html",
      "htm"
    ],
    "output": "md"
  },
  {
    "id": "markdown-pdf",
    "category": "data",
    "inputs": [
      "md",
      "markdown"
    ],
    "output": "pdf"
  },
  {
    "id": "html-txt",
    "category": "data",
    "inputs": [
      "html",
      "htm"
    ],
    "output": "txt"
  },
  {
    "id": "txt-html",
    "category": "data",
    "inputs": [
      "txt"
    ],
    "output": "html"
  },
  {
    "id": "sql-csv",
    "category": "data",
    "inputs": [
      "sql"
    ],
    "output": "csv"
  },
  {
    "id": "csv-sql",
    "category": "data",
    "inputs": [
      "csv"
    ],
    "output": "sql"
  },
  {
    "id": "base64-file",
    "category": "data",
    "inputs": [
      "txt",
      "base64"
    ],
    "output": "bin"
  },
  {
    "id": "file-base64",
    "category": "data",
    "inputs": [],
    "output": "txt"
  },
  {
    "id": "log-csv",
    "category": "data",
    "inputs": [
      "log",
      "txt"
    ],
    "output": "csv"
  },
  {
    "id": "csv-tsv-data",
    "category": "data",
    "inputs": [
      "csv"
    ],
    "output": "tsv"
  },
  {
    "id": "tsv-json",
    "category": "data",
    "inputs": [
      "tsv",
      "txt"
    ],
    "output": "json"
  },
  {
    "id": "json-tsv",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "tsv"
  },
  {
    "id": "toml-json",
    "category": "data",
    "inputs": [
      "toml"
    ],
    "output": "json"
  },
  {
    "id": "json-toml",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "toml"
  },
  {
    "id": "ini-json",
    "category": "data",
    "inputs": [
      "ini",
      "cfg"
    ],
    "output": "json"
  },
  {
    "id": "json-ini",
    "category": "data",
    "inputs": [
      "json"
    ],
    "output": "ini"
  }
].map(createProcessor);

const PROCESSOR_MAP = new Map(PROCESSORS.map((processor) => [processor.id, processor]));

export const getProcessor = (id) => PROCESSOR_MAP.get(id) || null;

export const listProcessors = () => [...PROCESSORS];
