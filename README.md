# AdXplore API

Backend for [AdXplore](https://adxplore.ir) (ادکسپلور) — Iranian DIY Instagram influencer marketplace.

- API: `https://api.adxplore.ir`
- Panel: `https://app.adxplore.ir` (separate React app)

## Stack

- NestJS + TypeScript (strict)
- Prisma 7 + SQLite (local MVP; switch to PostgreSQL via `DATABASE_URL` + adapter)
- JWT access token (7d) after SMS OTP verify
- Melipayamak shared SMS API

## Setup

```bash
cp .env.example .env
# Fill JWT_SECRET and SMS_MELIPAYAMAK_PATH

npm install @prisma/adapter-better-sqlite3 dotenv
npx prisma migrate dev --name init
npx prisma generate
npm run start:dev
```


API base: `http://localhost:3000/v1`

If `SMS_MELIPAYAMAK_PATH` is empty (non-production), OTP codes are logged to the console.

## Auth

### Request OTP

`POST /v1/auth/otp/request`

```json
{ "phone": "09121234567" }
```

### Verify OTP → JWT

`POST /v1/auth/otp/verify`

```json
{ "phone": "09121234567", "code": "12345" }
```

## Profile

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/users/me` | Current user |
| `PATCH` | `/v1/users/me` | Update `{ "name": "..." }` |

## Health

`GET /v1/health`

## Swagger

Interactive docs: [http://localhost:3000/docs](http://localhost:3000/docs)  
OpenAPI JSON: [http://localhost:3000/docs/json](http://localhost:3000/docs/json)

Use **Authorize** with the JWT from `/v1/auth/otp/verify` to try protected routes.
