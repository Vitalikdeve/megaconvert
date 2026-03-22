FROM node:22-alpine AS build

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build -w @messenger/web

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@messenger/web"]

