// Dashboard page: define the postage bands, then pick each product's band.
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import {
  Badge, Box, Button, Card, Checkbox, Dropdown, FormField, Input, Loader, Page, Search,
  SectionHelper, Table, TableToolbar, Text, WixDesignSystemProvider,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { type Band, fallbackBand, formatMoney, sortBands, validateBand } from '../../../../lib/bands-logic';
import {
  type CatalogVersion, type StoreProduct, deleteBand, listBands, listProductBands, listStoreProducts,
  saveBand, setProductBand, setProductBands,
} from '../../../../lib/wix-ops';
import { buildLabel, errorText, toastError, toastOk } from '../../../../components/common';

type Draft = { _id?: string; title: string; price: string; deliveryTime: string; isDefault: boolean };
const EMPTY_DRAFT: Draft = { title: '', price: '', deliveryTime: '', isDefault: false };
type Row = StoreProduct & { bandId: string };

const ShippingBandsPage: FC = () => {
  const [bands, setBands] = useState<Band[]>();
  const [rows, setRows] = useState<Row[]>();
  const [catalog, setCatalog] = useState<CatalogVersion>();
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [bulkBand, setBulkBand] = useState<string>();

  const load = useCallback(async () => {
    setError('');
    try {
      const [b, assigned, store] = await Promise.all([listBands(), listProductBands(), listStoreProducts()]);
      const byProduct = new Map(assigned.map((a) => [a._id, a.bandId]));
      setBands(sortBands(b));
      setCatalog(store.catalog);
      setRows(store.products.map((p) => ({ ...p, bandId: byProduct.get(p.productId) ?? '' })));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => void load(), [load]);

  const fallback = useMemo(() => (bands ? fallbackBand(bands) : undefined), [bands]);
  const bandName = (id: string) => bands?.find((b) => b._id === id)?.title;
  const countFor = (id: string) => rows?.filter((r) => r.bandId === id).length ?? 0;
  const unbandedCount = rows?.filter((r) => !bandName(r.bandId)).length ?? 0;

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (!s || r.name.toLowerCase().includes(s)) &&
      (filter === 'ALL' || (filter === 'NONE' ? !bandName(r.bandId) : r.bandId === filter)));
  }, [rows, search, filter, bands]);

  // ---------- bands ----------

  async function onSaveBand() {
    if (!draft || !bands) return;
    const candidate = { ...draft, price: draft.price as unknown as number };
    const problem = validateBand(candidate, bands);
    if (problem) return toastError(problem);
    setBusy(true);
    try {
      await saveBand(candidate);
      toastOk(`Saved "${draft.title.trim()}".`);
      setDraft(null);
      setBands(sortBands(await listBands()));
    } catch (e) {
      toastError(e, "Couldn't save the band: ");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteBand(b: Band) {
    const n = countFor(b._id);
    const what = n ? ` ${n} product(s) use it and will go back to the default band.` : '';
    if (!window.confirm(`Delete the "${b.title}" band?${what}`)) return;
    setBusy(true);
    try {
      await deleteBand(b._id);
      toastOk(`Deleted "${b.title}".`);
      await load();
    } catch (e) {
      toastError(e, "Couldn't delete the band: ");
    } finally {
      setBusy(false);
    }
  }

  // ---------- products ----------

  async function onPickBand(r: Row, bandId: string) {
    const before = r.bandId;
    setRows((rs) => rs?.map((x) => (x.productId === r.productId ? { ...x, bandId } : x)));
    try {
      await setProductBand(r.productId, r.name, bandId);
    } catch (e) {
      setRows((rs) => rs?.map((x) => (x.productId === r.productId ? { ...x, bandId: before } : x)));
      toastError(e, `Couldn't set the band for ${r.name}: `);
    }
  }

  async function onBulk() {
    if (bulkBand === undefined || shown.length === 0) return;
    const label = bandName(bulkBand) ?? 'no band (default)';
    if (!window.confirm(`Set ${shown.length} product(s) to ${label}?`)) return;
    setBusy(true);
    try {
      await setProductBands(shown.map((r) => ({ productId: r.productId, productName: r.name })), bulkBand);
      const ids = new Set(shown.map((r) => r.productId));
      setRows((rs) => rs?.map((x) => (ids.has(x.productId) ? { ...x, bandId: bulkBand } : x)));
      toastOk(`${shown.length} product(s) set to ${label}.`);
    } catch (e) {
      toastError(e, "Couldn't update the products: ");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const bandOptions = [
    { id: '', value: fallback ? `No band (charged as ${fallback.title})` : 'No band' },
    ...(bands ?? []).map((b) => ({ id: b._id, value: `${b.title} · ${formatMoney(b.price)}` })),
  ];
  const filterOptions = [
    { id: 'ALL', value: 'All products' },
    { id: 'NONE', value: `No band set (${unbandedCount})` },
    ...(bands ?? []).map((b) => ({ id: b._id, value: `${b.title} (${countFor(b._id)})` })),
  ];

  const bandColumns = [
    {
      title: 'Band',
      render: (b: Band) => (
        <Box gap="SP2" verticalAlign="middle">
          <Text weight="normal">{b.title}</Text>
          {b.isDefault && <Badge size="small" skin="general">Default</Badge>}
        </Box>
      ),
    },
    { title: 'Price', render: (b: Band) => <Text>{formatMoney(b.price)}</Text> },
    { title: 'Delivery time', render: (b: Band) => <Text size="small" secondary>{b.deliveryTime || '—'}</Text> },
    { title: 'Products', render: (b: Band) => <Text size="small">{countFor(b._id)}</Text> },
    {
      title: '',
      align: 'end' as const,
      render: (b: Band) => (
        <Box gap="SP2" align="right">
          <Button size="tiny" priority="secondary" disabled={busy}
            onClick={() => setDraft({ _id: b._id, title: b.title, price: String(b.price), deliveryTime: b.deliveryTime ?? '', isDefault: !!b.isDefault })}>
            Edit
          </Button>
          <Button size="tiny" priority="secondary" skin="destructive" disabled={busy} onClick={() => onDeleteBand(b)}>
            Delete
          </Button>
        </Box>
      ),
    },
  ];

  const productColumns = [
    {
      title: 'Product',
      render: (r: Row) => (
        <Box gap="SP2" verticalAlign="middle">
          <Text weight="normal">{r.name}</Text>
          {!r.visible && <Badge size="tiny" skin="neutralLight">Hidden</Badge>}
        </Box>
      ),
    },
    {
      title: 'Shipping band',
      width: '340px',
      render: (r: Row) => (
        <Dropdown size="small" options={bandOptions} selectedId={bandName(r.bandId) ? r.bandId : ''}
          disabled={busy || !bands?.length} onSelect={(o) => onPickBand(r, String(o.id))} />
      ),
    },
  ];

  const loading = !error && (!bands || !rows);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Shipping bands"
          subtitle={`Each product ships in one band. An order pays the highest band among its items, once. (${buildLabel})`} />
        <Page.Content>
          <Box direction="vertical" gap="SP4">
            {error && (
              <SectionHelper appearance="danger" title="Couldn't load the shipping bands">
                {error}
                <Box marginTop="SP2"><Button size="tiny" onClick={load}>Try again</Button></Box>
              </SectionHelper>
            )}
            {loading && <Box align="center" padding="SP6"><Loader /></Box>}

            {bands && (
              <Card>
                <Card.Header title="Bands"
                  subtitle={fallback
                    ? `Products with no band are charged as "${fallback.title}"${fallback.isDefault ? ' (the default band)' : ' (the dearest band, as none is ticked default)'}.`
                    : 'Add at least one band. Until you do, checkout offers no delivery option.'}
                  suffix={!draft && <Button size="small" disabled={busy} onClick={() => setDraft({ ...EMPTY_DRAFT, isDefault: bands.length === 0 })}>Add band</Button>} />
                {draft && (
                  <Card.Content>
                    <Box gap="SP3" verticalAlign="bottom">
                      <FormField label="Name (shown at checkout)">
                        <Input value={draft.title} placeholder="e.g. Large letter" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      </FormField>
                      <FormField label="Price (£)">
                        <Input value={draft.price} type="number" placeholder="1.55" onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                      </FormField>
                      <FormField label="Delivery time (optional)">
                        <Input value={draft.deliveryTime} placeholder="e.g. 2-3 working days" onChange={(e) => setDraft({ ...draft, deliveryTime: e.target.value })} />
                      </FormField>
                      <Checkbox checked={draft.isDefault} onChange={() => setDraft({ ...draft, isDefault: !draft.isDefault })}>
                        Default for products with no band
                      </Checkbox>
                      <Box gap="SP2">
                        <Button size="small" priority="secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button>
                        <Button size="small" disabled={busy} onClick={onSaveBand}>{draft._id ? 'Save' : 'Add'}</Button>
                      </Box>
                    </Box>
                  </Card.Content>
                )}
                {bands.length > 0 && <Table data={bands} columns={bandColumns} rowVerticalPadding="medium"><Table.Content /></Table>}
              </Card>
            )}

            {rows && bands && (
              <Card>
                <Table data={shown} columns={productColumns} rowVerticalPadding="small">
                  <TableToolbar>
                    <TableToolbar.ItemGroup position="start">
                      <TableToolbar.Item><Text weight="bold">Products</Text></TableToolbar.Item>
                      <TableToolbar.Item>
                        <Dropdown size="small" border="round" options={filterOptions} selectedId={filter}
                          onSelect={(o) => setFilter(String(o.id))} />
                      </TableToolbar.Item>
                      <TableToolbar.Item>
                        <Box width="220px"><Search size="small" value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} /></Box>
                      </TableToolbar.Item>
                    </TableToolbar.ItemGroup>
                    <TableToolbar.ItemGroup position="end">
                      <TableToolbar.Item>
                        <Box width="240px">
                          <Dropdown size="small" placeholder="Set band for all shown…" options={bandOptions}
                            selectedId={bulkBand} disabled={busy || !bands.length} onSelect={(o) => setBulkBand(String(o.id))} />
                        </Box>
                      </TableToolbar.Item>
                      <TableToolbar.Item>
                        <Button size="small" priority="secondary" disabled={busy || bulkBand === undefined || shown.length === 0} onClick={onBulk}>
                          Apply to {shown.length}
                        </Button>
                      </TableToolbar.Item>
                    </TableToolbar.ItemGroup>
                  </TableToolbar>
                  {catalog === 'STORES_NOT_INSTALLED' ? (
                    <Box padding="SP6"><Text secondary>Wix Stores isn't installed on this site, so there are no products to band.</Text></Box>
                  ) : shown.length === 0 ? (
                    <Box padding="SP6"><Text secondary>No products match.</Text></Box>
                  ) : (
                    <Table.Content />
                  )}
                </Table>
              </Card>
            )}
          </Box>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default ShippingBandsPage;
