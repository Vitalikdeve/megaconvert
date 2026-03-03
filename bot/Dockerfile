FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --fund=false

COPY src ./src
COPY .env.example ./.env.example

RUN mkdir -p /app/data

ENV NODE_ENV=production

CMD ["npm", "start"]
