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
| `GET` | `/v1/users/:id/profile` | Public brand or influencer profile (no phone) |

Brand / influencer profile fields (all optional on PATCH; role-specific required sets enforced server-side):

```json
{
  "name": "سارا محمدی",
  "category": "BEAUTY",
  "city": "تهران",
  "website": "@sara",
  "bio": "تولیدکننده محتوای زیبایی و لایف‌استایل.",
  "followerRange": "FROM_10K_50K",
  "goal": "AWARENESS",
  "businessSize": "SME"
}
```

`bio` is a short about-me / about-the-brand textarea (max 1000 chars) collected at onboarding and shown on public profiles. It is **not** required to finish onboarding.

`GET /v1/users/:id/profile` is the profile page API for the other party. Use it from campaign chat (`peerId` on the conversation), campaign browse (`brand.id`), or influencer browse. Access:

- Brands can open approved influencer profiles
- Influencers can open a brand that has an `OPEN` campaign, or anyone they already have an invitation/offer/chat with
- Phone and approval internals are never returned

Enums: `BrandCategory`, `BrandGoal`, `BusinessSize`, `FollowerRange` — see Swagger.

### Influencer Instagram approval (PWA / TWA)

After OTP signup and profile onboarding, the influencer follows [@adxplore.ir](https://www.instagram.com/adxplore.ir/) and DMs a unique code, then can **browse the panel**. They cannot **send offers** (and are hidden from brands) until an admin approves.

Client routing from `GET /v1/users/me` (and OTP verify) fields:

- `nextScreen`: `ONBOARDING` → `INSTAGRAM_APPROVAL` → `PANEL` (panel after they tap «پیام را فرستادم»)
- `canAccessPanel`: `true` after follow + DM confirm
- `canSendOffers`: `true` only after admin approval
- `approvalStatus`: `PENDING` | `APPROVED` | `REJECTED` (influencers only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/users/me/instagram-approval` | Copy-ready DM message, verify code, follow/DM deep links, step UI |
| `POST` | `/v1/users/me/instagram-approval/confirm-sent` | User tapped «پیام را فرستادم» — unlocks panel browse |
| `GET` | `/v1/admin/influencers?status=PENDING` | Admin queue (search by name / phone / handle / code) |
| `POST` | `/v1/admin/influencers/:id/approve` | Unlock sending offers + brand discovery |
| `POST` | `/v1/admin/influencers/:id/reject` | Optional `{ "reason" }` — user can follow/DM again |

`POST /v1/offers` returns `403` with `code: INFLUENCER_NOT_APPROVED` until approved. Existing influencers were backfilled as `APPROVED`.

## Campaigns

Require `Authorization: Bearer <accessToken>`. Brand owns CRUD; influencers browse `OPEN` campaigns.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/campaigns` | Create campaign (brand) |
| `GET` | `/v1/campaigns` | List my campaigns (brand) |
| `GET` | `/v1/campaigns/browse` | Browse `OPEN` campaigns (influencer) |
| `GET` | `/v1/campaigns/:id` | Brand owner, or influencer if `OPEN` |
| `PATCH` | `/v1/campaigns/:id` | Update campaign (brand) |

Campaign responses include a `brand` card (`id`, `name`, `photoUrl`, `website`, `bio`, categories, city, `goal`, `businessSize`) so the influencer can open the brand profile.

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

Phone is never exposed in these responses. Cards include `bio`.

## Marketplace flow (invitations → offers)

1. **Brand** creates an `OPEN` campaign, browses influencers, and sends an **invitation**.
2. **Influencer** sees invitations and may send an **offer** (fee / message / deadline) only if they have a non-cancelled invitation to that campaign.
3. While the offer is **pending**, the influencer can edit fee / message / deadline from the chat offer card. The **brand** accepts or rejects; the influencer may cancel.
4. On **accept**, a **deal** is created automatically (`IN_PROGRESS`) and the influencer is notified (`DEAL_STARTED`).
5. Influencer submits a deliverable; brand confirms, requests revision, or either party may cancel (before completion). The party who cancelled can re-enable the deal; the other party cannot.
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
| `POST` | `/v1/offers` | Send offer (influencer only; campaign `OPEN`) |
| `GET` | `/v1/offers` | Brand: received; influencer: sent. Optional `?campaignId=` |
| `GET` | `/v1/offers/:id` | Get one offer (party only) |
| `PATCH` | `/v1/offers/:id/terms` | Influencer: edit fee / message / deadline while `PENDING` |
| `PATCH` | `/v1/offers/:id` | Brand: `ACCEPTED` / `REJECTED`; influencer: `CANCELLED` |

```json
{
  "campaignId": "…",
  "fee": 8000000,
  "message": "آماده همکاری هستم",
  "deadline": "2026-08-20T00:00:00.000Z"
}
```

Edit pending terms (`PATCH /v1/offers/:id/terms`, influencer only):

```json
{
  "fee": 9000000,
  "message": "مهلت را تا جمعه تمدید کردم",
  "deadline": "2026-08-22T00:00:00.000Z"
}
```

Status: `PENDING` | `ACCEPTED` | `REJECTED` | `CANCELLED`. At most one pending offer per campaign+influencer pair (history of settled offers is allowed). Accepting an offer creates a linked deal.

While an offer is `PENDING`, the influencer can edit it from the chat offer card (`PATCH /v1/offers/:id/terms`). After the brand accepts or rejects (or the influencer cancels), `canEdit` is `false`. Conversation responses include an `offer` object (`fee`, `message`, `deadline`, `status`, `canEdit`) so the chat screen can render that card without a second fetch. Editing posts a system chat event `OFFER_UPDATED` and notifies the brand.

### Deals

Require `Authorization: Bearer <accessToken>`. Created automatically when a brand accepts an offer.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/deals` | Brand or influencer: my deals. Optional `?campaignId=` |
| `GET` | `/v1/deals/:id` | Get one deal (party only) |
| `POST` | `/v1/deals/:id/deliverable` | Influencer submits deliverable (multipart or JSON) |
| `PATCH` | `/v1/deals/:id` | Brand: `COMPLETED` / `REVISION_REQUESTED` / `CANCELLED`; influencer: `CANCELLED`; canceller: `IN_PROGRESS` to re-enable |

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

Re-enable (only the party who cancelled):

```json
{ "status": "IN_PROGRESS" }
```

- Brand `COMPLETED` — from `DELIVERED`
- Brand `REVISION_REQUESTED` — from `DELIVERED` (`brandFeedback` required)
- Brand or influencer `CANCELLED` — from `PENDING_PAYMENT`, `IN_PROGRESS`, or `REVISION_REQUESTED` (brand cannot cancel after content is published)
- The party who cancelled may send `IN_PROGRESS` to re-enable; the other party cannot. Response includes `cancelledById` and `canReactivate`.

Status: `PENDING_PAYMENT` | `IN_PROGRESS` | `DELIVERED` | `REVISION_REQUESTED` | `COMPLETED` | `CANCELLED`.

### Notifications

Require `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/notifications` | List my notifications (newest first) |
| `GET` | `/v1/notifications/unread-count` | `{ count }` |
| `PATCH` | `/v1/notifications/:id/read` | Mark one as read |
| `POST` | `/v1/notifications/read-all` | Mark all as read |

Types: `INVITATION_RECEIVED`, `OFFER_RECEIVED`, `OFFER_UPDATED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_CANCELLED`, `DEAL_STARTED`, `DELIVERABLE_SUBMITTED`, `REVISION_REQUESTED`, `DEAL_COMPLETED`, `DEAL_CANCELLED`, `DEAL_REACTIVATED`.

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
