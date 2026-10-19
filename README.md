# Ek App – Super Money App (demo)

UPI, bills, stocks, gold, loans ka ek-hi-jagah demo app. **Ye simulator hai**: koi real bank / NPCI / broker
integration nahi hai, paisa sirf app ke database me move hota hai.

## Stack
Next.js (App Router) · TypeScript · SQLite (`node:sqlite`) · scrypt · koi extra backend dependency nahi.

## Chalane ka tarika
```bash
# Node 22.13+ chahiye
npm install
npm run dev        # http://localhost:3000
npm test           # backend tests
```
Production me `.env.example` dekho (`EK_PEPPER` zaroori hai).

## Backend design
| Cheez | Kaise |
|---|---|
| Database | SQLite, WAL mode, foreign keys ON, `CHECK` constraints (balance kabhi negative nahi) |
| Money | Integer **paise** (float nahi). Gold integer **microgram** |
| Auth | Phone + password, server-side sessions (HttpOnly, SameSite=Lax cookie, DB me sirf token ka hash) |
| Secrets | Password aur UPI PIN scrypt + salt + server pepper se hashed |
| Brute-force | 5 galat password / PIN → 15 min lock. Attempt verify se *pehle* reserve hota hai (race-proof) |
| Payments | Atomic DB transaction: balance guard + ledger entry ek saath. Idempotency key se double-charge nahi |
| Authorization | Har query `user_id` se scoped, dusre user ka account/loan/SIP chhu nahi sakte |
| Prices | Server decide karta hai (stock, gold, EMI, insurance/FD/IPO prices). Client ka bheja price ignore. Tests check karte hain ki UI aur server ke prices match rahein |
| CSRF | Origin / Sec-Fetch-Site check + SameSite cookie + sirf `application/json` |

Code: `src/server/*` (logic) aur `src/app/api/*/route.ts` (patle HTTP wrappers).

## API
Sab responses `{ "success": true, ... }` ya `{ "success": false, "error": { "code", "message" } }`.
Amounts rupees me (number). Paise conversion server karta hai (max 2 decimals).

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `phone, name, password(8+), upiPin(4 ya 6 digit)` | Demo accounts + data milta hai |
| POST | `/api/auth/login` | `phone, password` | Cookie set |
| POST | `/api/auth/logout` | – | |
| GET | `/api/auth/me` | – | |
| GET | `/api/state` | – | Poora dashboard snapshot |
| POST | `/api/payments` | `amount, receiver, pin, [bankAccountId, vpa, note, category, method:"lite", idempotencyKey]` | `method:"lite"` me PIN nahi chahiye (max ₹500) |
| POST | `/api/upi-lite/topup` | `amount, pin, [bankAccountId, idempotencyKey]` | Wallet cap ₹2,000 |
| GET | `/api/transactions` | `?limit=20&before=<id>&category=&q=` | Cursor pagination, `nextCursor` |
| POST | `/api/trades` | `symbol, side:"buy"|"sell", qty, [idempotencyKey]` | Weighted average cost |
| GET | `/api/market` | – | Quotes (abhi static) |
| POST | `/api/gold/buy` | `amount(₹10+), [idempotencyKey]` | |
| POST | `/api/loans/emi` | `loanId, [idempotencyKey]` | EMI amount server se |
| POST | `/api/card/pay` | `[amount, bankAccountId, idempotencyKey]` | Default poora due, `amount` se partial |
| POST | `/api/transfers/self` | `fromAccountId, toAccountId, amount, [idempotencyKey]` | Do ledger entries (category "Self Transfer") |
| POST | `/api/offerings/buy` | `category (insurance/fd/ipo/nps), title, [idempotencyKey]` | Price server ke catalog se |
| POST | `/api/accounts/deposit` | `amount (max ₹50,000), [bankAccountId, idempotencyKey]` | **Sirf demo** ("add money" button), rate limited |
| POST | `/api/auth/change-pin` | `currentPin, newPin` | Purana PIN verify hota hai |
| PATCH | `/api/settings` | `budget` | |
| POST / DELETE | `/api/sips`, `/api/sips/:id` | `name, amount, dayOfMonth(1-28), [payFirstInstallment:true, idempotencyKey]` | `payFirstInstallment` me pehli installment usi transaction me katti hai |

Error codes jo frontend ko handle karne chahiye: `INVALID_PIN` (`remainingAttempts`), `LOCKED` (`Retry-After` header),
`INSUFFICIENT_FUNDS`, `UNAUTHORIZED`, `RATE_LIMITED`.

## Limits / aage ka kaam
- SQLite ek file hai: **serverless (Vercel) pe data persist nahi hoga**. VPS / Railway / Render (disk ke saath) pe chalao,
  ya `src/server/db.ts` ko Postgres ke saath badlo.
- Rate limiter in-memory hai (single server). Multi-server pe Redis chahiye.
- Market prices static hain (`src/server/market.ts`), real feed yahin plug hoga.
- Real money ke liye licensed PSP / bank partner, KYC, aur audit logging zaroori hoga.
- UI me abhi bhi local hain (server pe save nahi hote): **Autopay mandates**, **contacts / naye payee**, **notifications**, **Split bill**. Ye paisa move nahi karte.
- Database schema badalna ho to `src/server/db.ts` me naya migration add karo (purane ko mat chhedo). Purane DB apne aap upgrade ho jaate hain.


## UPI Hub upgrade (simulator)

Naye features (sab main app me, backend `/api/*`):

| Feature | Endpoint |
|---|---|
| Bank list (searchable, popular upar) | `GET /api/banks?q=` |
| Bank me accounts dhundhna / link | `POST /api/banks/discover`, `POST /api/accounts/link` |
| Unlink / primary / balance (PIN ke saath) | `DELETE /api/accounts/:id`, `POST /api/accounts/primary`, `POST /api/accounts/balance` |
| Collect request (maango / approve / decline / cancel) | `GET,POST /api/collect`, `POST /api/collect/:id` |
| Transaction status (success / pending / failed) + detail | `GET /api/transactions?status=`, `GET /api/transactions/:id` |
| Complaints + status tracking | `GET,POST /api/complaints` |
| Forgot UPI PIN | `POST /api/auth/reset-pin` |

**NPCI Common Library abhi nahi hai**, isliye sab kuch `src/server/upi/sdk.ts` ke `UpiSdkService` interface ke peeche hai.
`MockUpiSdkService` chalta hai. PSP sandbox milne par `RealUpiSdkService` bharo aur `EK_UPI_SDK=real` karo.
Real UPI me PIN kabhi server/app tak nahi aata (sirf NPCI CL ka secure UI), mock me wo server par verify hota hai.

**Bank list:** `src/server/banks.ts` me ek seed list (~90 banks) hai, NPCI ki poori list nahi. Poori list ke liye NPCI ki
"UPI Live Members" list se `data/upi-banks.json` banao: `[{"id":"hdfc-bank","name":"HDFC Bank","category":"private","popular":true}]`.

**Simulate outcomes (sirf `EK_DEMO_MODE`):** `POST /api/payments` me `"simulate": "pending" | "deferred_failed" | "failed" | "bank_down"`.

**Secrets:** API keys sirf env se (`.env.example` dekho). Pehle teen routes me keys hardcoded thi: purani keys rotate karo.
