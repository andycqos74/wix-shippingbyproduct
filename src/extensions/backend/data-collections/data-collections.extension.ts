import { extensions } from '@wix/custom-extensions';

import bands from './bands';
import productBands from './product-bands';
import settings from './settings';

export default extensions.dataCollections({
  id: '5b8f2c41-7d3e-4a96-9b0e-2f6c1d8a4e73',
  name: 'Shipping bands data',
  collections: [bands, productBands, settings],
});
