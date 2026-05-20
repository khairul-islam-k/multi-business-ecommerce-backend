# OneComm API

A private NestJS backend API using Prisma with PostgreSQL.

## Tech Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Passport JWT
- Nodemailer
- Swagger / OpenAPI
- Jest, ESLint, Prettier etc.

## Requirements

- Node.js
- pnpm (npm also work, but pnpm is preferred.)
- PostgreSQL

## Installation

```bash
pnpm install
```

## Environment Setup

Create your local environment file from the example file:

```bash
cp .env.example .env
```

Then update the values in `.env` for your database, JWT settings, mail credentials, and other local configuration.

## Database Commands

Generate Prisma client:

```bash
pnpm run db:generate
```

Push schema changes to the database:

```bash
pnpm run db:push
```

Seed the admin user:

```bash
pnpm run db:seed-admin
```

Open Prisma Studio:

```bash
pnpm run db:studio
```

Reset database data:

```bash
pnpm run db:reset-data
```

## Running the App

Development mode:

```bash
pnpm run dev
```

Standard NestJS watch mode:

```bash
pnpm run start:dev
```

Production build:

```bash
pnpm run build
```

Start production server:

```bash
pnpm run start:prod
```

## Available Scripts

| Script                   | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm run dev`           | Generate Prisma client and start app in watch mode                |
| `pnpm run build`         | Generate Prisma client, push DB schema, seed admin, and build app |
| `pnpm run start`         | Start the app                                                     |
| `pnpm run start:dev`     | Start app in watch mode                                           |
| `pnpm run start:debug`   | Start app in debug watch mode                                     |
| `pnpm run start:prod`    | Run compiled production app                                       |
| `pnpm run db:migrate`    | Run Prisma migrations                                             |
| `pnpm run db:push`       | Push Prisma schema to database                                    |
| `pnpm run db:generate`   | Generate Prisma client                                            |
| `pnpm run db:seed-admin` | Seed default admin user                                           |
| `pnpm run db:reset-data` | Reset database data                                               |
| `pnpm run db:studio`     | Open Prisma Studio                                                |
| `pnpm run format`        | Format code with Prettier                                         |
| `pnpm run lint`          | Lint and auto-fix TypeScript files                                |

## API Documentation

Swagger documentation is available after the app starts, usually at:

```text
http://localhost:8080/v1/api/docs
```

The exact path depends on the Swagger setup in `src/main.ts`.

## Project Structure

```text
onecomm-api/
├── prisma/
├── scripts/
├── src/
├── test/
├── package.json
└── README.md
```

## Notes

- This project is private.
- The license is `UNLICENSED`.
- Review seed scripts before running them in production.
