/** App namespace from wix.config.mjs. Collection IDs are "<namespace>/<idSuffix>". */
export const APP_NAMESPACE = '@digital36657/shipping-by-product';

export const BANDS_COLLECTION_ID = `${APP_NAMESPACE}/bands`;
export const PRODUCT_BANDS_COLLECTION_ID = `${APP_NAMESPACE}/product-bands`;

/** Fallback when Wix doesn't say the site currency. The rate must be in the site currency or Wix hides it. */
export const DEFAULT_CURRENCY = 'GBP';
