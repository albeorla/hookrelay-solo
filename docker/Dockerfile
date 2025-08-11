FROM mcr.microsoft.com/playwright:v1.54.1-jammy

WORKDIR /app

# Install system dependencies early for better caching
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files first for better caching
COPY package*.json ./
COPY yarn.lock ./

# Copy prisma schema for postinstall script
COPY prisma ./prisma

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Set default environment
ENV NODE_ENV=test
ENV PORT=3001

# Expose ports
EXPOSE 3000 3001

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Use entrypoint for flexible startup
ENTRYPOINT ["/app/entrypoint.sh"]
