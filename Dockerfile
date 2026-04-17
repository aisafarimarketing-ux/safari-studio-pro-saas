FROM node:22.12-slim

WORKDIR /app

# Install deps first (cached separately from source)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source
COPY . .

# Prisma client + Next.js production build
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
