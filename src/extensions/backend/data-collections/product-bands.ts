import type { DataCollection } from '@wix/custom-extensions';

// One row per product. The row's _id IS the Wix Stores product ID, so a product can't
// end up with two bands.
export default {
  idSuffix: 'product-bands',
  displayName: 'Product shipping bands',
  displayField: 'productName',
  fields: [
    { key: 'productName', displayName: 'Product', type: 'TEXT' },
    { key: 'bandId', displayName: 'Band ID', type: 'TEXT' },
  ],
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
