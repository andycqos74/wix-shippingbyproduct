// Every Wix API call the app makes. UI and plugin code call these, never the SDKs directly.
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { catalogVersioning, products, productsV3 } from '@wix/stores';
import { BANDS_COLLECTION_ID, PRODUCT_BANDS_COLLECTION_ID, SETTINGS_COLLECTION_ID } from './config';
import {
  type Band, type CartLine, type CollectionSettings, type ProductBand, DEFAULT_COLLECTION, productIdOf, toPrice,
} from './bands-logic';

export type CatalogVersion = 'V1_CATALOG' | 'V3_CATALOG' | 'STORES_NOT_INSTALLED';

/** Permission scope each Wix call needs (add in the app dashboard: Develop > Permissions). */
export const SCOPE_FOR_METHOD: Record<string, string> = {
  'catalogVersioning.getCatalogVersion': 'SCOPE.STORES.CATALOG_READ_LIMITED',
  'productsV3.queryProducts': 'SCOPE.STORES.PRODUCT_READ (hidden products: SCOPE.STORES.PRODUCT_READ_ADMIN)',
  'products.queryProducts': 'SCOPE.DC-STORES.READ-PRODUCTS',
};

/** Labels a Wix call's error with the method name, so permission errors say which call was refused. */
function tag<T>(method: string, p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    if (e && typeof e === 'object') (e as any).wixMethod ??= method;
    throw e;
  });
}

const asBand = (row: any): Band => ({
  _id: row._id,
  title: row.title ?? '',
  price: toPrice(row.price) ?? 0,
  deliveryTime: row.deliveryTime || undefined,
  isDefault: !!row.isDefault,
  sortOrder: row.sortOrder ?? 0,
  collectionAvailable: row.collectionAvailable !== false,
});

// ---------- checkout (called by the shipping-rates plugin) ----------
//
// At checkout the plugin runs as the shopper, who can't read the app's collections (they're
// editor-only). These reads run as the app instead. Backend only: elevate() isn't allowed in
// the dashboard page, which uses the plain functions further down.

/** All bands, plus the band of each product in this cart. Two reads, whatever the cart size. */
export async function getBandsForCart(lines: CartLine[]) {
  const query = auth.elevate(items.query);
  const ids = [...new Set(lines.map(productIdOf).filter((x): x is string => !!x))];
  const [bands, rows] = await Promise.all([
    tag('items.query', query(BANDS_COLLECTION_ID).limit(1000).find()).then((r) => r.items.map(asBand)),
    ids.length
      ? tag('items.query', query(PRODUCT_BANDS_COLLECTION_ID).hasSome('_id', ids).limit(1000).find()).then((r) => r.items)
      : Promise.resolve([] as any[]),
  ]);
  const bandByProduct = new Map<string, string>(rows.filter((r: any) => r.bandId).map((r: any) => [r._id, r.bandId]));
  return { bands, bandByProduct };
}

// ---------- bands ----------

export async function listBands(): Promise<Band[]> {
  const res = await tag('items.query', items.query(BANDS_COLLECTION_ID).limit(1000).find());
  return res.items.map(asBand);
}

/** Inserts or updates a band. Ticking Default unticks it on every other band. */
export async function saveBand(band: Partial<Band>): Promise<Band> {
  const data = {
    ...(band._id ? { _id: band._id } : {}),
    title: (band.title ?? '').trim(),
    price: toPrice(band.price) ?? 0,
    deliveryTime: (band.deliveryTime ?? '').trim(),
    isDefault: !!band.isDefault,
    sortOrder: band.sortOrder ?? 0,
    collectionAvailable: band.collectionAvailable !== false,
  };
  const saved = asBand(await tag('items.save', items.save(BANDS_COLLECTION_ID, data as any)));
  if (saved.isDefault) {
    const others = (await listBands()).filter((b) => b.isDefault && b._id !== saved._id);
    for (const o of others) await tag('items.update', items.update(BANDS_COLLECTION_ID, { ...o, isDefault: false } as any));
  }
  return saved;
}

/** Deletes a band and un-assigns it from its products (they fall back to the default band). */
export async function deleteBand(bandId: string): Promise<number> {
  const rows = await listProductBands();
  const ids = rows.filter((r) => r.bandId === bandId).map((r) => r._id);
  for (let i = 0; i < ids.length; i += 1000) {
    await tag('items.bulkRemove', items.bulkRemove(PRODUCT_BANDS_COLLECTION_ID, ids.slice(i, i + 1000)));
  }
  await tag('items.remove', items.remove(BANDS_COLLECTION_ID, bandId));
  return ids.length;
}

// ---------- collect in store ----------

const COLLECTION_ROW = 'collection';

/** The Collect in store settings. Off until saved on the dashboard page. */
export async function getCollectionSettings(): Promise<CollectionSettings> {
  return toCollectionSettings(await tag('items.get', items.get(SETTINGS_COLLECTION_ID, COLLECTION_ROW)));
}

/** Same as getCollectionSettings, read as the app. Checkout (backend) only. */
export async function getCollectionSettingsForCheckout(): Promise<CollectionSettings> {
  return toCollectionSettings(await tag('items.get', auth.elevate(items.get)(SETTINGS_COLLECTION_ID, COLLECTION_ROW)));
}

function toCollectionSettings(row: any): CollectionSettings {
  if (!row) return { ...DEFAULT_COLLECTION };
  return {
    enabled: !!row.enabled,
    title: row.title || DEFAULT_COLLECTION.title,
    price: toPrice(row.price) ?? 0,
    pickupTime: row.pickupTime || undefined,
    instructions: row.instructions || undefined,
  };
}

export async function saveCollectionSettings(s: CollectionSettings) {
  await tag('items.save', items.save(SETTINGS_COLLECTION_ID, {
    _id: COLLECTION_ROW,
    enabled: !!s.enabled,
    title: (s.title ?? '').trim() || DEFAULT_COLLECTION.title,
    price: toPrice(s.price) ?? 0,
    pickupTime: (s.pickupTime ?? '').trim(),
    instructions: (s.instructions ?? '').trim(),
  } as any));
}

// ---------- product assignments ----------

export async function listProductBands(): Promise<ProductBand[]> {
  const out: ProductBand[] = [];
  let res = await tag('items.query', items.query(PRODUCT_BANDS_COLLECTION_ID).limit(1000).find());
  for (;;) {
    out.push(...res.items.map((r: any) => ({ _id: r._id, productName: r.productName, bandId: r.bandId })));
    if (!res.hasNext()) break;
    res = await res.next();
  }
  return out;
}

/** Sets a product's band, or clears it when bandId is empty. */
export async function setProductBand(productId: string, productName: string, bandId: string) {
  if (!bandId) {
    await tag('items.remove', items.remove(PRODUCT_BANDS_COLLECTION_ID, productId));
    return;
  }
  await tag('items.save', items.save(PRODUCT_BANDS_COLLECTION_ID, { _id: productId, productName, bandId } as any));
}

/** Sets the same band on many products in one call (bandId '' clears them). */
export async function setProductBands(rows: { productId: string; productName: string }[], bandId: string) {
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    if (bandId) {
      await tag('items.bulkSave', items.bulkSave(PRODUCT_BANDS_COLLECTION_ID,
        chunk.map((r) => ({ _id: r.productId, productName: r.productName, bandId })) as any));
    } else {
      await tag('items.bulkRemove', items.bulkRemove(PRODUCT_BANDS_COLLECTION_ID, chunk.map((r) => r.productId)));
    }
  }
}

// ---------- Wix Stores products ----------

export interface StoreProduct {
  productId: string;
  name: string;
  visible: boolean;
}

let catalogVersionCache: Promise<CatalogVersion> | null = null;
export function getCatalogVersion(): Promise<CatalogVersion> {
  catalogVersionCache ??= tag('catalogVersioning.getCatalogVersion', catalogVersioning.getCatalogVersion())
    .then((r) => (r.catalogVersion ?? 'V1_CATALOG') as CatalogVersion)
    .catch((e) => {
      catalogVersionCache = null;
      throw e;
    });
  return catalogVersionCache;
}

/** Every product in the store (both catalogue versions), sorted by name. */
export async function listStoreProducts(): Promise<{ catalog: CatalogVersion; products: StoreProduct[] }> {
  const catalog = await getCatalogVersion();
  const out: StoreProduct[] = [];
  if (catalog === 'V3_CATALOG') {
    let res: any = await tag('productsV3.queryProducts', productsV3.queryProducts().limit(100).find());
    for (;;) {
      out.push(...res.items.map((p: any) => ({ productId: p._id, name: p.name ?? '', visible: p.visible !== false })));
      if (!res.hasNext()) break;
      res = await tag('productsV3.queryProducts', res.next());
    }
  } else if (catalog === 'V1_CATALOG') {
    let res: any = await tag('products.queryProducts', products.queryProducts().limit(100).find());
    for (;;) {
      out.push(...res.items.map((p: any) => ({ productId: p._id, name: p.name ?? '', visible: p.visible !== false })));
      if (!res.hasNext()) break;
      res = await tag('products.queryProducts', res.next());
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return { catalog, products: out };
}
