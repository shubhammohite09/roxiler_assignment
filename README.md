# Store Ratings (Express + PostgreSQL + React)

## Setup
1. Create DB: `createdb store_ratings && psql store_ratings -f backend/schema.sql`
2. Backend: `cd backend && cp .env.example .env && npm i && npm run seed && npm start` (port 4000)
3. Frontend: `cd frontend && npm i && npm run dev` (port 5173, proxies /api)

Seeded admin: `admin@example.com` / `Admin@1234` (create it with `npm run seed`).
Roles: `admin`, `user`, `store_owner`. Normal users self-register; admins create everyone else and stores.
