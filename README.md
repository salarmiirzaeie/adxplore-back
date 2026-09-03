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

### Influencer Instagram approval (PWA / TWA)

After OTP signup and profile onboarding, new influencers cannot use the panel until we confirm they **followed** [@adxplore.ir](https://www.instagram.com/adxplore.ir/) and **DMed a unique code**.

Client routing from `GET /v1/users/me` (and OTP verify) fields:

- `nextScreen`: `ONBOARDING` → `INSTAGRAM_APPROVAL` → `PANEL`
- `canAccessPanel`: `false` until approved
- `approvalStatus`: `PENDING` | `APPROVED` | `REJECTED` (influencers only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/users/me/instagram-approval` | Copy-ready DM message, verify code, follow/DM deep links, step UI |
| `POST` | `/v1/users/me/instagram-approval/confirm-sent` | User tapped «پیام را فرستادم» |
| `GET` | `/v1/admin/influencers?status=PENDING` | Admin queue (search by name / phone / handle / code) |
| `POST` | `/v1/admin/influencers/:id/approve` | Unlock panel after checking IG follow + DM |
| `POST` | `/v1/admin/influencers/:id/reject` | Optional `{ "reason" }` — user can follow/DM again |

Poll `GET /v1/users/me` or the approval endpoint every `pollIntervalSeconds` (15) while waiting. Marketplace browse/offers return `403` with `code: INFLUENCER_NOT_APPROVED` until approved. Existing influencers were backfilled as `APPROVED`.

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

## Marketplace flow (invitations → offers)

1. **Brand** creates an `OPEN` campaign, browses influencers, and sends an **invitation**.
2. **Influencer** sees invitations and may send an **offer** (fee / message / deadline) only if they have a non-cancelled invitation to that campaign.
3. **Brand** accepts or rejects; influencer may cancel a pending offer.
4. On **accept**, a **deal** is created automatically (`IN_PROGRESS`) and the influencer is notified (`DEAL_STARTED`).
5. Influencer submits a deliverable; brand confirms, requests revision, or either party may cancel (before completion).
6. **In-app notifications** cover invitations, offers, and deal lifecycle.

### Invitations

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/invitations` | Invite influencer to campaign (brand only; campaign must be `OPEN`) |
| `GET` | `/v1/invitations` | Brand: sent; influencer: received. Brand may pass `?campaignId=` |
| `GET` | `/v1/invitations/:id` | Get one invitation (party only) |
| `PATCH` | `/v1/invitations/:id` | Cancel: brand only, `PENDING` → `CANCELLED` |

```json
{
  "campaignId": "…",
  "influencerId": "…",
  "message": "دوست داریم با شما روی این کمپین کار کنیم"
}
```

Status: `PENDING` | `CANCELLED`. One invitation row per campaign+influencer (cancelled invitations can be re-activated).

### Offers

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/offers` | Send offer (influencer only; requires `PENDING` invitation; campaign `OPEN`) |
| `GET` | `/v1/offers` | Brand: received; influencer: sent. Optional `?campaignId=` |
| `GET` | `/v1/offers/:id` | Get one offer (party only) |
| `PATCH` | `/v1/offers/:id` | Brand: `ACCEPTED` / `REJECTED`; influencer: `CANCELLED` |

```json
{
  "campaignId": "…",
  "fee": 8000000,
  "message": "آماده همکاری هستم",
  "deadline": "2026-08-20T00:00:00.000Z"
}
```

Status: `PENDING` | `ACCEPTED` | `REJECTED` | `CANCELLED`. At most one pending offer per campaign+influencer pair (history of settled offers is allowed). Accepting an offer creates a linked deal.

### Deals

Require `Authorization: Bearer <accessToken>`. Created automatically when a brand accepts an offer.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/deals` | Brand or influencer: my deals. Optional `?campaignId=` |
| `GET` | `/v1/deals/:id` | Get one deal (party only) |
| `POST` | `/v1/deals/:id/deliverable` | Influencer submits deliverable (multipart or JSON) |
| `PATCH` | `/v1/deals/:id` | Brand: `COMPLETED` / `REVISION_REQUESTED` / `CANCELLED`; influencer: `CANCELLED` |

Submit deliverable (`multipart/form-data` or JSON):

```json
{
  "contentUrl": "https://www.instagram.com/p/ABC123/",
  "note": "ریلز طبق بریف آماده شد"
}
```

Optional multipart field `proof` (JPEG/PNG/WebP image). Allowed from `IN_PROGRESS` or `REVISION_REQUESTED` → sets `DELIVERED` and clears `brandFeedback`.

Update status:

```json
{ "status": "REVISION_REQUESTED", "brandFeedback": "لطفاً لوگو را واضح‌تر نشان دهید" }
```

- Brand `COMPLETED` — from `DELIVERED`
- Brand `REVISION_REQUESTED` — from `DELIVERED` (`brandFeedback` required)
- Brand or influencer `CANCELLED` — from `IN_PROGRESS` or `REVISION_REQUESTED` only

Status: `IN_PROGRESS` | `DELIVERED` | `REVISION_REQUESTED` | `COMPLETED` | `CANCELLED`.

### Notifications

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/notifications` | List my notifications (newest first) |
| `GET` | `/v1/notifications/unread-count` | `{ count }` |
| `PATCH` | `/v1/notifications/:id/read` | Mark one as read |
| `POST` | `/v1/notifications/read-all` | Mark all as read |

Types: `INVITATION_RECEIVED`, `OFFER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_CANCELLED`, `DEAL_STARTED`, `DELIVERABLE_SUBMITTED`, `REVISION_REQUESTED`, `DEAL_COMPLETED`, `DEAL_CANCELLED`.

## Wallet

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/wallets/me` | Balances + saved bank card |
| `GET` | `/v1/wallets/me/transactions` | Ledger |
| `GET` | `/v1/wallets/me/bank-card` | Saved bank card (`bankCard: null` if none) |
| `PUT` | `/v1/wallets/me/bank-card` | Save or edit bank card |
| `POST` | `/v1/wallets/me/withdraw` | Influencer payout request (requires saved bank card) |

Save / edit bank card:

```json
{
  "holderName": "سارا محمدی",
  "cardNumber": "6037998181818187",
  "sheba": "IR760170000000000000000001"
}
```

`GET /v1/wallets/me` includes `hasBankCard` and `bankCard` (`holderName`, `cardNumber`, `cardMasked`, `cardLast4`, `sheba`, `bankName`). Bank name is derived from the card BIN / Sheba.

Payout (`POST /v1/wallets/me/withdraw`) is influencer-only and **requires a saved bank card**. Amount moves available → held until admin pays out. The card is snapshotted onto the request so later edits do not change a pending payout. Admin `GET /v1/admin/withdrawals` includes that `bankCard`.

```json
{ "amountToman": 500000 }
```

## Health

`GET /v1/health`

## Swagger

Interactive docs: [http://localhost:3000/docs](http://localhost:3000/docs)  
OpenAPI JSON: [http://localhost:3000/docs/json](http://localhost:3000/docs/json)

Use **Authorize** with the JWT from `/v1/auth/otp/verify` to try protected routes.
