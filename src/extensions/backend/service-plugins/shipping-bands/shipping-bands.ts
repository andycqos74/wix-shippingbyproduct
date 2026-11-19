// Wix calls this at cart and checkout. It returns one rate: the highest band among the
// cart's items (see src/lib/bands-logic.ts for the rules).
import { shippingRates } from '@wix/ecom/service-plugins';
import { DEFAULT_CURRENCY } from '../../../../lib/config';
import { NOTHING_TO_POST, pickBand, toRate } from '../../../../lib/bands-logic';
import { getBandsForCart } from '../../../../lib/wix-ops';

shippingRates.provideHandlers({
  async getShippingRates({ request, metadata }) {
    const lines = request.lineItems ?? [];
    const currency = metadata.currency || DEFAULT_CURRENCY;
    try {
      const { bands, bandByProduct } = await getBandsForCart(lines);
      const pick = pickBand(lines, bands, bandByProduct);
      if (!pick) return { shippingRates: [NOTHING_TO_POST(currency)] };
      if (pick.unbanded.length) {
        console.warn(`Shipping bands: no band set for ${pick.unbanded.join(', ')}; charged at "${pick.band.title}".`);
      }
      return { shippingRates: [toRate(pick.band, currency)] };
    } catch (e) {
      // No rate means no checkout. Better than charging the wrong postage when the
      // bands aren't set up or can't be read; the reason is in the app's logs.
      console.error('Shipping bands: could not price the cart.', e);
      return { shippingRates: [] };
    }
  },
});
