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
| `PATCH` | `/v1/users/me` | Update profile fields |

Brand / influencer profile fields (all optional on PATCH; role-specific required sets enforced server-side):

```json
{
  "name": "سارا محمدی",
  "category": "BEAUTY",
  "city": "تهران",
  "website": "@sara",
  "followerRange": "FROM_10K_50K",
  "goal": "AWARENESS",
  "businessSize": "SME"
}
```

Enums: `BrandCategory`, `BrandGoal`, `BusinessSize`, `FollowerRange` — see Swagger.

## Campaigns

Require `Authorization: Bearer <accessToken>` and `role = BRAND`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/campaigns` | Create campaign |
| `GET` | `/v1/campaigns` | List my campaigns |
| `GET` | `/v1/campaigns/:id` | Get one campaign I own |
| `PATCH` | `/v1/campaigns/:id` | Update campaign (incl. status) |

```json
{
  "title": "لانچ محصول تابستانی",
  "brief": "نیاز به ریویو محصول در ریلز",
  "category": "BEAUTY",
  "city": "تهران",
  "deliverable": "REEL",
  "budgetMin": 5000000,
  "budgetMax": 15000000,
  "status": "DRAFT"
}
```

Status: `DRAFT` | `OPEN` | `CLOSED`. Deliverable: `STORY` | `POST` | `REEL`.

## Influencers

Require `Authorization: Bearer <accessToken>` and `role = BRAND`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/influencers` | Browse complete influencer profiles |
| `GET` | `/v1/influencers/:id` | Public influencer card |

Query params (optional): `category`, `city`, `followerRange`.

Phone is never exposed in these responses.

## Health

`GET /v1/health`

## Swagger

Interactive docs: [http://localhost:3000/docs](http://localhost:3000/docs)  
OpenAPI JSON: [http://localhost:3000/docs/json](http://localhost:3000/docs/json)

Use **Authorize** with the JWT from `/v1/auth/otp/verify` to try protected routes.
