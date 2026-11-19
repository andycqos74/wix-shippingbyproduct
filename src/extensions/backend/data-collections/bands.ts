import type { DataCollection } from '@wix/custom-extensions';

export default {
  idSuffix: 'bands',
  displayName: 'Shipping bands',
  displayField: 'title',
  fields: [
    { key: 'title', displayName: 'Name (shown at checkout)', type: 'TEXT' },
    { key: 'price', displayName: 'Price', type: 'NUMBER' },
    { key: 'deliveryTime', displayName: 'Delivery time', type: 'TEXT' },
    { key: 'isDefault', displayName: 'Default for products with no band', type: 'BOOLEAN' },
    { key: 'sortOrder', displayName: 'Sort order', type: 'NUMBER' },
  ],
  // Dashboard-only data. The shipping-rates plugin reads it as the app, not as the visitor.
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
