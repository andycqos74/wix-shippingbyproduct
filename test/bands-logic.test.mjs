import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/bands-logic.ts';

const LETTER = { _id: 'letter', title: 'Large letter', price: 1.55, deliveryTime: '2-3 working days' };
const SMALL = { _id: 'small', title: 'Small parcel', price: 3.99 };
const LARGE = { _id: 'large', title: 'Parcel', price: 5.5, isDefault: true };
const BANDS = [SMALL, LARGE, LETTER];

const line = (id, name, extra = {}) => ({
  name, quantity: 1, catalogReference: { catalogItemId: id }, physicalProperties: { shippable: true }, ...extra,
});
const assigned = new Map([['pen', 'letter'], ['mag', 'letter'], ['shirt', 'small'], ['jumper', 'large']]);

test('single small item pays its own band', () => {
  assert.equal(L.pickBand([line('pen', 'Pen')], BANDS, assigned).band._id, 'letter');
});

test('pens and magazines together stay on the letter band', () => {
  const r = L.pickBand([line('pen', 'Pen'), line('mag', 'Magazine', { quantity: 3 })], BANDS, assigned);
  assert.equal(r.band._id, 'letter');
  assert.deepEqual(r.unbanded, []);
});

test('mixed order takes the highest band, once', () => {
  const r = L.pickBand([line('pen', 'Pen'), line('shirt', 'Shirt'), line('jumper', 'Jumper')], BANDS, assigned);
  assert.equal(r.band._id, 'large');
  assert.equal(L.toRate(r.band, 'GBP').cost.price, '5.50');
});

test('unbanded product uses the default band', () => {
  const r = L.pickBand([line('pen', 'Pen'), line('mug', 'Mug')], BANDS, assigned);
  assert.equal(r.band._id, 'large');
  assert.deepEqual(r.unbanded, ['Mug']);
});

test('default band only matters if it is the highest in the cart', () => {
  const cheapDefault = [{ ...LETTER, isDefault: true }, SMALL, { ...LARGE, isDefault: false }];
  assert.equal(L.pickBand([line('mug', 'Mug'), line('shirt', 'Shirt')], cheapDefault, assigned).band._id, 'small');
});

test('with no default ticked, unbanded falls back to the dearest band', () => {
  const noDefault = BANDS.map((b) => ({ ...b, isDefault: false }));
  assert.equal(L.pickBand([line('mug', 'Mug')], noDefault, assigned).band._id, 'large');
});

test('a product pointing at a deleted band is treated as unbanded', () => {
  const r = L.pickBand([line('shirt', 'Shirt')], [LETTER, LARGE], assigned);
  assert.equal(r.band._id, 'large');
  assert.deepEqual(r.unbanded, ['Shirt']);
});

test('non-shippable items are ignored', () => {
  const gift = line('jumper', 'Gift card', { physicalProperties: { shippable: false } });
  assert.equal(L.pickBand([line('pen', 'Pen'), gift], BANDS, assigned).band._id, 'letter');
  assert.equal(L.pickBand([gift], BANDS, assigned), null);
});

test('no usable bands is an error, not free delivery', () => {
  assert.throws(() => L.pickBand([line('pen', 'Pen')], [], assigned));
  assert.throws(() => L.pickBand([line('pen', 'Pen')], [{ _id: 'x', title: 'X', price: '' }], assigned));
});

test('rate shape matches what Wix expects', () => {
  assert.deepEqual(L.toRate(LETTER, 'GBP'), {
    code: 'band-letter', title: 'Large letter',
    logistics: { deliveryTime: '2-3 working days' },
    cost: { price: '1.55', currency: 'GBP' },
  });
  assert.equal(L.toRate(SMALL, 'GBP').logistics, undefined);
  assert.equal(L.NOTHING_TO_POST('GBP').cost.price, '0.00');
});

test('sortBands orders cheapest first and drops unpriced bands', () => {
  assert.deepEqual(L.sortBands([LARGE, { _id: 'x', title: 'X', price: NaN }, LETTER, SMALL]).map((b) => b._id),
    ['letter', 'small', 'large']);
});

test('validateBand catches missing name, bad price and duplicate names', () => {
  assert.equal(L.validateBand({ title: 'Letter', price: 1 }, BANDS), '');
  assert.match(L.validateBand({ title: ' ', price: 1 }, BANDS), /name/);
  assert.match(L.validateBand({ title: 'New', price: -1 }, BANDS), /price/);
  assert.match(L.validateBand({ title: 'New', price: 'abc' }, BANDS), /price/);
  assert.match(L.validateBand({ title: 'parcel', price: 2 }, BANDS), /already/);
  assert.equal(L.validateBand({ _id: 'large', title: 'Parcel', price: 6 }, BANDS), '');
});
