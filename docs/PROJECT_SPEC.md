# The Lucky Maple — Product & Technical Specification

Status: Prototype / pre-launch  
Owner: Maple Vibe Inc.  
Primary market at launch: Canada  

## 1. Product premise

The Lucky Maple is one enormous public digital maple tree. A visitor can plant a permanent leaf for **$1 CAD** and attach a display name plus a short public message.

For every paid leaf, **50¢ is allocated to a direct-help fund for neurodivergent Canadians**. The allocation is recorded in an append-only public-impact ledger.

A separate weekly promotional giveaway provides a recurring reason to visit and share the site. The giveaway is **not funded from purchase consideration**, has a genuine no-purchase-necessary entry route, and must operate under final reviewed Official Rules before public launch.

The product should feel less like a charity portal and more like a simple internet event: plant a leaf, watch the tree grow, see visible impact, and come back for the weekly Leaf Drop.

## 2. Non-negotiable product rules

1. The tree is the primary experience; no account is required to browse or buy.
2. A $1 purchase buys a real permanent digital leaf.
3. Exactly 50¢ per paid leaf is allocated to the direct-help fund.
4. Weekly giveaway funding is accounted for separately from leaf-sale allocations.
5. Buying leaves must not improve weekly giveaway odds.
6. A free entrant and a purchaser get the same maximum number of entries per weekly draw.
7. Marketing consent is optional and separate from contest entry.
8. Direct assistance is needs-based, not random, and is not a contest prize.
9. Help is never conditional on agreeing to publicity or filming.
10. Recipient stories are private by default and public only with explicit recorded consent.

## 3. MVP visitor flows

### Browse the tree
- Landing page opens directly on the tree.
- Visitor can pan/zoom and select leaves.
- Claimed leaves show number, display name, message, and planted date.
- Unclaimed leaves open the plant flow.

### Plant leaves
- Choose quantity; price remains $1 per leaf.
- Enter display name/message for each leaf or reuse values.
- Checkout collects email for receipt and ownership recovery.
- Payment confirmation creates the order, leaves, and help-fund allocation in one idempotent transaction.
- No traditional password/account is required.

### Enter weekly giveaway
- Prominent `Enter Free` route remains available without checkout.
- Collect minimum eligibility information, email verification, age/rules confirmation, and optional marketing opt-in.
- Enforce one eligible identity per weekly draw regardless of free/purchase route.

### Apply for direct help
- Separate intake page; launch disabled until privacy notice and selection policy are final.
- Collect only information necessary to evaluate the request.
- Public storytelling consent is optional and revocable according to the final privacy policy.

### View impact
- Public counters: leaves planted, help allocated, help delivered, current fund balance.
- `Where the Leaves Went` shows only consented stories or intentionally anonymized summaries.

## 4. System architecture

### Runtime
- Dedicated Proxmox LXC on PVE02.
- Docker Compose inside the LXC.
- `web`: Node.js 22 + Express serving the interactive frontend and JSON API.
- `db`: PostgreSQL 16, private to the Compose network.
- External TLS/reverse proxy or Cloudflare Tunnel added only after LAN acceptance.

### Persistence
PostgreSQL is required. This is not a static-site-only product because the system must maintain authoritative records for ownership, payments, contest eligibility, direct-help allocations, consent, disbursements and audit history.

Money is stored as integer cents. Floating point values are never used for accounting.

### Primary data domains
- `leaf_orders`: purchase/payment state.
- `leaves`: permanent public leaf records.
- `contest_weeks`: isolated weekly promotional periods and prize funding source.
- `contest_entries`: free/purchase entry records with one identity per week.
- `assistance_cases`: private direct-help applications.
- `assistance_disbursements`: approved assistance actually delivered.
- `help_fund_ledger`: append-only accounting for 50¢ allocations and disbursements.
- `audit_log`: administrative/system actions.

The giveaway has no dependency on the help-fund ledger. Direct-help selection has no dependency on contest entry.

## 5. Money and accounting rules

For a normal paid order containing `N` leaves:

- customer charge: `N × 100¢`
- direct-help allocation: `N × 50¢`
- gross operating share before payment fees/tax/expenses: `N × 50¢`

On confirmed payment, the application transaction must:
1. mark/create the paid order using an idempotent payment reference;
2. create the purchased leaves;
3. append one `leaf_allocation` ledger record for `N × 50¢`;
4. append the relevant audit record;
5. commit all operations together.

A direct-help disbursement appends a negative ledger entry referencing the disbursement record. Existing ledger entries cannot be updated or deleted; errors are fixed with an explicit correction entry.

Sponsors may separately fund giveaway prizes and may optionally top up the direct-help fund. Sponsor top-ups must be labelled distinctly from customer leaf allocations.

## 6. Initial API surface

- `GET /api/health` — service/database health.
- `GET /api/stats` — public tree and direct-help counters.
- `GET /api/leaves` — public planted-leaf data.
- `GET /api/impact` — consented public assistance stories.
- `GET /api/contest/current` — current weekly promotion metadata.
- `POST /api/contest/entries` — no-purchase entry endpoint.
- `POST /api/help/applications` — direct-help intake; disabled until launch policy is ready.
- `POST /api/dev/mock-purchase` — development only; proves purchase/allocation behavior.

## 7. Privacy, consent and safety

The assistance workflow can contain sensitive financial/disability-related information. It is private by default and should collect the minimum information required for assessment.

Required controls before public assistance intake:
- published privacy notice and retention schedule;
- role-restricted admin access;
- encrypted backups and TLS in transit;
- explicit media/story consent record separate from eligibility for help;
- recipient may receive help without appearing in content;
- public API never returns applicant name/email/private application text;
- documented process for access/correction/deletion requests where legally applicable.

Contest marketing opt-in is separate from contest eligibility. Transactional contest emails and marketing campaigns must remain operationally distinguishable.

## 8. Giveaway guardrails

The repository contains prototype rules only. Public launch requires final Canadian contest rules and review of the selected payment provider's acceptable-use terms.

The product must visibly state `No purchase necessary` near giveaway calls to action. Prize count/value, eligibility, dates, odds-affecting facts, selection procedure and skill-testing requirement belong in the final rules/disclosures.

Prize funding is recorded as founder/company/sponsor funding and must not be represented as a pooled percentage of entrant payments.

## 9. Ownership and authentication

Traditional user accounts are not required for MVP. Production leaf ownership uses a high-entropy capability token stored only as a hash server-side, an HttpOnly ownership cookie, and a transactional recovery link sent to the purchaser email.

Admin authentication is a separate future surface and must never reuse public ownership tokens.

## 10. Infrastructure and deployment

Prototype target:
- Proxmox node: `DASPVE02`
- dedicated unprivileged LXC
- 2 vCPU, 4 GB RAM, 1 GB swap, 32 GB root disk on `data` storage
- static LAN address, firewall enabled
- Docker Compose service root under `/opt/luckymaple`
- database volume local to the LXC and included in Proxmox backup policy

Do not install application runtimes/databases directly on the Proxmox host.

Production exposure sequence:
1. LAN-only acceptance.
2. Database backup/restore test.
3. Final privacy policy, help-selection policy and contest rules.
4. Payment-provider approval/integration and webhook idempotency tests.
5. Transactional email + verification.
6. Rate-limit/bot protection and admin authentication.
7. Cloudflare Tunnel or equivalent TLS ingress.
8. Monitoring, alerting and scheduled backups.
9. Public launch.

## 11. Prototype acceptance criteria

The prototype is accepted when:
- stack starts from a clean `docker compose up -d --build`;
- `/api/health` reports both app and PostgreSQL healthy;
- a development mock purchase of one $1 leaf creates one leaf and exactly 50¢ of help allocation;
- repeated ledger update/delete attempts fail at the database layer;
- public stats reconcile to the ledger;
- duplicate weekly free entry does not create a second record;
- help applications remain closed by default;
- no database port is exposed on the LAN;
- all code/spec/schema changes are committed and pushed to GitHub.
