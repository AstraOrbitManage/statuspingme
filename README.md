# StatusPing

Uptime monitoring service - know when your services go down.

## Project Structure

```
src/
├── api/          # Backend (Express + TypeScript)
├── web/          # Frontend (React + Vite + TypeScript)
├── package.json  # Root workspace configuration
└── .env.example  # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- PostgreSQL (for later stages)

### Installation

```bash
# Clone and navigate to project
cd src

# Copy environment variables
cp .env.example .env

# Install dependencies
npm install

# Start development servers
npm run dev
```

### Development

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:api` | Start only the backend |
| `npm run dev:web` | Start only the frontend |
| `npm run build` | Build both packages for production |
| `npm run start` | Start the production backend server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `PORT` | Backend server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `VITE_API_URL` | API URL for frontend | http://localhost:3001 |

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, Vite, TypeScript
- **Database:** PostgreSQL
- **Tooling:** ESLint, Prettier

## License

MIT
