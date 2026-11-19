import { app } from '@wix/custom-extensions';
import dataCollections from './extensions/backend/data-collections/data-collections.extension.ts';
import shippingBandsRates from './extensions/backend/service-plugins/shipping-bands/shipping-bands.extension.ts';
import shippingBandsPage from './extensions/dashboard/pages/shipping-bands/shipping-bands.extension.ts';

export default app().use(dataCollections).use(shippingBandsRates).use(shippingBandsPage);
