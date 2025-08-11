# Getting Started

Complete setup guide for the T3 Stack Starter Application. This guide will take you from initial clone to a running development environment.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js**: Version 18.17.0 or higher
- **Yarn**: Version 1.22.22 (specified in package.json)
- **PostgreSQL**: Version 12 or higher (or Docker for container-based setup)
- **Git**: Latest stable version

### Recommended Development Tools
- **VS Code**: Recommended IDE with the following extensions:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode", 
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-vscode.vscode-json"
  ]
}
```

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd albeorla-ts-starter

# Install dependencies
yarn install

# Generate Prisma client
yarn postinstall
```

### 2. Environment Configuration

The project uses a hierarchical environment variable system with [`dotenv-flow`](https://github.com/kerimdzhanov/dotenv-flow):

```bash
# Copy the environment template
cp .env.example .env

# Generate authentication secret
yarn dlx auth secret
```

#### Required Environment Variables

Edit your `.env` file with the following required variables:

```env
# Database - Use localhost for local development
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# NextAuth.js - Generated secret for JWT signing
AUTH_SECRET="your-generated-auth-secret-here"

# Discord OAuth (setup instructions below)
AUTH_DISCORD_ID="your-discord-app-id"
AUTH_DISCORD_SECRET="your-discord-app-secret"

# Development settings
NODE_ENV="development"

# Test authentication (development only)
ENABLE_TEST_AUTH="true"
```

#### Environment Files Overview

- **`.env`**: Local development (gitignored, your personal config)
- **`.env.test`**: Docker and E2E testing config (committed, no secrets)
- **`.env.local`**: Personal overrides (gitignored, optional)
- **`.env.example`**: Template for new developers (committed)

### 3. Database Setup

Choose one of the following database setup methods:

#### Option A: Local PostgreSQL Installation

```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create development database
createdb albeorla_ts_starter_dev

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://postgres:@localhost:5432/albeorla_ts_starter_dev"

# Run database migrations
yarn db:generate
```

#### Option B: Docker Database (Recommended)

```bash
# Start PostgreSQL container using our script
./scripts/start-database.sh

# Or manually with Docker
docker run --name postgres-dev \
  -e POSTGRES_DB=albeorla_ts_starter_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Update DATABASE_URL in .env for Docker
DATABASE_URL="postgresql://postgres:password@localhost:5432/albeorla_ts_starter_dev"

# Generate Prisma schema and run migrations
yarn db:generate
```

### 4. Discord OAuth Setup

To enable authentication, you'll need to set up a Discord OAuth application:

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Navigate to the "OAuth2" section

2. **Configure OAuth2**:
   - In "Redirects", add: `http://localhost:3000/api/auth/callback/discord`
   - Copy the "Client ID" to `AUTH_DISCORD_ID` in your `.env`
   - Copy the "Client Secret" to `AUTH_DISCORD_SECRET` in your `.env`

3. **Optional: Bot Setup**:
   - Navigate to "Bot" section if you need bot functionality
   - Generate and save the bot token (not needed for basic auth)

### 5. Verify Setup

Test that everything is configured correctly:

```bash
# Check environment variables are valid
yarn build

# Test database connection
npx prisma db pull

# Start development server
yarn dev
```

Your application should now be running at [http://localhost:3000](http://localhost:3000).

## First Run Checklist

- [ ] Dependencies installed (`yarn install`)
- [ ] Environment variables configured (`.env` file)
- [ ] Database running and accessible
- [ ] Prisma client generated (`yarn postinstall`)
- [ ] Discord OAuth app created and configured
- [ ] Development server starts without errors (`yarn dev`)
- [ ] Can access application at http://localhost:3000
- [ ] Authentication flow works (Discord login)

## Development Workflow

Once set up, your daily development routine:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
yarn install

# Run database migrations if any
yarn db:generate

# Start development server with Turbo
yarn dev
```

## Common Setup Issues

### Database Connection Errors
- **Local PostgreSQL**: Ensure PostgreSQL service is running
- **Docker**: Check if database container is healthy with `docker ps`
- **Wrong hostname**: Use `localhost` for local setup, `db` for Docker

### Authentication Failures  
- Verify `AUTH_SECRET` is set and generated properly
- Check Discord OAuth credentials are correct
- Ensure redirect URI matches exactly: `http://localhost:3000/api/auth/callback/discord`

### Environment Variable Issues
- Run `yarn build` to validate all required variables
- Check `src/env.js` for complete list of required variables
- Use `SKIP_ENV_VALIDATION=true` temporarily to bypass validation

### Port Conflicts
- If port 3000 is in use, stop other applications or change port
- For database, ensure port 5432 is available

## Next Steps

With your development environment ready:

- **[Development Guide](./development.md)** - Learn the development workflow and coding standards
- **[Architecture Guide](./architecture.md)** - Understand the project structure and technology choices  
- **[Testing Guide](./testing.md)** - Set up and run the test suite
- **[Features Guide](./features.md)** - Explore the RBAC system and available features

## Security Notes

- Never commit real secrets to git (only `.env.example` should contain example values)
- Use different Discord OAuth apps for development, testing, and production
- Rotate your `AUTH_SECRET` regularly
- Keep your database credentials secure

---

**Need Help?** If you encounter issues not covered here, check the troubleshooting sections in other documentation files or create an issue in the repository.