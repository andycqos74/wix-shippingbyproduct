import type { DataCollection } from '@wix/custom-extensions';

// App settings, one row per setting group. Row "collection" holds the Collect in store option.
export default {
  idSuffix: 'settings',
  displayName: 'Shipping bands settings',
  displayField: 'title',
  fields: [
    { key: 'enabled', displayName: 'Offer collect in store', type: 'BOOLEAN' },
    { key: 'title', displayName: 'Name (shown at checkout)', type: 'TEXT' },
    { key: 'price', displayName: 'Price', type: 'NUMBER' },
    { key: 'pickupTime', displayName: 'Ready for collection', type: 'TEXT' },
    { key: 'instructions', displayName: 'Collection instructions', type: 'TEXT' },
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
