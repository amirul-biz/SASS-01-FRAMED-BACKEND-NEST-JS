<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Framed API &mdash; a <a href="http://nodejs.org" target="_blank">NestJS</a> backend using Prisma (PostgreSQL) and Firebase Authentication.</p>

## Description

Framed's backend API. Built with [NestJS](https://nestjs.com), [Prisma](https://www.prisma.io) for data access, and [Firebase Admin](https://firebase.google.com/docs/admin/setup) for authentication (currently: photographer registration).

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and npm
- A PostgreSQL database (e.g. [Supabase](https://supabase.com), or any Postgres instance)
- A Firebase project with a service account key

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@HOST:5432/DATABASE`. Used by Prisma ([prisma/schema.prisma](prisma/schema.prisma), [prisma.config.ts](prisma.config.ts)). |
| `FIREBASE_PROJECT_ID` | Firebase project ID. |
| `FIREBASE_CLIENT_EMAIL` | Service account client email. |
| `FIREBASE_PRIVATE_KEY` | Service account private key, with `\n` line breaks kept literal (don't replace them with real newlines in the `.env` file). |
| `PORT` | Optional. Port the app listens on (defaults to `3001`, see [src/main.ts](src/main.ts)). |

To get the Firebase values: Firebase Console → Project Settings → Service Accounts → **Generate new private key**. This downloads a JSON file containing `project_id`, `client_email`, and `private_key` — map those directly to the env vars above.

`DATABASE_URL`, `FIREBASE_PROJECT_ID`, and `FIREBASE_CLIENT_EMAIL` are read via [`ConfigModule.forRoot({ isGlobal: true })`](src/app.module.ts), so `.env` is loaded automatically on boot — no extra setup needed once the file exists.

If the Authentication product has never been enabled on your Firebase project, `createUser` calls will fail with `auth/configuration-not-found`. Enable it once via Firebase Console → Build → Authentication → **Get started** → enable the **Email/Password** sign-in method.

## 3. Set up the database with Prisma

Generate the Prisma client and apply migrations against your `DATABASE_URL`:

```bash
# generate the Prisma client (outputs to /generated, gitignored)
npx prisma generate

# apply existing migrations to your database
npx prisma migrate deploy

# (development only) create a new migration after changing prisma/schema.prisma
npx prisma migrate dev --name <migration_name>

# inspect your data
npx prisma studio
```

The schema lives in [prisma/schema.prisma](prisma/schema.prisma): `User`, `UserPlatform`, `PhotographerProfile`, and `AdminProfile` models backing photographer registration.

## 4. Run the app

```bash
# development
npm run start

# watch mode (recommended during development)
npm run start:dev

# webpack + hot module reload
npm run start-hot-reload

# production mode (build first, then run the compiled output)
npm run build
npm run start:prod
```

## 5. Verify it's running

The app listens on `http://localhost:3001` by default (or `PORT` if set). Swagger API docs are available at [http://localhost:3001/api](http://localhost:3001/api).

Try the photographer registration endpoint:

```bash
curl -X POST http://localhost:3001/photographer/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane.doe@example.com","password":"securePass123","name":"Jane Doe"}'
```

## Run tests

```bash
# unit tests
npm run test

# test coverage
npm run test:cov
```

## Project structure

```
src/
  config/
    database/     # PrismaService / PrismaModule
    firebase/      # FirebaseService / FirebaseModule (Admin SDK init)
  photographer/    # POST /photographer/register
  sample/          # example CRUD module scaffold
prisma/
  schema.prisma    # data models
  migrations/      # SQL migrations
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)

## License

UNLICENSED (private project).
