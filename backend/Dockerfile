# Use Node.js LTS version
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x start.sh

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command - Run startup script which handles migrations gracefully
CMD ["sh", "start.sh"]
