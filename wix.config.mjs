// @ts-check
import { defineWixConfig } from '@wix/cli/config';
import customExtensions from '@wix/custom-extensions/flow';
import zeroConfig from '@wix/cli-zero-config-flow';

// From the app dashboard after creating the app (see README, "Getting it running").
// The namespace must match APP_NAMESPACE in src/lib/config.ts.
const appId = 'REPLACE-WITH-APP-ID';

export default defineWixConfig({
  flows: [
    customExtensions({
      appId,
      projectId: 'shipping-by-product',
      namespace: '@digital36657/shipping-by-product',
      codeIdentifier: 'shipping_by_product',
    }),
    zeroConfig({ appId }),
  ],
});
