FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.html app.js styles.css rules.html ./
COPY img/web ./img/web
COPY src ./src
COPY scripts ./scripts
COPY db ./db

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && npm run seed && npm start"]
