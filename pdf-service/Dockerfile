# Playwright's official image bundles Chromium + every system lib it needs.
# This is the simplest way to get a reliable PDF renderer on Railway.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY index.js ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
