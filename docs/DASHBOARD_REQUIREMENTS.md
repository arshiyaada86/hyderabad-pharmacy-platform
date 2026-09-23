# Customer app and dashboard requirements

Baseline: 22 September 2026. This document captures the implemented customer experience and the dashboard/backend needed to supply it. Later instructions supersede earlier requests; the behavior below is the accepted baseline.

## Scope and current state

The Expo customer app, Material UI dashboard, shared API and domain package are implemented in apps/mobile, apps/admin, apps/api and packages/domain. API mode uses SQLite-backed shared data; offline mock mode remains available for testing APKs. Dashboard branding is seeded as Old City Pharmacy. See [setup and coverage](PLATFORM_SETUP.md).

The supplied workspace uses sample prices, MRPs, stock, customers and orders. Hosting, real SMS, payments and courier integration are not provisioned. The inventory below preserves the customer baseline and acceptance requirements.

Goal: the dashboard manages business data in a shared backend. The customer app reads that backend through authenticated services; it must not connect directly to the admin interface or require an APK release for routine content, inventory, price or order-status changes. Customers remain the source of their account details, carts, orders, chosen contributions and uploaded photos; the dashboard receives and manages those records with appropriate access controls.

## Feature-to-dashboard map

| Customer feature implemented | Dashboard responsibility and backend data |
| --- | --- |
| Home name and `locality - landmark`, without greeting or appended city | Customer profile and serviceable-locality records; trim empty values and omit stray separators |
| Charminar artwork, banner, search, featured products, category tiles, doctor/request entry points | Published home content, image assets, allowed navigation targets, featured-product selection and sort order; featured products are selected and ordered in the dashboard |
| Product search and category/subcategory filters | Published catalog search, taxonomy and availability; category filters only, no brand or prescription filter tabs |
| Product cards/details, pack photographs, prescription label | Full product records, verified prescription flag, asset/source provenance; only show Prescription Required when true |
| MRP, selling price and automatic discount | Explicit MRP and selling price, price-change history and validation; public responses never include purchase cost, supplier cost or margin |
| Shared cart badge, product quantity controls and highlighted View Cart | Customer-owned cart lines, current product prices and server-side quantity/availability validation |
| Checkout and fixed delivery contribution | Order creation, delivery snapshot, optional prescription, selected contribution and validated totals |
| Current/past orders, details, progress and Order Again | Order inbox, status timeline, ETA, immutable item/address/price snapshots and reorder availability review |
| Photo-only medicine requests and request history | Request inbox, private photo access, customer association, received date and follow-up workflow |
| Doctor search, searchable specialty/locality filters, multi-clinic profile | Doctor/clinic directory, reference data, published schedules, source links and Get Directions URLs |
| Account information and profile menu | Customer records plus published help, terms, privacy and about content |
| Green success feedback, quantity vibrations, keyboard/safe-area behavior | App interaction rules remain in the app; dashboard content must fit the existing UI and must not inject arbitrary code or navigation |

## Required dashboard modules

### Products, categories and stock

- Manage stable product IDs, brand name, generic name, manufacturer and manufacturer group, composition, strength, dosage form, package size, pack image, broad category/subcategory, MRP, selling price, prescription requirement, active/publication status and source URL/verification date.
- Current catalog contains 18 products from Dr. Reddy's, Abbott and Cipla, including prescription and non-prescription tablets, capsules, liquids, drops, inhalers, ointments, lozenges and nutritional powder. Preserve the three-manufacturer scope unless the owner changes it.
- Keep five broad categories: Medicines; Skin & Personal Care; Baby Care; Vitamins & Wellness; Women & Family Care. Each has its own relevant icon. Maintain subcategories inside these groups using `apps/mobile/src/data/shopCategories.ts` as the initial taxonomy. Empty groups have an honest empty state and medicine-request action. Baby medicines retain their actual prescription rules.
- Provide draft/published/archived management, search and filters, image preview and validation. Never reuse a product ID for a different product or pack. Archive instead of deleting records referenced by orders.
- Add stock quantity/availability and an inventory adjustment ledger with reason, actor and timestamp. Live inventory does not exist today. Decide reservation/release timing before implementing checkout, cancellation and fulfillment; make updates atomic so concurrent orders cannot oversell.
- Keep image rights/provenance and source verification metadata. Use actual pack photographs, an accessible image description and a fallback for missing images.

### Pricing rules

- Store money as integer paise in the production database/API; map deliberately to the app's current rupee-valued `price` and `mrp` fields during migration. Do not silently change units.
- Require finite, non-negative selling price and positive MRP for published products. Reject selling price above MRP in dashboard writes. Equal prices are allowed and show only the selling price.
- When selling price is lower than MRP, show struck-through MRP, prominent selling price and `((MRP - selling price) / MRP) × 100` OFF. Current display rounds the percentage to two decimal places. Use Indian digit grouping and ₹ consistently.
- Apply this to Home featured products, search/listing, product details, cart/checkout, order details and past-order cards. Order-line displays multiply both amounts by quantity; percentage remains unchanged.
- Snapshot MRP and selling price at purchase time. Later price edits must not rewrite historical orders. Legacy orders without MRP show their saved selling price without inventing an old discount.
- Order Again uses current selling prices/MRPs, explains selling-price changes and lists unavailable items. It does not place the order automatically.
- Current approved sample MRPs are 20% above existing sample selling prices, which calculates to approximately 16.67% OFF. Replace these with verified business values before live use; do not mistake this test-data rule for a production pricing policy.
- Purchase prices, supplier costs and margins, if introduced for internal operations, require separate privileged fields/endpoints and must never appear in customer payloads, logs exposed to customers, or screens. No GST/tax wording beside individual products. Any future business tax/invoicing work needs separate requirements.

### Orders, fulfillment and delivery contribution

- Provide a searchable order inbox with customer, six-character uppercase alphanumeric public Order ID, date/time, current status, item summary, total, contribution, locality and prescription indicator. Use a separate internal primary key and enforce public-ID uniqueness atomically. Always display `Order ID: [ID]` in customer screens.
- Order details include immutable item/pack/price snapshots, quantities, medicine subtotal, delivery contribution, grand total, name/phone and address snapshot, prescription attachment/review, ETA and timestamped status history. Phone must be captured server-side at checkout: the current prototype delivery snapshot only stores name/address/locality/landmark.
- Customer total = sum of selling price × pack quantity + one selected delivery contribution. There is no online payment in the current app. Order submission is a request for the pharmacy to confirm medicine availability.
- Customer must explicitly select **₹0, ₹10 or ₹20**, with no preselected value, under Estimated Total. This is a voluntary amount for the delivery person; choosing zero is valid, but making a choice is mandatory. It is a flat amount per order, never per product or quantity. No additional delivery fee is authorized by this requirement.
- Store the contribution separately and include it once in the saved total and order details. Dashboard cannot silently increase it. Future changes to contribution choices require explicit product approval; the initial configuration must remain exactly 0/10/20.
- Checkout remains blocked until contribution is selected and any required prescription is supplied. Validate both on the server, not only with a disabled button. Clear the cart only after successful atomic order creation. Use idempotency keys to prevent duplicate orders on retries/double taps.
- Use customer statuses: Order Received → Confirmed → Preparing → Out for Delivery → Delivered, with Cancelled as a separate final outcome. **Confirmation Pending must not be restored.** Define permitted transitions, cancellation reasons and stock effects; prohibit arbitrary/backward status changes except an audited correction workflow.
- Pharmacy staff confirm availability, review prescriptions and manage progress/ETA. Internal staff notes and rejection reasons need access control and a deliberate customer-visible message field, not automatic exposure.
- Preserve `Order Placed`, animated green check and the current success copy: “Order received successfully. Our pharmacy team will call you shortly to confirm medicine availability.” Successful placement vibrates. The top-left action after successful placement is Home and resets navigation to the Home tab; ordinary historical order views keep their normal back navigation.
- Past Orders currently contains Delivered and Cancelled orders. Each card shows ID, date, total, item/quantity summary and prices; Order Again restores available quantities using current prices, keeps unrelated cart lines, flags unavailable products and requires a fresh contribution choice and prescription check.
- If availability/price changes after cart review, return a revised quote and require review rather than silently placing at a higher total. Recommended new backend quote/version check must be implemented during API integration.

### Prescriptions and medicine photo requests

- Prescription required status belongs to the product, regardless of broad category. No “No Prescription Required” label. Any prescription item blocks checkout without an accepted image.
- Current app supports camera, gallery and image-file selection, preview, replacement and removal; accepted photos are normalized to JPEG and limited to 10 MB. Backend must validate actual file contents/type/size and ownership; client metadata alone is insufficient.
- Medicine request form takes exactly one photo; it has no medicine-name, quantity or notes inputs. Keep its success copy: “Request received. We'll contact you soon.” Successful Send request vibrates once and shows its success state. Failed submissions do not trigger success feedback.
- Request records need ID, customer, photo asset, received date and status. The implemented public request status is Received. Proposed dashboard-only follow-up state, assigned staff, contact attempts and notes can be added without exposing unsupported customer statuses. Additional customer-visible states need an agreed app/API change.
- Keep prescriptions/request photos private in backend object storage, accessed through short-lived authorized URLs. Define retention, deletion and audit rules before live launch. Do not publish these files as catalog assets. Draft replacement/removal and unsuccessful submissions need orphan cleanup; submitted files must stay attached to their record for the agreed retention period.

### Doctors and clinics

- Initial directory has nine sourced Yashoda Hospitals doctors. Manage name, qualifications, specialty, optional validated contact, source URL/check date, publication state and one or more clinic associations. Use verified information, not fabricated reviews, ratings or fictional profiles.
- Each clinic needs stable ID, name, full address, locality, consultation timings, source URL and Google Maps directions destination/URL. Maintain each clinic separately and show each one in the profile. Doctor-level legacy clinic/address/timings fields should map to a primary clinic during migration.
- Customer filters/search combine doctor name, specialty, clinic and locality; specialty and locality dropdowns are searchable. Delivery localities and doctor clinic localities are separate datasets.
- Only **Get Directions** appears for each clinic; no map preview/location panel or View on Google Maps action. Retain View hospital profile and show Call only when a valid contact exists. Initials are the current avatar fallback. No appointment booking or live appointment slots are implemented.

### Customers, locality and content

- Customer record: stable ID, verified phone, name, address, delivery locality and landmark. Existing profile validation: name up to 80 characters, address up to 200, landmark up to 120; fields are trimmed and required, locality must be selectable. Preserve historical delivery addresses when profiles change.
- Current phone flow is a demo OTP with a five-minute expiry and five verification attempts; fixed code 123456 must never authenticate production customers. Implement real OTP provider integration, resend throttling, abuse controls, session expiry/revocation and server-side ownership. Phone is read-only in the existing account form; verified phone change is a separate future workflow.
- Maintain serviceable delivery localities with stable IDs/display names and active status. Retire values without breaking existing profiles/orders. Account/registration locality uses searchable selection. Clarify handling for customers whose saved locality is no longer serviceable.
- Customer dashboard view shows authorized account data, order history and request history. Restrict staff editing, record a reason and audit changes. Do not expose OTPs, session credentials or unrestricted medical media.
- Content management: app/shop name, logo and Charminar/banner assets, banner text and approved CTA targets, featured products/order, category icons/order within the five-category structure, Help & support sections, Terms & conditions, Privacy information, About, business contact details and the approved success messages. Support drafts, preview and publish/version history. Do not allow arbitrary HTML/scripts/URLs in native content.
- Current profile menu: Account information, My orders, Medicine requests, Help & support, Terms & conditions, Privacy information, About and Logout. Child screens have back navigation, including My orders. Production policy/support content must replace prototype statements only when the corresponding service really exists.
- Removed content must stay removed: Home typing greetings, the manufacturer subtitle under Your daily care, and the arrow beside each featured product image. The lower product-card action remains. Home locality displays data only, with no appended Hyderabad.

## Data ownership and proposed service boundary

Recommended entities: Customer, Session/OTPChallenge, DeliveryLocality, Category/Subcategory, Manufacturer, Product, ProductAsset, InventoryAdjustment, Cart/CartLine, CheckoutQuote, Order/OrderItem, OrderStatusEvent, PrescriptionAsset/Review, MedicineRequest/RequestEvent, Doctor, Clinic/DoctorClinic, Specialty, PublishedContent, StaffUser/Role and AuditEvent. Use stable internal IDs and UTC timestamps. Keep public order numbers separate from request IDs.

The existing interfaces in `apps/mobile/src/services/types.ts` are the migration starting point. Current contracts include medicine list/get; doctor list/get; current user, OTP, register, update and logout; cart list/add/setQuantity; order list/get/place/again; request list/submit; media pick/validate/remove; reference categories/specialties/localities. `order.place` currently takes the selected contribution and optional prescription. Keep media picking local but add secure upload and server asset validation.

Original API grouping requirements (implemented route names are documented in PLATFORM_SETUP.md):

| Group | Customer API | Authorized dashboard API |
| --- | --- | --- |
| Auth/profile | OTP, sessions, own profile | Staff authentication, roles, restricted customer lookup |
| Catalog/reference | Published products, search/filter, categories, localities, current prices | Draft/publish/archive, stock adjustments, price history, reference maintenance |
| Home/content | Published home configuration and information pages | Edit, preview, publish, audit |
| Doctors | Published doctors/clinics and filters | Directory/clinic/schedule management |
| Cart/checkout | Own cart, quote/review, idempotent order creation | Order lookup, permitted status transitions, prescription review, ETA |
| Orders/reorder | Own history/details, current-price reorder review | Operational filters, assignment/notes and audited fulfillment |
| Media/requests | Authorized upload, own request list/submit | Private attachment access and request follow-up |

- Add pagination, stable sorting, combined search/filter parameters and consistent validation/error responses. Never trust customer-supplied totals, prescription flags, ownership, prices or status values.
- Dashboard changes should invalidate/update cached public data. Refresh current prices/availability at checkout. Refresh/poll customer order/request status on screen focus; real-time subscriptions are an optional implementation choice.
- Published application data must come from the API, including data currently imported directly: Home/category definitions in `shopCategories.ts`, bundled catalog/images, doctor source text, `Profile.tsx` information content and branding/featured selection. Reference services must expand to expose full taxonomy/icons rather than only category names.
- Keep offline/loading/error/empty states and safe retries. Cached browsing must not pretend an offline order was accepted. Build a separate demo mode for testing; do not upload all existing local demo accounts/orders into a live database.

## Interaction baseline to preserve

- Cart badge shows summed quantity; Add to Cart becomes synchronized quantity controls. Decreasing to zero restores Add to Cart. Product quantity updates affect only that product; no flashing cards or Place Order button. View Cart remains accented while the cart is nonempty.
- Current per-product quantity limit is 20 packs, using whole numbers only; zero removes a cart line and submitted order lines must be positive. Preserve this limit in the backend and combine it with available-stock validation.
- Vibration on adding items, quantity changes/removal, successful order placement, successful medicine requests and successful Order Again additions, where supported. No added-to-cart, login or logout success popups. Other applicable successful actions retain green animated messages; small notices auto-dismiss.
- Prescription badge and View details stay consistently positioned, with View details right-aligned. No unrelated generic category icons or brand/type filter tabs.
- Preserve existing teal/green palette, compact header, native safe areas, centered quantity controls, horizontal chip scrolling, screen padding, visible keyboard-focused fields/results/buttons and accessible touch targets. Dashboard data must not introduce clipping, unsafe links or broken image layouts.

## Delivery plan and acceptance checks

1. Build backend schema, staff authentication/permissions and audited admin operations. Suggested roles are owner/admin, catalog manager, pharmacist/order operator and support; finalize exact access before implementation.
2. Build catalog/reference/content/doctor dashboard modules and seed reviewed records from the prototype, with verified real prices and assets for live deployment.
3. Implement real customer authentication, private uploads, cart/checkout, orders, prescriptions and request operations. Add idempotency, concurrency/stock tests and customer isolation tests.
4. Implement an API-backed `Services` adapter and migrate all published/reference content sources. Keep mock mode separate. Validate the existing app flows without redesigning screens.
5. Verify dashboard changes to product price/image/stock, featured order, clinic timings and published help appear in the app without an APK rebuild. Verify status changes reach the correct customer only.
6. Verify MRP discounts, totals and currency; fixed 0/10/20 choice; missing-choice rejection; independent quantity changes; prescription enforcement including baby medicines; price/stock changes during checkout; duplicate/retried submission protection; historical snapshot preservation; repeat-order unavailable/current-price behavior.
7. Verify request image submission/review, profile updates, searchable reference data, multiple clinics/Get Directions, post-order Home navigation, back navigation from My orders, and Android/iPhone keyboard/safe-area layouts. Physical-device vibration testing remains necessary.
8. Before live launch agree on actual pharmacy operating procedures, stock reservation, cancellation/refund/payment policies, delivery operations, verified business contacts, medical-image retention/access, backups/recovery and final legal/privacy content. These are open requirements, not existing production capabilities.

GitHub Actions workflow `.github/workflows/android-apk.yml` already tests and builds a standalone Android testing APK on relevant pushes to main, with a manual Run workflow option. It increments Android versionCode and uploads a testing artifact. This does not deploy an API/dashboard and does not provide production Play Store signing. Keep future backend/admin deployment credentials out of mobile builds and the repository.

## Source-of-truth implementation references

- Models/contracts: `apps/mobile/src/services/types.ts`; validation/state mutations: `services/mock.ts`; status/messages: `services/rules.ts`.
- Catalog/taxonomy/directory: `src/data/indianMedicines.ts`, `shopCategories.ts`, `hyderabadDoctors.ts`, `catalog.ts`; image provenance: `assets/products/product-sources.json`.
- Customer screens: `src/screens/`; shared pricing: `src/components/ProductPrice.tsx`; feedback: `Success.tsx`; media: `services/media.ts`; navigation: `src/navigation/AppNavigation.tsx`.
- Regression suites: `apps/mobile/tests/` cover services, navigation, components, reorder, media, pricing and delivery contribution. Preserve them when replacing mocks; add API/database integration tests for new server behavior.
