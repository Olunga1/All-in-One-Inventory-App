import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function StockForm({ product, onSave, onCancel }) {
  const [direction, setDirection] = useState('in');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ direction, quantity: Number(quantity), kind: direction === 'out' ? 'sale' : 'restock', note: note.trim() });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit}>
      <div className="adjust-product-card"><span className={`product-art product-art--${product?.color || 'sage'}`}>{product?.emoji || '📦'}</span><span><strong>{product?.name || 'Choose a product'}</strong><small>{product?.sku || 'Select from the catalog'}</small></span><span className="adjust-current"><strong>{product?.quantity ?? '—'}</strong><small>on hand</small></span></div>
      <div className="direction-toggle" role="group" aria-label="Stock movement type">
        <button type="button" onClick={() => setDirection('in')} className={direction === 'in' ? 'direction-option active direction-in' : 'direction-option'}><ArrowDownRight size={16} /> Receive stock</button>
        <button type="button" onClick={() => setDirection('out')} className={direction === 'out' ? 'direction-option active direction-out' : 'direction-option'}><ArrowUpRight size={16} /> Record a sale</button>
      </div>
      <label className="form-field"><span>How many units?</span><input type="number" min="1" max={direction === 'out' ? product?.quantity || 1 : 1000000} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required autoFocus /><small>{direction === 'out' ? 'This quantity will come out of on-hand stock.' : 'This quantity will be added to on-hand stock.'}</small></label>
      <label className="form-field"><span>Note <i>optional</i></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={direction === 'out' ? 'e.g. Shopify order #2051' : 'e.g. Delivery from Cedar & Sage'} maxLength={180} /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <span className="spinner spinner-light" /> : null}{busy ? 'Saving…' : direction === 'in' ? 'Add stock' : 'Record sale'}</button></div>
    </form>
  );
}
