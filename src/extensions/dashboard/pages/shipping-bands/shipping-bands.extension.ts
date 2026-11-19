import { extensions } from '@wix/custom-extensions';

export default extensions.dashboardPage({
  id: '8e4d1b62-3f9a-4c75-a0d8-7b2e5c9f1a36',
  title: 'Shipping bands',
  routePath: 'shipping-bands',
  component: './extensions/dashboard/pages/shipping-bands/shipping-bands.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    description: 'Set postage bands and choose which band each product ships in.',
  },
});
