// All the shipping-band rules. No Wix imports, so it runs under plain Node for the tests.
//
//   - Each product has at most one band.
//   - An order pays the price of the HIGHEST band among its shippable items, once:
//     a pen + a jumper pays the jumper's postage, not both.
//   - A product with no band uses the band ticked "Default". If none is ticked it uses the
//     dearest band, so a forgotten product is never posted for less than it costs.
//   - Non-shippable items (digital products, gift cards) are ignored.
//   - "Collect in store" is offered only when every shippable item's band allows collection.
//     Bands allow it unless "Collection available" is unticked, so existing bands keep it.

export interface Band {
  _id: string;
  title: string;
  price: number;
  deliveryTime?: string;
  isDefault?: boolean;
  sortOrder?: number;
  /** Unticked (false) = items in this band can't be collected. Missing counts as available. */
  collectionAvailable?: boolean;
}

/** The app's "Collect in store" option. Replaces Wix's own local pickup in the region. */
export interface CollectionSettings {
  enabled: boolean;
  title: string;
  price: number;
  pickupTime?: string;
  instructions?: string;
}

export const DEFAULT_COLLECTION: CollectionSettings = { enabled: false, title: 'Collect in store', price: 0 };

export const allowsCollection = (b: Band | undefined) => b?.collectionAvailable !== false;

/** One row per product; the row's _id is the product ID, so there can't be two. */
export interface ProductBand {
  _id: string;
  productName?: string;
  bandId: string;
}

export interface CartLine {
  name?: string;
  quantity?: number;
  catalogReference?: { catalogItemId?: string; appId?: string };
  physicalProperties?: { shippable?: boolean } | null;
}

export interface RateOption {
  code: string;
  title: string;
  logistics?: {
    deliveryTime?: string;
    instructions?: string;
    pickupDetails?: { address?: any; pickupMethod: 'STORE_PICKUP' };
  };
  cost: { price: string; currency: string };
}

/** Price as a number, or null if it isn't a usable price. */
export function toPrice(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Bands with a valid price, cheapest first (ties broken by sortOrder, then title). */
export function sortBands<T extends Band>(bands: T[]): T[] {
  return bands
    .filter((b) => b && toPrice(b.price) !== null)
    .sort((a, b) =>
      toPrice(a.price)! - toPrice(b.price)! ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      String(a.title).localeCompare(String(b.title)));
}

/** The band an unbanded product is charged at: the Default one, else the dearest. */
export function fallbackBand<T extends Band>(bands: T[]): T | undefined {
  const usable = sortBands(bands);
  return usable.find((b) => b.isDefault) ?? usable[usable.length - 1];
}

export const isShippable = (li: CartLine) => li?.physicalProperties?.shippable !== false;
export const productIdOf = (li: CartLine) => li?.catalogReference?.catalogItemId || undefined;

export interface Pick {
  band: Band;
  /** Names of cart lines that had no band and were charged at the fallback band. */
  unbanded: string[];
  /** Whether every item's band allows collection. */
  collectable: boolean;
  /** Names of items whose band doesn't allow collection. */
  notCollectable: string[];
}

/**
 * The band to charge for a cart, or null when nothing in it needs posting.
 * Throws when no band has a usable price: that's a setup problem, not free postage.
 */
export function pickBand(lines: CartLine[], bands: Band[], bandByProduct: Map<string, string>): Pick | null {
  const usable = sortBands(bands);
  if (usable.length === 0) throw new Error('No shipping bands with a price are set up.');
  const byId = new Map(usable.map((b) => [b._id, b]));
  const fallback = fallbackBand(usable)!;

  const shippable = (lines ?? []).filter(isShippable);
  if (shippable.length === 0) return null;

  let chosen: Band | undefined;
  const unbanded: string[] = [];
  const notCollectable: string[] = [];
  for (const li of shippable) {
    const pid = productIdOf(li);
    const assigned = pid ? byId.get(bandByProduct.get(pid) ?? '') : undefined;
    const band = assigned ?? fallback;
    const name = li.name || pid || 'unknown item';
    if (!assigned) unbanded.push(name);
    if (!allowsCollection(band)) notCollectable.push(name);
    if (!chosen || toPrice(band.price)! > toPrice(chosen.price)!) chosen = band;
  }
  return { band: chosen!, unbanded, collectable: notCollectable.length === 0, notCollectable };
}

/** The rate Wix shows at cart/checkout for a band. */
export function toRate(band: Band, currency: string): RateOption {
  return {
    code: `band-${band._id}`,
    title: band.title,
    ...(band.deliveryTime ? { logistics: { deliveryTime: band.deliveryTime } } : {}),
    cost: { price: toPrice(band.price)!.toFixed(2), currency },
  };
}

/**
 * The "Collect in store" option, or null when it shouldn't be offered (switched off, or an
 * item's band doesn't allow collection). The address is the store's business address.
 */
export function toCollectionRate(
  settings: CollectionSettings | null | undefined, pick: Pick, currency: string, address?: unknown,
): RateOption | null {
  if (!settings?.enabled || !pick.collectable) return null;
  const price = toPrice(settings.price) ?? 0;
  return {
    code: 'collect-in-store',
    title: settings.title?.trim() || DEFAULT_COLLECTION.title,
    logistics: {
      ...(settings.pickupTime ? { deliveryTime: settings.pickupTime } : {}),
      ...(settings.instructions ? { instructions: settings.instructions } : {}),
      pickupDetails: { ...(address ? { address } : {}), pickupMethod: 'STORE_PICKUP' },
    },
    cost: { price: price.toFixed(2), currency },
  };
}

export const NOTHING_TO_POST = (currency: string): RateOption => ({
  code: 'no-shipping',
  title: 'No delivery needed',
  cost: { price: '0.00', currency },
});

/** Checks a band before saving. Returns an error message, or '' if it's fine. */
export function validateBand(b: Partial<Band>, others: Band[]): string {
  const title = (b.title ?? '').trim();
  if (!title) return 'Give the band a name.';
  if (title.length > 100) return 'Keep the name under 100 characters.';
  if (toPrice(b.price) === null) return 'Enter a price of 0 or more.';
  if (others.some((o) => o._id !== b._id && o.title.trim().toLowerCase() === title.toLowerCase()))
    return `There is already a band called "${title}".`;
  return '';
}

export function formatMoney(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);
}
