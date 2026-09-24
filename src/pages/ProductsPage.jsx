import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Download,
  Filter,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from './DashboardPage.jsx';

const filters = [
  { id: 'all', label: 'All products' },
  { id: 'low', label: 'Needs reordering' },
  { id: 'healthy', label: 'In good shape' },
];

function ProductArt({ product }) {
  return <span className={`product-art product-art--${product.color || 'sage'}`}>{product.emoji || '📦'}</span>;
}

function StockLevel({ product }) {
  const reference = Math.max(product.reorderPoint * 2, product.quantity, 1);
  const percent = Math.min(100, (product.quantity / reference) * 100);
  return (
    <div className="stock-level">
      <div className="stock-level-top"><strong className={product.lowStock ? 'stock-low-text' : ''}>{product.quantity}</strong><span> / {product.reorderPoint} min.</span></div>
      <span className="stock-meter"><i className={product.lowStock ? 'meter-low' : ''} style={{ width: `${Math.max(product.quantity === 0 ? 0 : 5, percent)}%` }} /></span>
    </div>
  );
}

function EmptyProducts({ searching, onAdd, onClear }) {
  return (
    <div className="empty-table-state">
      <span className="empty-state-icon">{searching ? <Search size={21} /> : <Package size={21} />}</span>
      <h3>{searching ? 'No matches just yet.' : 'Your shelves are a blank canvas.'}</h3>
      <p>{searching ? 'Try a different name, SKU, category, or supplier.' : 'Add your first product to start keeping track of stock and supplier details.'}</p>
      {searching ? <button className="button button-secondary" onClick={onClear}>Clear search</button> : <button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add your first product</button>}
    </div>
  );
}

export default function ProductsPage({ products = [], searchQuery = '', onSearch, onAdd, onEdit, onAdjust, onDelete, onExport, exporting }) {
  const [filter, setFilter] = useState('all');
  const [sortNewest, setSortNewest] = useState(false);
  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = products.filter((product) => {
      const matchesQuery = !query || [product.name, product.sku, product.category, product.supplier, product.location]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFilter = filter === 'all' || (filter === 'low' ? product.lowStock : !product.lowStock);
      return matchesQuery && matchesFilter;
    });
    if (sortNewest) list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [filter, products, searchQuery, sortNewest]);
  const lowCount = products.filter((product) => product.lowStock).length;

  return (
    <div className="page-stack">
      <div className="page-heading compact-heading">
        <div><span className="section-kicker">THE WHOLE SHELF, IN ONE PLACE</span><h1>Your products<span className="heading-period">.</span></h1><p>Keep the little details close, so the day-to-day feels lighter.</p></div>
        <div className="heading-actions"><button className="button button-secondary" onClick={onExport} disabled={exporting}><Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}</button><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add a product</button></div>
      </div>

      <div className="products-summary-strip">
        <div className="summary-chip"><span className="summary-chip-dot dot-sage" /><strong>{products.length}</strong> products in your catalog</div>
        <span className="summary-divider" />
        <div className="summary-chip"><span className="summary-chip-dot dot-amber" /><strong>{lowCount}</strong> below reorder point</div>
        <span className="summary-divider" />
        <div className="summary-chip summary-chip-value"><span>On-hand value</span><strong>{formatCurrency(products.reduce((sum, product) => sum + product.stockValue, 0))}</strong></div>
      </div>

      <section className="panel products-panel">
        <div className="products-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Filter products">
            {filters.map(({ id, label }) => (
              <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(id)}>
                {label}{id === 'low' && lowCount > 0 && <span className="filter-count">{lowCount}</span>}
              </button>
            ))}
          </div>
          <div className="table-tools">
            <label className="table-search"><Search size={15} /><input value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="Find a product…" aria-label="Filter products by search" /></label>
            <button className={`table-tool-button ${sortNewest ? 'tool-active' : ''}`} onClick={() => setSortNewest((value) => !value)} title="Toggle newest first"><SlidersHorizontal size={15} /><span>Sort</span></button>
          </div>
        </div>

        {visibleProducts.length ? (
          <div className="table-scroll">
            <table className="data-table products-table">
              <thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SUPPLIER</th><th>STOCK LEVEL</th><th>UNIT COST</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td><div className="product-table-cell"><ProductArt product={product} /><span className="product-table-copy"><strong>{product.name}</strong><small>{product.sku}{product.location ? ` · ${product.location}` : ''}</small></span></div></td>
                    <td><span className="category-chip">{product.category}</span></td>
                    <td><span className="supplier-name">{product.supplier || <em>Not set</em>}</span></td>
                    <td><StockLevel product={product} /></td>
                    <td><span className="unit-cost">{formatCurrency(product.unitCost)}</span></td>
                    <td>{product.lowStock ? <span className={`status-pill ${product.quantity === 0 ? 'status-out' : 'status-low'}`}><span />{product.quantity === 0 ? 'Out of stock' : 'Reorder soon'}</span> : <span className="status-pill status-healthy"><span />In stock</span>}</td>
                    <td><div className="row-actions">
                      <button className="row-action" title={`Adjust stock for ${product.name}`} aria-label={`Adjust stock for ${product.name}`} onClick={() => onAdjust(product)}><ArrowDownUp size={15} /></button>
                      <button className="row-action" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}><Pencil size={14} /></button>
                      <button className="row-action row-action-danger" title={`Delete ${product.name}`} aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><Trash2 size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyProducts searching={Boolean(searchQuery || filter !== 'all')} onAdd={onAdd} onClear={() => { onSearch(''); setFilter('all'); }} />
        )}
        {visibleProducts.length > 0 && <div className="table-foot"><span>Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</span><span><Filter size={13} /> Stock levels update as you record sales and deliveries.</span></div>}
      </section>
    </div>
  );
}
