# Bundle 20% Discount — Shopify App

A Shopify app that automatically applies a **20% discount** to complete bundles at checkout. A bundle is defined as **1 Core product + 3 Patch products**. The discount is powered by a [Shopify Function](https://shopify.dev/docs/apps/build/functions) and runs entirely at the edge — no external services, no latency.

---

## How It Works

The discount function reads the `custom.bundle_role` product metafield from each cart line and groups items into bundles:

```
bundleCount = min(coreCount, floor(patchCount / 3))
```

- **20% off** is applied to `bundleCount` core units and `bundleCount × 3` patch units.
- Extra items that don't complete a bundle receive no discount.
- Multiple bundles in the same cart are fully supported.

**Examples:**

| Cart contents           | Bundles | Discounted items         |
|-------------------------|---------|--------------------------|
| 1 core + 3 patches      | 1       | All 4 items              |
| 2 cores + 6 patches     | 2       | All 8 items              |
| 1 core + 4 patches      | 1       | 1 core + 3 patches (1 patch at full price) |
| 1 core + 2 patches      | 0       | None                     |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Router v7 |
| Shopify integration | `@shopify/shopify-app-react-router` |
| Discount logic | Shopify Functions (TypeScript → WASM) |
| Database | Prisma + SQLite (session & discount state) |
| UI | Polaris web components (`<s-*>`) |
| API version | 2026-01 |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/getting-started) installed and authenticated
- A Shopify Partner account and a development store

---

## Local Development

**1. Install dependencies**

```shell
npm install
```

**2. Set up the database**

```shell
npm run setup
```

This runs `prisma generate` and `prisma migrate deploy`, creating the SQLite database with the `Session` and `AppDiscount` tables.

**3. Start the dev server**

```shell
shopify app dev
```

The CLI will:
- Authenticate with your Partner account
- Create a tunnel to your local machine
- Start the React Router dev server and the Shopify Function compiler
- Print the install URL for your development store

Press **P** to open the app in your dev store's admin.

**4. Install the app**

Follow the install URL printed by the CLI. After OAuth completes you land on the app dashboard.

---

## Activating the Discount

After installing, open the app in Shopify Admin. The dashboard shows the current discount status.

If no discount exists yet, click **Create Discount**. The app will:

1. Query Shopify for the deployed discount function ID.
2. Call `discountAutomaticAppCreate` to create an automatic app discount titled **"Bundle 20% (Core + 3 Patches)"**.
3. Store the discount ID in the local database for status tracking.

The discount becomes **ACTIVE** immediately and applies automatically at checkout — no discount code needed.

> **Note:** The function must be deployed (`shopify app deploy`) before the Create Discount button will work. During local dev with `shopify app dev` the function is compiled and available.

---

## Product Setup (Merchant Steps)

For the discount to fire, products must have the `custom.bundle_role` metafield set. The in-app **Setup Guide** page walks merchants through this, but the short version is:

**1. Create the metafield definition** in Shopify Admin → Settings → Custom data → Products:

| Field | Value |
|-------|-------|
| Namespace | `custom` |
| Key | `bundle_role` |
| Type | Single line text |

**2. Tag each product:**

- Core products → set `bundle_role` = `core`
- Patch products → set `bundle_role` = `patch`

Products without this metafield are ignored by the discount function.

---

## Project Structure

```
bundle-20-discount/
├── app/
│   ├── routes/
│   │   ├── _index/route.tsx          # Public landing / login page
│   │   ├── app.tsx                   # Authenticated layout + nav
│   │   ├── app._index.tsx            # Dashboard: discount status + management
│   │   ├── app.additional.tsx        # Setup guide for merchants
│   │   ├── auth.$.tsx                # OAuth callback
│   │   ├── auth.login/route.tsx      # Login form
│   │   └── webhooks.*.tsx            # app/uninstalled, app/scopes_update
│   ├── shopify.server.ts             # Shopify SDK init (scopes, session storage)
│   └── db.server.ts                  # Prisma client singleton
├── extensions/
│   └── bundle-20-core-patches/
│       ├── src/
│       │   ├── cart_lines_discounts_generate_run.ts       # Bundle detection logic
│       │   ├── cart_lines_discounts_generate_run.graphql  # Input query (reads bundle_role)
│       │   └── index.ts
│       ├── tests/fixtures/            # 6 bundle-specific test scenarios
│       ├── generated/api.ts           # Auto-generated types (do not edit)
│       └── shopify.extension.toml
├── prisma/
│   ├── schema.prisma                  # Session + AppDiscount models
│   └── migrations/
├── shopify.app.toml                   # App config (scopes: write_discounts,read_products)
└── package.json
```

---

## Discount Function

**Location:** `extensions/bundle-20-core-patches/`

The function runs on `cart.lines.discounts.generate.run`. For each cart evaluation it:

1. Reads `product.metafield(namespace: "custom", key: "bundle_role")` per line.
2. Sums quantities for `core` and `patch` lines separately.
3. Calculates `bundleCount = min(coreCount, floor(patchCount / 3))`.
4. Builds quantity-aware `CartLineTarget` entries (partial quantities supported — a line with qty 4 can have only 3 units targeted).
5. Returns a single `productDiscountsAdd` operation with 20% off and the label `"Bundle 20% Off (N bundle(s))"`.

**Running tests:**

```shell
cd extensions/bundle-20-core-patches
npm test
```

Six fixtures cover: 1-bundle, 2-bundles, partial patches, no complete bundle, no metafield, empty cart.

**Regenerating types** (after editing the `.graphql` input query):

```shell
cd extensions/bundle-20-core-patches
npm run typegen
```

---

## Deployment

**1. Deploy the app and extension**

```shell
shopify app deploy
```

This compiles the Shopify Function to WASM and registers everything with Shopify. After deploy, the function ID becomes stable.

**2. Install on a production store**

Use the install link from the Shopify Partner Dashboard (custom distribution). After OAuth completes, open the app admin and click **Create Discount** to activate.

**3. Build the web app for production**

```shell
npm run build
npm start
```

---

## Environment Variables

Set these in your hosting environment (or `.env` for local dev):

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | Your app's client ID (from Partner Dashboard) |
| `SHOPIFY_API_SECRET` | Your app's client secret |
| `SHOPIFY_APP_URL` | The public URL of your deployed app |
| `SCOPES` | `write_discounts,read_products` |
| `DATABASE_URL` | Database connection string (omit for SQLite default) |

---

## Database

By default the app uses **SQLite** via Prisma. This works for single-instance deployments. For production at scale, switch to PostgreSQL or MySQL by updating the `datasource` in `prisma/schema.prisma`.

**Tables:**

- `Session` — OAuth session storage (managed by `@shopify/shopify-app-session-storage-prisma`)
- `AppDiscount` — Tracks the created automatic discount ID per shop

**Run migrations:**

```shell
npm run setup
# or manually:
npx prisma migrate deploy
```

---

## Troubleshooting

**"Discount function not found" when clicking Create Discount**
The function must be deployed first. Run `shopify app deploy` and try again.

**Discount not appearing at checkout**
- Confirm the `custom.bundle_role` metafield is set on your products.
- Confirm the discount is ACTIVE in Shopify Admin → Discounts.
- Check that the cart has at least 1 core and 3 patches.

**Database tables don't exist**
Run `npm run setup` to create and apply migrations.

**"nbf" claim timestamp check failed**
Your machine clock is out of sync. Enable automatic time sync in your OS date/time settings.

---

## Resources

- [Shopify Functions — Discount Function API](https://shopify.dev/docs/api/functions/reference/discount)
- [discountAutomaticAppCreate mutation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticAppCreate)
- [Shopify App React Router docs](https://shopify.dev/docs/api/shopify-app-react-router)
- [Polaris web components](https://shopify.dev/docs/api/app-home/polaris-web-components)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Prisma docs](https://www.prisma.io/docs)
