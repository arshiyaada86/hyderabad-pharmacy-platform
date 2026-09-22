# Hyderabad Pharmacy — customer Android prototype

React Native + TypeScript, built with Expo SDK 57. Uses the existing repository **arshiyaada86/hyderabad-pharmacy-platform**. Only `apps/mobile` is implemented. There is no admin dashboard, backend, PostgreSQL, real OTP, payment integration, appointment booking, or cloud image storage.

## Run

Prerequisites: Node.js 22.13+ (Node 24 recommended), npm, and either an Android phone with the matching Expo Go version or Android Studio with an emulator.

From the repository root:

```sh
npm ci
npm start
```

Scan the terminal QR code using Expo Go on Android. Both devices must be able to reach the development server. For a running Android emulator:

```sh
npm run android
```

Configuration defaults to mock mode. Optionally copy `.env.example` to `apps/mobile/.env` and restart Expo after changes:

```dotenv
DATA_MODE=mock
```

Use **Try a demo account**, or enter `9000000001`, `9000000002`, or `9000000003`. The mock OTP is **123456**. A new valid Indian mobile number goes through registration. Nothing is sent by SMS. Use fictional personal details and images only.

For a browser layout preview (native camera/file storage requires Android):

```sh
npm run web -w apps/mobile
```

## Implemented

- Phone login, mock OTP with expiry/attempt limit, returning-user login, registration and editable profile; session persists across app restarts.
- Five bottom tabs: **Home, Medicines, Orders, Doctors, Profile**.
- Home: delivery location, medicine search, categories, photo-only medicine request, doctor directory entry, recent orders.
- Medicines: brand/generic search, categories, details, all requested medicine fields, quantity selection and prescription badges. Inactive products are excluded by the service.
- Cart: strength, pack, quantity controls, removal, item prices and totals. No online payment.
- Prescription: camera, gallery or image file; preview, replace and remove. The order service refuses any prescription-required cart without a valid attachment, even when called directly.
- Orders: animated green success confirmation, current/past lists, immutable medicine/address snapshots, status timeline, submitted-prescription indicator and demo ETA where available. Confirmation Pending has been removed, including migration of stored records.
- Request Medicine: exactly one photo, no medicine name, quantity, notes or other text fields; required success message. Requests persist and are listed in Profile.
- Doctors: name/clinic search, specialty and locality filters, details, qualifications, address and consultation timings. Contact action is shown only when a valid number is configured.
- Local persistence for profiles, session, cart, orders, requests and submitted images.

## Structure and architecture

```text
package.json                 npm workspace commands
package-lock.json            reproducible dependency tree
.env.example
apps/mobile/
  App.tsx                    application providers
  app.config.ts              Android configuration and DATA_MODE
  eas.json                   internal APK build profile
  src/
    components/              shared buttons, forms, cards, photo picker
    theme/                   centralized colors, spacing, typography and styles
    navigation/              typed five-tab navigator and detail stack
    screens/                 customer-only screens
    data/catalog.ts          sourced catalog/directory and reference records
    services/
      types.ts               async contracts and domain models
      rules.ts               shared status vocabulary and messages
      mock.ts                mock implementations and business validation
      media.ts               native photo selection and private local files
      index.ts               configuration/composition boundary
      Provider.tsx           injectable service provider and session state
  tests/                     component, navigation and service regressions
```

Future `apps/admin`, `apps/api`, `database`, `docs`, and `.github` can be added without moving the mobile app. They are intentionally not scaffolded now.

Screens read domain data through the provider. They do not import the seed catalog or mock implementations. Service calls are asynchronous even in mock mode. The mock implementations are grouped in one module to avoid unnecessary per-service boilerplate while retaining separate MedicineService, DoctorService, AuthService, CartService, OrderService, RequestService and MediaService contracts.

Navigation starts with phone → mock OTP → registration if needed. Authenticated users enter the five tabs. The shared stack opens medicine details, doctor profiles, cart, order details, and Request Medicine. Android back behavior is supplied by React Navigation. Logout removes the authenticated navigator.

The design system follows the shared Hyderabad Pharmacy storyboard with teal actions, mint accents, white backgrounds, navy text, compact cards, 15px body text, 18px section headings and 24px screen titles. Home includes a teal search header, Charminar banner, featured medicines and circular category tiles. The welcome screen uses a leaf mark and generated Charminar artwork bundled locally. Buttons are at least 54px tall and filter chips at least 48px tall. Font scaling is left enabled. Inputs have accessibility labels; errors use live announcements. Large-screen and very large accessibility font layouts still need device acceptance testing.

## Catalog and directory

- 18 products exclusively from Cipla/Cipla Health, Dr. Reddy's and Abbott: 11 prescription and 7 non-prescription products across tablets, capsules, inhalers, ointments, drops, lozenges, liquids and nutritional powder. Category tabs and subcategories combine with medicine search.
- 9 publicly listed Hyderabad doctors across 8 specialties at Yashoda Hospitals in Malakpet, Somajiguda and Hitec City. Searchable specialty/locality filters contain actual directory values; the separate 14 delivery localities are unchanged.
- Three demo customers, each with a current order, delivered order, cancelled order and sample photo request.
- Product names, packs, manufacturers, prescription labels and photos are sourced from Apollo Pharmacy listings, checked 20 September 2026. Each product links to its source; locally bundled photo provenance is in `apps/mobile/assets/products/product-sources.json`. Prices are illustrative and no live Hyderabad inventory is connected. Packaging can change.
- Doctors' qualifications, hospital branches and published schedules are sourced from their official hospital profiles. Each profile links to its source and asks users to confirm timings. Initials replace fictional portraits. No live appointments, fabricated reviews, ratings or personal phone numbers are shown.

Each medicine supports ID, brand, generic name, manufacturer, composition, strength, dosage form, package size, image reference, category, INR price, prescription requirement and active status. Orders keep snapshots so future catalog/profile edits do not alter order history. Reference data is exposed by the provider, rather than embedded in screens.

## Persistence

AsyncStorage holds a versioned, single-device demo document. A serialized mutation queue prevents overlapping cart/order writes. Order creation and cart clearing use one write. Failures are surfaced; failed writes do not report successful checkout. Each customer's carts, orders and requests are filtered by session identity.

Retired fictional medicines and products outside the three requested manufacturers are filtered out of existing carts. IDs are never reassigned to another medicine. Historical order snapshots remain intact; existing real-product IDs are preserved where the exact strength and pack match.

Android session identity uses SecureStore. This is still mock authentication: the fixed OTP is public and anyone with access to the prototype can sign in to a demo account. Profiles/order data and photos are not separately encrypted. The browser preview uses browser storage for its demo session.

Images are decoded/re-encoded as JPEG and copied to the app's document directory with generated UUID filenames. File size, owned path and image header are validated before submission. Unsubmitted photos are removed when replaced, removed or their picker is unmounted. Submitted images remain while the app's local data exists. A process crash may leave an orphaned draft; clearing Android app data/uninstalling resets the prototype. No production retention promise is made.

## Tests

From the repository root:

```sh
npm run typecheck
npm test
npm run bundle:android -w apps/mobile
```

Or run all three:

```sh
npm run check -w apps/mobile
```

Tests cover medicine fields/search/inactive records; doctor search and combined filters; phone validation, OTP expiry/attempts, registration/profile/session; concurrent cart changes and limits; service-layer prescription enforcement; non-Rx checkout; order/address snapshots; duplicate checkout; account isolation; storage failure; photo-only requests; image path validation; component interaction; five-tab navigation and checkout confirmation. Native camera/file APIs are mocked in unit tests.

### Android device acceptance checklist

1. Sign in, restart the app and confirm the session remains. Edit profile, logout, and sign back in.
2. Search by brand/generic, change category, open medicine details and add/remove quantities.
3. Place a non-Rx order. Add an Rx product and confirm checkout is disabled without a photo.
4. Capture a photo; deny camera permission and check the upload alternative; cancel each picker.
5. Choose JPG/PNG/WebP from gallery and Files; test replacement/removal, oversized/invalid files and restart persistence of submitted prescriptions.
6. Submit one medicine-request photo. Confirm no text fields are present and the exact success message appears.
7. Browse/search doctors, combine filters, open a profile, and use Android back.
8. Check current/past orders and timeline; switch demo accounts and confirm separation.
9. Check TalkBack, enlarged fonts, small devices, offline use and a signed release build.

## Generate an APK

### EAS internal preview APK

Run from `apps/mobile`, using your Expo account:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

`eas.json` requests an APK, not an AAB. EAS setup associates the app with an Expo project and may update configuration. It does not create another GitHub repository or provision an application backend. EAS is an optional build service; its account/queue terms apply. No cloud build has been submitted by this implementation.

### Local Windows debug APK

Install Android Studio/SDK 36 and a compatible JDK (17+ per the installed Android tooling), configure `ANDROID_HOME`, and start an emulator or connect a device. From `apps/mobile`:

```powershell
npx expo prebuild --platform android
npx expo run:android
cd android
.\gradlew.bat assembleDebug
```

The debug APK is at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. It normally needs Metro (`npm start`) to serve JavaScript. For a shareable standalone prototype, use the EAS preview APK above. A local standalone release requires release signing configuration and `assembleRelease`; never commit signing keys. Generated native directories are ignored because Expo config is the source of truth.

This development machine has no detected Java, Android SDK or emulator, so an APK has not been generated or installed here. An Android Hermes production bundle can be validated without that native toolchain.

## Replace mocks with API services

1. Implement `ApiMedicineService`, `ApiDoctorService`, `ApiAuthService`, `ApiCartService`, `ApiOrderService`, `ApiRequestService` and an upload-backed `MediaService` against the contracts in `src/services/types.ts`. Map API responses to the same domain models; image references can be expanded at this boundary.
2. Add an `api` branch to `createServices` in `src/services/index.ts` and return those adapters. Keep credentials in secure storage, never public Expo config.
3. Set `DATA_MODE=api`. Currently this deliberately fails with a clear configuration error; it never silently falls back to mock data.
4. Enforce authentication, owner checks, prices/stock and prescription requirements again on the server. Client checks alone cannot protect a real backend. Use server-issued attachment IDs, validate uploaded content and authorize access.
5. Add loading/retry/pagination behavior as real API constraints become known. Existing async calls and domain contracts keep the screen layouts intact.

No speculative API endpoints or backend skeletons are included.

## Security review and limitations

Development followed [Ponytail FULL](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md) and focused guidance from [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/blob/main/skills/security-audit/SKILL.md), including the mobile/local-file, supply-chain and data-lifecycle companion guidance. This is a scoped prototype review, not a full independently verified six-phase penetration audit.

Reviewed: dependency advisories, public configuration, demo authentication, account-scoped queries, local storage, image imports/paths, backup settings and secrets. There are no production keys or network data services. Android backup is disabled in Expo config and microphone permission is blocked. Final merged manifest, filesystem permissions and actual device behavior require a native build/device check.

Dependency scan: `npm audit` reports **10 moderate, zero high, zero critical** alerts, all propagated from `uuid@7.0.3` through the transitive `xcode` package in Expo tooling ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). The advisory concerns v3/v5/v6 buffer handling; the inspected Xcode consumer calls `uuid.v4()` without a buffer. No vulnerable call path was established in the Android customer app. The advisory is **unresolved**, not a clean dependency scan. npm's proposed force fix would downgrade Expo to SDK 46, which is incompatible with this project. A narrow UUID override was tested but did not replace the workspace's transitive resolution, so it was removed rather than leave a misleading mitigation. Recheck upstream updates before release. App IDs use Expo Crypto, not this UUID dependency.

Latest validation: TypeScript check and 35 regression tests across five suites. Earlier baseline checks included all 21 Expo Doctor compatibility checks and an Android Hermes production bundle. Re-running the Android bundle for these latest changes was blocked by automatic approval review because of the account usage limit. No physical Android/iPhone tests, signed APK test or full security exploit validation was performed.

The Cloudflare audit's stronger isolated execution requirements (fully allowlisted environment, read-only source/toolchain, resource limits and network isolation together) were not established here. Regular development tests are not presented as exploit validation under that workflow.

Known prototype limits: public fixed OTP; local unencrypted demo records/images; image-only prescriptions (no PDFs); no real fulfillment/status updates; no real doctor contact numbers; sourced product photography and hospital profiles with no live feed; English-only; no medical advice. Browser preview does not implement native image storage. Do not use this prototype to process real patients or prescriptions.


## Latest catalog and UX updates

- Charminar is a transparent cutout, used on welcome and home.
- Cart total appears above products; quantity controls keep their appearance while saving and products retain their positions.
- Order IDs are six uppercase alphanumeric characters. Existing local orders receive stable short IDs when read; saved orders retain their contents.
- Locality and specialty use searchable selection sheets; locality selection is also used in registration/profile.
- Catalog contains 18 active, sourced products from Cipla, Dr. Reddy's and Abbott, with locally bundled pack photography. Prices remain illustrative and no live Hyderabad inventory is connected.
- Five broad categories: Medicines, Skin & Personal Care, Baby Care, Vitamins & Wellness, and Women & Family Care. Subcategories appear inside each group. Groups with no verified catalog products show an empty state and medicine-request action; no adult medicines are relabelled as baby products.
- Home shows the customer name and delivery locality/landmark without a greeting or appended city. Successfully sending a medicine request triggers a short vibration.
- Selected successful actions use an animated green check and auto-dismiss message; login, logout and adding cart items are silent. Adding items, changing cart quantities and successfully placing an order request native vibration where supported; iOS uses its system vibration duration. Order placement and medicine requests retain their persistent success message.
- Past orders include item summaries, dates, totals and an Order Again action. Available lines are restored at their original quantities using current prices; unavailable lines and price changes are explained in the review cart before checkout. Unrelated existing cart lines are preserved. Prescription validation runs again against the current catalog.
- Profile opens an account menu with account/delivery editing, orders, medicine requests, help, terms, privacy information, about and logout. Policy pages describe the current prototype without inventing live business policies.
- Added products replace Add to Cart with synchronized quantity controls; decreasing to zero restores Add to Cart. Rapid taps are guarded.
- Prescription labels appear only on prescription products. View Cart remains accented while the cart has items, and quantity controls have explicit vertical space and centering.
- Shared keyboard-aware scrolling, keyboard-resized Android windows, safe-area padding and horizontally scrollable filter chips are applied across screens. Physical-device keyboard, font-scaling and vibration acceptance tests are still required.
- Doctor profiles list each configured clinic separately with address and a single Get Directions action. Search also covers every clinic address/locality.


## Download an APK from GitHub

The **Build testing APK** GitHub Actions workflow runs after mobile changes are pushed to `main`, or manually through **Actions → Build testing APK → Run workflow**.

1. Open the latest successful workflow run in the repository's Actions tab.
2. Download **Hyderabad-Pharmacy-testing-[run number]** from **Artifacts** (retained for 30 days).
3. Unzip it and share `Hyderabad-Pharmacy-testing.apk`. `SHA256SUMS.txt` contains the checksum.
4. Install on an Android phone and allow installation from the app used to open the APK when Android asks. No Expo Go or development server is needed.
5. Use **Try a demo account** and code **123456**. Each installation has its own sample data; orders are not sent to a pharmacy.

The workflow uses the generated Expo Android project and a bundled release variant signed with Expo's standard development key. It is suitable for prototype testing, not Play Store distribution. Builds increment Android's version code using the workflow run number. A future production build must use a private production signing key and real services. Android/iOS hardware behavior still needs device testing; APKs do not install on iPhones.

The native header owns the Android top safe-area inset once; login applies its own top inset. Home spacing is compact and displays locality followed by the saved landmark. Bottom navigation continues to preserve the system navigation inset.

Customer pricing uses a shared MRP / selling price / calculated discount display across product cards, details, cart/checkout, and order history. Test catalog MRPs are illustrative values set 20% above the existing selling prices (not verified retail MRPs). Discounts are calculated from the two prices and rounded to two decimal places. Only discounted products show a crossed-out MRP and OFF percentage. New orders snapshot both prices; older orders without an MRP retain their original selling prices without an invented historical discount. Order Again uses current catalog prices. Customer prices use Indian rupee formatting and do not expose procurement, margin, or per-product tax information.

Cart checkout requires an explicit delivery contribution selection: ₹0, ₹10 or ₹20, with no default. This is a flat amount per order, included once in the estimated and saved totals, and displayed separately in order details. Product quantity changes do not multiply it. Repeat orders restore products only and require a new choice. Historical orders without this field retain their original totals.
