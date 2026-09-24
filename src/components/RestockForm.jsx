import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ShoppingCart } from 'lucide-react';

function suggestedQuantity(product) {
  if (!product) return 1;
  const demandDuringLeadTime = Math.ceil((product.weeklySales * product.leadTimeDays) / 7);
  return Math.max(1, product.reorderPoint * 2 - product.quantity, demandDuringLeadTime + product.reorderPoint - product.quantity);
}

export default function RestockForm({ restock, products = [], initialProduct, initialQuantity, onSave, onCancel }) {
  const initialProductId = restock?.productId || initialProduct?.id || products[0]?.id || '';
  const [productId, setProductId] = useState(initialProductId);
  const selectedProduct = useMemo(() => products.find((product) => product.id === productId) || initialProduct, [initialProduct, productId, products]);
  const [quantity, setQuantity] = useState(restock?.quantity ?? initialQuantity ?? suggestedQuantity(selectedProduct));
  const [supplier, setSupplier] = useState(restock?.supplier ?? selectedProduct?.supplier ?? '');
  const [expectedDate, setExpectedDate] = useState(restock?.expectedDate || '');
  const [status, setStatus] = useState(restock?.status || 'ordered');
  const [note, setNote] = useState(restock?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const product = products.find((item) => item.id === productId) || initialProduct;
    if (!restock) {
      setSupplier(product?.supplier || '');
      setQuantity(initialQuantity ?? suggestedQuantity(product));
    }
  }, [initialProduct, initialQuantity, productId, products, restock]);

  const changeProduct = (event) => {
    const nextId = event.target.value;
    setProductId(nextId);
    const product = products.find((item) => item.id === nextId);
    setSupplier(product?.supplier || '');
    if (!restock) setQuantity(suggestedQuantity(product));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ productId, quantity: Number(quantity), supplier: supplier.trim(), expectedDate, status, note: note.trim() });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit}>
      {products.length ? (
        <>
          <label className="form-field"><span>Product</span><select value={productId} onChange={changeProduct} required>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
          <div className="selected-product-stock"><span className={`product-art product-art--${selectedProduct?.color || 'sage'}`}>{selectedProduct?.emoji || '📦'}</span><span><strong>{selectedProduct?.quantity ?? 0} on hand</strong><small>Reorder point: {selectedProduct?.reorderPoint ?? 0}</small></span><span className="suggestion-qty-label">Suggested: {suggestedQuantity(selectedProduct)}</span></div>
        </>
      ) : <div className="form-error">Add a product before creating a purchase order.</div>}
      <div className="form-two-col">
        <label className="form-field"><span>Order quantity</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        <label className="form-field"><span>Supplier</span><input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Supplier name" maxLength={100} /></label>
        <label className="form-field"><span>Expected delivery <i>optional</i></span><div className="date-input"><CalendarDays size={15} /><input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></div></label>
        <label className="form-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Draft</option><option value="ordered">Ordered</option></select></label>
        <label className="form-field form-field-wide"><span>Order note <i>optional</i></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Colour, size, batch, or anything to remember…" maxLength={180} /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy || !products.length}>{busy ? <span className="spinner spinner-light" /> : <ShoppingCart size={15} />}{busy ? 'Saving…' : restock ? 'Save order' : 'Create purchase order'}</button></div>
    </form>
  );
}
