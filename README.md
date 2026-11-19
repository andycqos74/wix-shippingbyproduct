# Shipping by product (private Wix app)

Charges postage by **band** instead of one flat rate. You define bands (e.g. *Large letter £1.55*,
*Small parcel £3.99*, *Parcel £5.50*) and give each product one band. An order pays the price of
the **highest band among its items, once**:

| Cart | Charged |
|------|---------|
| 2 pens + a magazine | Large letter £1.55 |
| pen + shirt | Small parcel £3.99 |
| pen + shirt + jumper | Parcel £5.50 |

**What it does**

| Where | What |
|---|---|
| **Shipping bands page** (dashboard sidebar, under Apps) | Add, edit and delete bands (name shown at checkout, price, optional delivery time). Tick one as **Default**. Below that, every store product with a band picker. Filter by band or *No band set*, search by name, and **Apply to N** sets a band on every product shown in one go. |
| **Cart and checkout** | The app's Shipping Rates plugin returns one delivery option: the highest band in the cart, with its delivery time. |

Rules:

- A product with **no band** is charged as the **Default** band. If none is ticked, it's charged as the
  **dearest** band, so a forgotten product is never posted for less than it costs. Unbanded items are
  logged as a warning.
- A band applies to every variant/size of the product.
- Non-shippable items (digital, gift cards) are ignored. A cart with nothing to post gets a £0
  *No delivery needed* option.
- If no band is set up, or the bands can't be read, **no delivery option is offered** and checkout
  can't complete. That's deliberate: failing loudly beats charging the wrong postage. The reason is
  in the app's logs.
- Deleting a band un-assigns its products, so they fall back to the default band.
- Wix caches the rate for up to 10 minutes per cart, so a price change can take that long to show on
  an open cart.

---

## Project layout

```
src/
  lib/bands-logic.ts      all the rules (no Wix imports, unit-tested)
  lib/wix-ops.ts          every Wix API call (bands, product assignments, Stores products)
  lib/config.ts           collection IDs, fallback currency
  components/common.tsx   error text, toasts, build stamp
  extensions/
    backend/data-collections/              the Shipping bands + Product shipping bands collections
    backend/service-plugins/shipping-bands/ the eCommerce Shipping Rates plugin (cart/checkout)
    dashboard/pages/shipping-bands/        the dashboard page
test/bands-logic.test.mjs
```

Commands: `npm test`, `npm run typecheck`, `npm run dev` (= `wix app dev`), `npm run build`, `npm run release`.
The Wix CLI needs Node 24.22.1 or later (`.nvmrc`).

## Getting it running

1. **Create the app.** In [Wix Studio's custom apps](https://manage.wix.com/account/custom-apps), create a new app
   called *Shipping by product*. Copy its **App ID** into `appId` in `wix.config.mjs`.
   If the app's namespace isn't `@digital36657/shipping-by-product`, change it in both
   `wix.config.mjs` and `APP_NAMESPACE` in `src/lib/config.ts`.
2. **Permissions.** In the app dashboard, **Develop → Permissions → Add Permissions**:
   - **Read Stores catalogue / products** (`SCOPE.DC-STORES.READ-PRODUCTS`, and for catalogue V3
     `SCOPE.STORES.PRODUCT_READ` + `SCOPE.STORES.CATALOG_READ_LIMITED`)
   - read/write data items (Wix Data)
   - **Manage eCommerce shipping rates** if the dashboard asks for it when the plugin is added
   If something is missing, the error on the page names the call that was refused and the permission it needs.
3. **Test on a development site.** Run `npm run dev`, pick or create a dev site with Wix Stores and install the app. Then:
   - on the **Shipping bands** page add *Large letter £1.55*, *Small parcel £3.99*, *Parcel £5.50* (tick Default)
   - band a pen as Large letter and a jumper as Parcel
   - in **Settings → Shipping & fulfilment**, open your region, switch on **Shipping bands** under
     installed apps, and **turn off the region's existing rates** (otherwise the customer can pick the cheaper one)
   - add the pen alone to the cart: £1.55. Add the jumper: £5.50, once
4. **Go live.** Run `npm run release`, then install the app on the live site from the app dashboard
   (private apps get a direct install link), and repeat the shipping-region step there.

## Not verified yet

The code typechecks against Wix's current SDK and design-system types, the rules are unit-tested,
and it builds with `wix app build`. It hasn't been run against a real Wix site, so step 3 is that
check. These depend on Wix behaviour:

1. That `catalogReference.catalogItemId` on a cart line is the Wix Stores product ID, as the Stores
   APIs return it. Wix documents it that way for Wix Stores items.
2. That the shipping plugin, which runs as the app, can read the app's own collections. Their
   permissions are admin-only so site visitors can't read them.
3. The permission names in step 2, which Wix sometimes renames.
