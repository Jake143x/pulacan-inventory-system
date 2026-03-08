import { useEffect, useState } from 'react';
import { products, uploadProductImage } from '../api/client';
import type { Product, ProductUnit } from '../api/client';

const CURRENCY = '₱';
const CARD_BG = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

const BoxIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const MAX_IMAGE_SIZE_MB = 2;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only JPG and PNG images are allowed.';
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return `Image must be under ${MAX_IMAGE_SIZE_MB}MB.`;
  return null;
}

export default function ProductManagementPage() {
  const [list, setList] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    specifications: '',
    unitPrice: '',
    imageUrl: '',
    status: 'active' as 'active' | 'inactive',
    initialQuantity: '0',
    lowStockThreshold: '10',
    reorderLevel: '10',
    reorderQuantity: '100',
    unitType: 'piece' as 'piece' | 'kg' | 'meter',
    saleUnit: '',
    allowCustomQuantity: false,
    minOrderQuantity: '',
    quantityStep: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitName: '', price: '', stock: '0' });
  const [addingUnit, setAddingUnit] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitForm, setEditUnitForm] = useState({ unitName: '', price: '', stock: '' });

  const load = () => {
    setLoading(true);
    Promise.all([
      products.list({ page: pagination.page, limit: pagination.limit, search: search.trim() || undefined, category: category || undefined }),
      products.categories(),
    ])
      .then(([r, cat]) => {
        setList(r.data);
        setPagination(r.pagination);
        setCategories(cat.data || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [pagination.page, pagination.limit, search, category]);

  const openAdd = () => {
    setForm({
      name: '',
      sku: '',
      category: '',
      description: '',
      specifications: '',
      unitPrice: '',
      imageUrl: '',
      status: 'active',
      initialQuantity: '0',
      lowStockThreshold: '10',
      reorderLevel: '10',
      reorderQuantity: '100',
      unitType: 'piece',
      saleUnit: '',
      allowCustomQuantity: false,
      minOrderQuantity: '',
      quantityStep: '',
    });
    setImageFile(null);
    setImageError('');
    setModal('add');
    setEditing(null);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setErr('');
    setUnitForm({ unitName: '', price: '', stock: '0' });
    setEditingUnitId(null);
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      category: p.category ?? '',
      description: p.description ?? '',
      specifications: typeof p.specifications === 'string' ? p.specifications : (p.specifications ? JSON.stringify(p.specifications) : ''),
      unitPrice: String(p.unitPrice),
      imageUrl: p.imageUrl ?? '',
      status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      initialQuantity: '0',
      lowStockThreshold: '10',
      reorderLevel: '10',
      reorderQuantity: '100',
      unitType: (p.unitType === 'kg' || p.unitType === 'meter' ? p.unitType : 'piece') as 'piece' | 'kg' | 'meter',
      saleUnit: p.saleUnit ?? '',
      allowCustomQuantity: p.allowCustomQuantity ?? false,
      minOrderQuantity: p.minOrderQuantity != null ? String(p.minOrderQuantity) : '',
      quantityStep: p.quantityStep != null ? String(p.quantityStep) : '',
    });
    setImageFile(null);
    setImageError('');
    setModal('edit');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageFile(file || null);
    setImageError('');
    if (file) {
      const msg = validateImage(file);
      if (msg) setImageError(msg);
    }
  };

  const saveAdd = async () => {
    setErr('');
    let imageUrl = form.imageUrl;
    if (imageFile) {
      const v = validateImage(imageFile);
      if (v) { setImageError(v); return; }
      try {
        const r = await uploadProductImage(imageFile);
        imageUrl = r.url;
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Image upload failed');
        return;
      }
    }
    try {
      await products.create({
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
        specifications: form.specifications || undefined,
        unitPrice: Number(form.unitPrice),
        imageUrl: imageUrl || undefined,
        status: form.status,
        initialQuantity: Number(form.initialQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        reorderLevel: Number(form.reorderLevel),
        reorderQuantity: Number(form.reorderQuantity),
        unitType: form.unitType,
        saleUnit: form.saleUnit || undefined,
        allowCustomQuantity: form.allowCustomQuantity,
        minOrderQuantity: form.minOrderQuantity !== '' ? Number(form.minOrderQuantity) : undefined,
        quantityStep: form.quantityStep !== '' ? Number(form.quantityStep) : undefined,
      });
      setModal(null);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setErr('');
    setImageError('');
    let imageUrl = form.imageUrl;
    if (imageFile) {
      const v = validateImage(imageFile);
      if (v) {
        setImageError(v);
        setErr(v);
        return;
      }
      setSaving(true);
      try {
        const r = await uploadProductImage(imageFile);
        imageUrl = r.url;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Image upload failed';
        setErr(msg);
        setSaving(false);
        return;
      }
    }
    setSaving(true);
    try {
      await products.update(editing.id, {
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
        specifications: form.specifications || undefined,
        unitPrice: Number(form.unitPrice),
        imageUrl: imageUrl || undefined,
        status: form.status,
        unitType: form.unitType,
        saleUnit: form.saleUnit || undefined,
        allowCustomQuantity: form.allowCustomQuantity,
        minOrderQuantity: form.minOrderQuantity !== '' ? Number(form.minOrderQuantity) : undefined,
        quantityStep: form.quantityStep !== '' ? Number(form.quantityStep) : undefined,
      });
      setModal(null);
      setEditing(null);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Delete this product? This will also remove its inventory record.')) return;
    try {
      await products.delete(id);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const refreshEditingProduct = async () => {
    if (!editing) return;
    try {
      const updated = await products.get(editing.id);
      setEditing(updated);
    } catch {
      // ignore
    }
  };

  const addUnit = async () => {
    if (!editing) return;
    const unitName = unitForm.unitName.trim();
    const price = Number(unitForm.price);
    const stock = Number(unitForm.stock) || 0;
    if (!unitName || !Number.isFinite(price) || price < 0) {
      setErr('Unit name and price (≥ 0) are required.');
      return;
    }
    setAddingUnit(true);
    setErr('');
    try {
      await products.addUnit(editing.id, { unitName, price, stock });
      setUnitForm({ unitName: '', price: '', stock: '0' });
      await refreshEditingProduct();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add unit');
    } finally {
      setAddingUnit(false);
    }
  };

  const updateUnit = async (unitId: number) => {
    if (!editing) return;
    const unitName = editUnitForm.unitName.trim();
    const price = Number(editUnitForm.price);
    const stock = Number(editUnitForm.stock);
    if (!unitName || !Number.isFinite(price) || price < 0) {
      setErr('Unit name and price (≥ 0) are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await products.updateUnit(editing.id, unitId, { unitName, price, stock: Number.isFinite(stock) && stock >= 0 ? stock : undefined });
      setEditingUnitId(null);
      await refreshEditingProduct();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to update unit');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (unitId: number) => {
    if (!editing || !confirm('Remove this purchase unit?')) return;
    try {
      await products.deleteUnit(editing.id, unitId);
      await refreshEditingProduct();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete unit');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border text-sm placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/40"
            style={{ ...CARD_BG, color: 'var(--admin-text)' }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-w-[160px] h-10 px-4 rounded-xl border text-sm focus:ring-2 focus:ring-[#2563EB]/40"
          style={{ ...CARD_BG, color: 'var(--admin-text)' }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="button" onClick={openAdd} className="flex items-center gap-2 h-10 px-4 rounded-xl font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] btn-3d shrink-0">
          <span className="text-lg leading-none">+</span> Add Product
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden card-3d" style={CARD_BG}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="border-b" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">No products found.</td></tr>
              ) : (
                list.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'var(--admin-border)' }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BoxIcon />
                          )}
                        </div>
                        <span className="font-medium" style={{ color: 'var(--admin-text)' }}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300">{p.sku ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-slate-300">{p.category ?? '—'}</td>
                    <td className="px-5 py-4 text-sm font-medium tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{p.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${p.status === 'inactive' ? 'bg-slate-500/20 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {p.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(p)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" title="Edit"><PencilIcon /></button>
                        <button type="button" onClick={() => deleteProduct(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10" title="Delete"><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2 py-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50" style={CARD_BG}>Prev</button>
            <span className="py-1 text-sm text-slate-400">Page {pagination.page} of {pagination.pages}</span>
            <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50" style={CARD_BG}>Next</button>
          </div>
        )}
      </div>

      {/* Add modal */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-lg w-full card-3d shadow-xl max-h-[90vh] overflow-y-auto" style={CARD_BG}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Add Product</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="Specifications" value={form.specifications} onChange={(e) => setForm((f) => ({ ...f, specifications: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="number" step="0.01" placeholder="Unit price *" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <div>
                <label className="block text-sm text-slate-400 mb-1">Product image (JPG/PNG, max 2MB)</label>
                <input type="file" accept=".jpg,.jpeg,.png" onChange={handleImageChange} className="w-full text-sm" />
                {imageError && <p className="text-red-400 text-xs mt-1">{imageError}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Status</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status-add" checked={form.status === 'active'} onChange={() => setForm((f) => ({ ...f, status: 'active' }))} className="rounded-full" />
                  <span style={{ color: 'var(--admin-text)' }}>Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status-add" checked={form.status === 'inactive'} onChange={() => setForm((f) => ({ ...f, status: 'inactive' }))} className="rounded-full" />
                  <span style={{ color: 'var(--admin-text)' }}>Inactive</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Unit type</label>
                <select value={form.unitType} onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value as 'piece' | 'kg' | 'meter' }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white" style={{ borderColor: 'var(--admin-border)' }}>
                  <option value="piece">Piece</option>
                  <option value="kg">Kg</option>
                  <option value="meter">Meter</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Initial quantity</label>
                <input type="number" min="0" placeholder="Initial quantity" value={form.initialQuantity} onChange={(e) => setForm((f) => ({ ...f, initialQuantity: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Low stock threshold</label>
                <input type="number" min="0" placeholder="Alert when stock falls below this number" value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveAdd} disabled={!form.name.trim() || !form.unitPrice} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] btn-3d disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 border rounded-xl hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal === 'edit' && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-lg w-full card-3d shadow-xl max-h-[90vh] overflow-y-auto" style={CARD_BG}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Edit Product</h2>
            {err && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>}
            <div className="space-y-3">
              <input type="text" placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="text" placeholder="Specifications" value={form.specifications} onChange={(e) => setForm((f) => ({ ...f, specifications: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="number" step="0.01" placeholder="Unit price *" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <div>
                <label className="block text-sm text-slate-400 mb-1">Product image (JPG/PNG, max 2MB) — optional, replace current</label>
                <input type="file" accept=".jpg,.jpeg,.png" onChange={handleImageChange} className="w-full text-sm" />
                {imageError && <p className="text-red-400 text-xs mt-1">{imageError}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Status</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status-edit" checked={form.status === 'active'} onChange={() => setForm((f) => ({ ...f, status: 'active' }))} className="rounded-full" />
                  <span style={{ color: 'var(--admin-text)' }}>Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status-edit" checked={form.status === 'inactive'} onChange={() => setForm((f) => ({ ...f, status: 'inactive' }))} className="rounded-full" />
                  <span style={{ color: 'var(--admin-text)' }}>Inactive</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Unit type</label>
                <select value={form.unitType} onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value as 'piece' | 'kg' | 'meter' }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white" style={{ borderColor: 'var(--admin-border)' }}>
                  <option value="piece">Piece</option>
                  <option value="kg">Kg</option>
                  <option value="meter">Meter</option>
                </select>
              </div>
              <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--admin-border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--admin-text)' }}>Purchase units (optional)</h3>
                <p className="text-xs text-slate-500 mb-3">When set, customers choose how to buy (e.g. kg, piece, box). Each unit has its own price and stock.</p>
                {(editing?.productUnits && editing.productUnits.length > 0) && (
                  <ul className="space-y-2 mb-4">
                    {editing.productUnits.map((u: ProductUnit) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                        {editingUnitId === u.id ? (
                          <>
                            <input type="text" value={editUnitForm.unitName} onChange={(e) => setEditUnitForm((f) => ({ ...f, unitName: e.target.value }))} placeholder="Unit name" className="w-24 px-2 py-1 rounded border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                            <input type="number" step="0.01" value={editUnitForm.price} onChange={(e) => setEditUnitForm((f) => ({ ...f, price: e.target.value }))} placeholder="Price" className="w-20 px-2 py-1 rounded border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                            <input type="number" step="0.01" value={editUnitForm.stock} onChange={(e) => setEditUnitForm((f) => ({ ...f, stock: e.target.value }))} placeholder="Stock" className="w-16 px-2 py-1 rounded border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                            <button type="button" onClick={() => updateUnit(u.id)} disabled={saving} className="px-2 py-1 text-xs font-medium text-white bg-[#2563EB] rounded hover:bg-[#1D4ED8] disabled:opacity-50">Save</button>
                            <button type="button" onClick={() => { setEditingUnitId(null); setErr(''); }} className="px-2 py-1 text-xs rounded border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{u.unitName}</span>
                            <span className="text-slate-400 text-sm">{CURRENCY}{u.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500 text-xs">stock: {u.stock}</span>
                            <button type="button" onClick={() => { setEditingUnitId(u.id); setEditUnitForm({ unitName: u.unitName, price: String(u.price), stock: String(u.stock) }); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10" title="Edit unit"><PencilIcon /></button>
                            <button type="button" onClick={() => deleteUnit(u.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-white/10" title="Delete unit"><TrashIcon /></button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <input type="text" value={unitForm.unitName} onChange={(e) => setUnitForm((f) => ({ ...f, unitName: e.target.value }))} placeholder="Unit (e.g. kg, box)" className="w-28 px-3 py-2 rounded-lg border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                  <input type="number" step="0.01" value={unitForm.price} onChange={(e) => setUnitForm((f) => ({ ...f, price: e.target.value }))} placeholder="Price" className="w-24 px-3 py-2 rounded-lg border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                  <input type="number" step="0.01" min="0" value={unitForm.stock} onChange={(e) => setUnitForm((f) => ({ ...f, stock: e.target.value }))} placeholder="Stock" className="w-20 px-3 py-2 rounded-lg border text-sm" style={{ ...CARD_BG, borderColor: 'var(--admin-border)' }} />
                  <button type="button" onClick={addUnit} disabled={addingUnit || !unitForm.unitName.trim()} className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50">{addingUnit ? 'Adding...' : 'Add unit'}</button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveEdit} disabled={!form.name.trim() || !form.unitPrice || saving} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] btn-3d disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => { setModal(null); setEditing(null); setErr(''); }} disabled={saving} className="px-4 py-2.5 border rounded-xl hover:bg-white/10 disabled:opacity-50" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {err && <div className="rounded-xl border p-3 text-red-400 text-sm" style={{ borderColor: 'var(--admin-border)' }}>{err}</div>}
    </div>
  );
}
