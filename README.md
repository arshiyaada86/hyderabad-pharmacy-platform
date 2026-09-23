# Old City Pharmacy platform

One repository for the Expo customer app, Material UI staff dashboard and persistent shared API.

```text
apps/mobile       Expo / React Native customer app
apps/admin        React + Material UI dashboard
apps/api          Express API + SQLite database and image storage
packages/domain   Shared contracts, validation, seeds and form definitions
docs              Requirements and setup
.github/workflows Android APK and platform verification
```

## Start locally

Requires Node.js 24+ and npm. From the repository root:

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. API: **http://127.0.0.1:4000**. First startup generates a unique administrator email/password in `apps/api/data/local-access.json`. This file and the database are ignored by Git. Keep the terminal running.

The shared testing workspace includes 18 products, 9 sourced doctors, 5 categories and fictional customer/order/request records. Prices, MRPs and stock are samples. Customer demo login is `9000000001` / `123456`. Do not enter real patient information into demo mode.

## Dashboard modules

Products and pack photos; MRP/selling prices and discounts; prescription rules; stock adjustments and inventory history; categories/subcategories; approved manufacturers; orders and prescription review; medicine photo requests; customers and account history; delivery localities; doctors, specialties and multiple clinics; home branding, banners and featured products; support contacts; help, terms, privacy and about pages; staff roles and audit history.

Editors include search, pagination, validation, publication controls and save-conflict detection. Published data supplies the customer app in API mode. Customer prices never include procurement cost or profit margins.

## Connected customer preview

Start the platform, then in another PowerShell terminal:

```powershell
$env:EXPO_PUBLIC_DATA_MODE='api'
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4000'
npm run web -w apps/mobile -- --port 8089
```

Open **http://localhost:8089**. See [platform setup](docs/PLATFORM_SETUP.md) for Expo Go, roles, persistence, API routes and hosting prerequisites.

Without API settings, the customer app retains standalone device-local mock mode. Existing automated testing APKs also use mock mode so they work without this computer remaining online.

## Checks and automation

```sh
npm run typecheck
npm test
npm run build:admin
npm run bundle:android -w apps/mobile
```

**Verify platform** runs workspace checks/tests and uploads the dashboard build. **Build testing APK** runs on mobile/shared-domain changes to main or manually in Actions. Download and unzip the APK artifact from a successful run. It includes JavaScript/assets and uses the standard development signing key for testing, not Play Store distribution.

A connected APK needs a reachable API URL configured at build time. No API hosting or SMS provider is provisioned here. Physical-device camera, keyboard, haptic and safe-area acceptance testing remains necessary.

## Catalog and requirements

The approved customer design is preserved. See [the complete requirement inventory](docs/DASHBOARD_REQUIREMENTS.md). Only Cipla, Dr. Reddy's and Abbott groups are offered; the five broad categories remain unchanged.

Bundled product provenance is in `apps/mobile/assets/products/product-sources.json`; doctor records link to official hospital profiles. Sources were checked on 20 September 2026. Verify current descriptions, prices, Rx flags, image rights and clinic details before a real launch.

Production hosting, SMS delivery, final policies, payments, courier integration and production signing are not configured. Live-mode API configuration is available, but the supplied workspace is for testing.
