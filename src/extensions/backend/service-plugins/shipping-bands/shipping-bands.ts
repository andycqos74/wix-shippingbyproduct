// Wix calls this at cart and checkout. It returns the highest band among the cart's items,
// plus "Collect in store" when it's switched on and every item's band allows collection
// (see src/lib/bands-logic.ts for the rules).
import { shippingRates } from '@wix/ecom/service-plugins';
import { DEFAULT_CURRENCY } from '../../../../lib/config';
import { NOTHING_TO_POST, pickBand, toCollectionRate, toRate } from '../../../../lib/bands-logic';
import { getBandsForCart, getCollectionSettingsForCheckout } from '../../../../lib/wix-ops';

shippingRates.provideHandlers({
  async getShippingRates({ request, metadata }) {
    const lines = request.lineItems ?? [];
    const currency = metadata.currency || DEFAULT_CURRENCY;
    try {
      const [{ bands, bandByProduct }, collection] = await Promise.all([
        getBandsForCart(lines),
        // A settings problem shouldn't stop delivery: just don't offer collection.
        getCollectionSettingsForCheckout().catch((e) => {
          console.error('Shipping bands: could not read the collect in store settings.', e);
          return null;
        }),
      ]);
      const pick = pickBand(lines, bands, bandByProduct);
      if (!pick) return { shippingRates: [NOTHING_TO_POST(currency)] };
      if (pick.unbanded.length) {
        console.warn(`Shipping bands: no band set for ${pick.unbanded.join(', ')}; charged at "${pick.band.title}".`);
      }
      const collect = toCollectionRate(collection, pick, currency, request.shippingOrigin);
      const rates = collect ? [toRate(pick.band, currency), collect] : [toRate(pick.band, currency)];
      // Wix types pickupMethod as an enum; its value is the same 'STORE_PICKUP' string.
      return { shippingRates: rates as any[] };
    } catch (e) {
      // No rate means no checkout. Better than charging the wrong postage when the
      // bands aren't set up or can't be read; the reason is in the app's logs.
      console.error('Shipping bands: could not price the cart.', e);
      return { shippingRates: [] };
    }
  },
});
