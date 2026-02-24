FROM node:20-bullseye
RUN set -e; \
  . /etc/os-release; \
  echo "deb http://deb.debian.org/debian ${VERSION_CODENAME} main contrib non-free" > /etc/apt/sources.list; \
  echo "deb http://deb.debian.org/debian-security ${VERSION_CODENAME}-security main contrib non-free" >> /etc/apt/sources.list; \
  echo "deb http://deb.debian.org/debian ${VERSION_CODENAME}-updates main contrib non-free" >> /etc/apt/sources.list; \
  apt-get update && apt-get install -y \
  ffmpeg \
  libreoffice \
  imagemagick \
  ghostscript \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-rus \
  tesseract-ocr-ukr \
  tesseract-ocr-deu \
  tesseract-ocr-fra \
  tesseract-ocr-spa \
  tesseract-ocr-ita \
  tesseract-ocr-por \
  libheif1 \
  librsvg2-bin \
  p7zip-full \
  p7zip-rar \
  zip \
  unzip \
  && rm -rf /var/lib/apt/lists* \
  && for policy in /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml; do \
       if [ -f "$policy" ]; then \
         sed -i '/pattern="[^"]*PDF[^"]*"/d' "$policy"; \
         sed -i '/<\/policymap>/i\  <policy domain="coder" rights="read|write" pattern="PDF" />' "$policy"; \
       fi; \
     done
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY shared ./shared
ENV NODE_ENV=production
CMD ["node", "src/worker.js"]
