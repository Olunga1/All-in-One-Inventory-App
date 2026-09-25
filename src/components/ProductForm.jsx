import { useEffect, useState } from 'react';
import { Check, Package, Save } from 'lucide-react';

const defaultValues = {
  name: '', sku: '', category: 'Candles', supplier: '', quantity: 0, reorderPoint: 8,
  unitCost: 0, leadTimeDays: 7, weeklySales: 0, location: '', emoji: '🕯️', color: 'sand',
};
const emojis = ['🕯️', '🌿', '🧼', '🏺', '🎁', '📦', '🧴', '✂️', '🧺', '📜'];
const colors = ['sand', 'sage', 'peach', 'clay', 'lilac', 'blue'];

function NumberField({ label, value, name, onChange, min = 0, step = 1, help, prefix }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <div className={prefix ? 'input-with-prefix' : ''}>{prefix && <i>{prefix}</i>}<input type="number" name={name} min={min} step={step} value={value} onChange={onChange} required /></div>
      {help && <small>{help}</small>}
    </label>
  );
}

export default function ProductForm({ product, onSave, onCancel }) {
  const [values, setValues] = useState({ ...defaultValues, ...(product || {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setValues({ ...defaultValues, ...(product || {}) }), [product?.id]);
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...values,
        quantity: Number(values.quantity),
        reorderPoint: Number(values.reorderPoint),
        unitCost: Number(values.unitCost),
        leadTimeDays: Number(values.leadTimeDays),
        weeklySales: Number(values.weeklySales),
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit}>
      <div className="form-two-col">
        <label className="form-field form-field-wide"><span>Product name <b>*</b></span><input name="name" value={values.name} onChange={update} placeholder="e.g. Sunroom soy candle · 8 oz" required minLength={2} maxLength={120} autoFocus /></label>
        <label className="form-field"><span>SKU</span><input name="sku" value={values.sku} onChange={update} placeholder="Auto-generated if blank" maxLength={40} /><small>A short code to find this item fast.</small></label>
        <label className="form-field"><span>Category</span><input name="category" value={values.category} onChange={update} placeholder="Candles, packaging…" maxLength={60} list="product-categories" /><datalist id="product-categories"><option value="Candles" /><option value="Bath & body" /><option value="Accessories" /><option value="Gift sets" /><option value="Packaging" /><option value="Home fragrance" /></datalist></label>
        <label className="form-field"><span>Supplier</span><input name="supplier" value={values.supplier} onChange={update} placeholder="Who makes or supplies it?" maxLength={100} /></label>
        <label className="form-field"><span>Storage location</span><input name="location" value={values.location} onChange={update} placeholder="e.g. Shelf A · Back room" maxLength={100} /></label>
      </div>
      <div className="form-section-label"><Package size={14} /> STOCK &amp; REORDER</div>
      <div className="form-three-col">
        <NumberField label="On hand" name="quantity" value={values.quantity} onChange={update} help="Current sellable units." />
        <NumberField label="Reorder when at" name="reorderPoint" value={values.reorderPoint} onChange={update} help="Your low-stock nudge." />
        <NumberField label="Unit cost" name="unitCost" value={values.unitCost} onChange={update} min="0" step="0.01" prefix="$" help="What one unit costs you." />
        <NumberField label="Supplier lead time" name="leadTimeDays" value={values.leadTimeDays} onChange={update} help="Delivery time in days." />
        <NumberField label="Typical sales / week" name="weeklySales" value={values.weeklySales} onChange={update} min="0" step="0.1" help="A rough weekly average." />
      </div>
      <div className="product-style-row">
        <label className="form-field"><span>Product marker</span><select name="emoji" value={values.emoji} onChange={update}>{emojis.map((emoji) => <option key={emoji} value={emoji}>{emoji} Use marker</option>)}</select></label>
        <fieldset className="color-picker"><legend>Tile color</legend><div>{colors.map((color) => <button type="button" key={color} className={`color-swatch swatch-${color} ${values.color === color ? 'selected' : ''}`} aria-label={`Use ${color} tile`} aria-pressed={values.color === color} onClick={() => setValues((current) => ({ ...current, color }))}>{values.color === color && <Check size={12} />}</button>)}</div></fieldset>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <span className="spinner spinner-light" /> : <Save size={15} />}{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button></div>
    </form>
  );
}
