# Platform setup and operations

## Local services

Use Node 24+. Install at repository root with `npm install` (`npm ci` in automation). `npm run dev` starts API and dashboard; separate commands are `npm run dev:api` and `npm run dev:admin`. Dashboard: http://localhost:5173. API health: http://127.0.0.1:4000/api/health.

First startup generates administrator credentials in `apps/api/data/local-access.json`. Sign in using its email/password, then manage accounts through Team & access. The file also contains a private media signing secret: do not share or commit it. Editing a staff record revokes its sessions, including your own when editing yourself. At least one active administrator must remain.

SQLite records and uploaded images persist in `apps/api/data/pharmacy.sqlite`. Seeds only populate an empty workspace; restarting does not overwrite edits. Local mock and API data are separate, with no automatic personal-data migration.

Copy `apps/api/.env.example` to `apps/api/.env` to configure host, port, browser origins or DATA_DIR. Vite proxies `/api` and `/assets` to port 4000. `npm run build:admin` creates `apps/admin/dist`. For hosting, serve that directory over HTTPS with a reverse proxy for `/api` and `/assets`. Start the API with `npm start -w @pharmacy/api`, a persistent disk and a process supervisor.

## Expo Go on a phone

Use the same trusted Wi-Fi for phone and computer. Find the computer's Wi-Fi IPv4 address with `ipconfig`. Set HOST=0.0.0.0 in the API .env and restart it; allow the API port on the private-network firewall if Windows prompts.

In another PowerShell terminal at repository root, replace the example IP:

```powershell
$env:EXPO_PUBLIC_DATA_MODE='api'
$env:EXPO_PUBLIC_API_URL='http://192.168.1.100:4000'
npm run start -w apps/mobile -- --lan
```

Scan the QR with a compatible Expo Go version. The phone's API URL must use the computer LAN address, never localhost. Keep the API and Metro running. Restart Metro with `--clear` after changing environment variables. A Metro tunnel does not tunnel the API.

Browser preview: API URL `http://127.0.0.1:4000`, then `npm run web -w apps/mobile -- --port 8089`. Add other browser origins explicitly to CORS_ORIGINS. To return to offline mode, set EXPO_PUBLIC_DATA_MODE=mock, remove EXPO_PUBLIC_API_URL and restart Metro.

## Builds

Build testing APK stays in mock mode by default and runs after mobile/shared-domain/build-script changes on main. Verify platform checks all workspaces and uploads the compiled dashboard. Neither workflow deploys a server.

For a connected APK, deploy a stable HTTPS API and configure EXPO_PUBLIC_DATA_MODE=api and EXPO_PUBLIC_API_URL=https://your-api-host in the Android build environment or EAS environment. These public settings must never contain secrets. The URL is bundled at build time; changing it requires a new APK. A localhost/LAN build depends on that computer remaining reachable.

## Coverage

| Module | Managed data and behavior |
| --- | --- |
| Products | Name, generic, composition, strength, dosage, pack, manufacturer, subcategory, MRP, sale price, Rx, photo, image provenance, source/date, publication |
| Inventory | Quantity adjustments/reasons, live stock, low-stock overview, reservation/cancellation ledger |
| Categories | Five approved groups, related icons, subcategories, ordering |
| Manufacturers | Three approved groups, legal names, websites, publication |
| Orders | Six-character ID, immutable item/address/phone snapshots, total/contribution, status, ETA, timeline and internal notes |
| Prescriptions | Rx queue, private photo viewer, Pending/Approved/Rejected review; approval before confirmation |
| Medicine requests | Customer photo/date, assignment, notes and New/Contacted/Sourcing/Closed internal follow-up |
| Customers | Name, phone, address, locality, landmark, activation and history |
| Localities | Serviceable delivery areas used by account forms and checkout validation |
| Doctors | Name, qualifications, specialty, contact, portrait, sources and multiple clinics |
| Clinics | Name, address, locality, timings, sources and Get Directions link |
| Specialties | Searchable specialty names and activation |
| Home & branding | Name, tagline, logo, banner, headline/button/destination, ordered featured products, support contacts and success messages |
| Information | Help, terms, privacy, about with titled content sections |
| Team | Individual staff passwords, activation and four roles |
| Audit | Actor/time/entity/reason, before/after data without password material; private-photo access logs |

Orders/requests originate from customers, not generic staff editors. Reorder uses current available products and prices, preserves unrelated cart lines and requires a fresh contribution choice. Layout, navigation, haptics and the fixed 0/10/20 rule remain application behavior rather than remotely editable code.

## Dashboard navigation

Click a table row (or focus it and press Enter/Space) to open its centered details dialog. Double-click an editable field (or focus it and press Enter/F2) to edit in place. Save applies pending changes; Cancel discards them. Success toasts appear at the top right. Tables have no separate Actions/View column. Customer dialogs automatically load account details, order history and medicine requests.

Products is one filterable list: manufacturer, category/subcategory, stock availability and publication status combine with search. Each product opens one dialog: manufacturer information, medicine details with photo, current inventory, supplier stock receipt entry, supplier purchase/receipt history, then inventory history. Product and related manufacturer/category edits and inventory updates save in a single transaction. Supplier receipts include supplier, received date, quantity and optional invoice reference; saving adds the received quantity to inventory. Historical records are read-only. Record a receipt or a balance correction per save; Cancel does not create either. Existing generic stock adjustments are not reclassified as supplier purchases. Doctors contains Doctors, Clinics and Specialties. Search fields have a right-side clear control when populated; searchable form selections also expose their clear control.

## Contract and permissions

Routes below have `/api` prefix. Staff/customer bearer sessions are separate, hashed in SQLite and expire after eight hours. Dashboard sessions use sessionStorage; native customer sessions use SecureStore. Server authorization applies independently of UI visibility.

- Public: GET /config, /products, /products/:id, /doctors, /doctors/:id, /health.
- Customer auth: POST /auth/otp, /auth/verify, /auth/register; GET/PUT /me; POST /logout.
- Customer data: GET /cart, PUT /cart/:productId, GET /checkout/quote, GET/POST /orders, GET /orders/:id, POST /orders/:id/again, GET/POST /requests.
- Images: POST /media multipart; DELETE /media/:id for owned unsubmitted drafts. Staff catalog uploads use ?public=true. Private GET URLs expire after five minutes.
- Staff auth/summary: POST /admin/login; GET /admin/me, /admin/overview, /admin/reference.
- Data editors: GET/POST /admin/:collection, PUT /admin/:collection/:id. Strict allowed schemas are in packages/domain/src/admin.ts.
- Operations: PUT /admin/products/:id/details (atomic product/related-record/receipt save), GET /admin/products/:id/purchases (staff-only supplier receipts), POST /admin/products/:id/stock; PATCH /admin/orders/:id and /admin/requests/:id; GET /admin/customers/:id/history and /admin/media/:id.

Admin lists support search/status/page/limit. Writes require reasons and current versions; stale saves return 409. Drafts preserve the last published snapshot; archive withdraws publication. Stock updates operate separately.

Admin prices and totalPaise use integer paise. Customer models retain rupee values for compatibility, including immutable historical item snapshots. Quantity is integer 0–20. Quotes fingerprint products, quantities, prices and Rx requirements. Price changes require cart review. Submission transactionally reserves stock, saves the order and clears the cart, with per-customer idempotency keys preventing duplicate orders. Cancellation releases reserved stock once. Delivered orders cannot reopen. There is no Confirmation Pending state.

Admin has all modules. Catalog manages catalog/inventory/directory/home. Pharmacist handles prescriptions, orders and requests. Support manages customers/localities/requests and reads orders; it cannot approve prescriptions or change fulfillment. Image uploads are decoded/re-encoded and limited to JPEG/PNG/WebP, 10 MB and 40 million pixels.

## Live operation prerequisites

Demo mode uses the public fixed OTP. Live mode requires ADMIN_PASSWORD, MEDIA_SECRET, HTTPS OTP_URL and OTP_TOKEN, plus a separate DATA_DIR. The SMS gateway accepts POST JSON `{phone, code}` with bearer authorization and returns non-2xx on failed delivery. No SMS vendor is provisioned. Demo/live directories cannot be interchanged.

Before live use, configure and verify SMS, HTTPS hosting, production signing, access control, monitoring, backups/restore and pharmacy-approved catalog/policies. Live seeds contain no demo customers/orders and zero stock, but prices/MRPs still require verification. Payments, courier services and appointment booking are not implemented. Multi-instance operation needs shared OTP/rate-limit storage and an appropriate database strategy; current challenge/rate limits are in-process.

Use SQLite online backup facilities, or stop the server cleanly before copying the database and WAL files together. Protect backups and media secrets and test restoration. Automated retention/deletion and disaster-recovery services are not configured. Prototype policy text is not final pharmacy policy.

Detail dialogs use a shared visual style, customer summaries and order item tables. Product inventory shows a compact balance, an expandable supplier receipt form, and separate history tabs. Secondary image/source metadata is collapsed by default. Double-click editing and the shared Save/Cancel actions remain available.

Medicine Inventory now uses batch receipts and Master Data. See [Medicine Inventory](MEDICINE_INVENTORY.md) for stock migration, pricing and role behavior. This replaces the previous direct stock balance and unbatched receipt controls.
