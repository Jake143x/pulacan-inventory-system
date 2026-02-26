import { useEffect, useState } from 'react';
import { config } from '../api/client';

export default function ConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    config.get()
      .then(setValues)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await config.update(values);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">System configuration</h1>
      {err && <p className="text-gray-300 text-sm mb-2">{err}</p>}
      <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-md card-3d">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default low stock threshold</label>
            <input
              type="number"
              min="0"
              value={values.LOW_STOCK_THRESHOLD ?? '10'}
              onChange={(e) => update('LOW_STOCK_THRESHOLD', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">Used when creating new products if not specified.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GCash QR code image URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={values.GCASH_QR_URL ?? ''}
              onChange={(e) => update('GCASH_QR_URL', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">When customers choose GCash at checkout, this QR image is shown for scanning. Use a direct link to your GCash QR image.</p>
          </div>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 btn-3d">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
