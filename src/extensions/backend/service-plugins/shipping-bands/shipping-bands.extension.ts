import { extensions } from '@wix/custom-extensions';

export default extensions.ecomShippingRates({
  id: 'c3a7e915-4b2d-4f68-8e1a-6d9b0f2c7a54',
  name: 'Shipping bands',
  description: 'One postage price per order: the highest band of any item in the cart.',
  source: './extensions/backend/service-plugins/shipping-bands/shipping-bands.ts',
});
