import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Edit2,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import { formatDate } from './DashboardPage.jsx';

function recommendedQuantity(product) {
  const leadTimeDemand = Math.ceil((product.weeklySales * product.leadTimeDays) / 7);
  return Math.max(1, product.reorderPoint * 2 - product.quantity, leadTimeDemand + product.reorderPoint - product.quantity);
}

function RestockSuggestion({ product, onCreate }) {
  const suggested = recommendedQuantity(product);
  const severity = product.quantity === 0 ? 'urgent' : 'soon';
  return (
    <article className="restock-suggestion">
      <span className={`suggestion-product-art product-art--${product.color}`}>{product.emoji}</span>
      <div className="suggestion-details">
        <div className="suggestion-title"><strong>{product.name}</strong><span className={`urgency-label urgency-${severity}`}>{product.quantity === 0 ? 'Out of stock' : `${product.quantity} left`}</span></div>
        <span className="suggestion-meta">{product.supplier || 'Add a supplier'} <i /> Reorder at {product.reorderPoint}</span>
        <div className="suggestion-foot"><span>Suggested order <strong>{suggested} units</strong></span><button className="button button-small button-primary" onClick={() => onCreate(product, suggested)}><Plus size={14} /> Create order</button></div>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const label = status === 'received' ? 'Received' : status === 'draft' ? 'Draft' : 'On the way';
  return <span className={`status-pill po-status status-${status}`}><span />{label}</span>;
}

function OrderActions({ order, onEdit, onReceive, onDelete }) {
  if (order.status === 'received') return <span className="received-label"><CheckCheck size={14} /> Received</span>;
  return (
    <div className="row-actions restock-actions">
      {order.status === 'draft' && <button className="row-action" title="Mark as ordered" aria-label="Mark as ordered" onClick={() => onReceive(order, 'ordered')}><Truck size={15} /></button>}
      <button className="row-action" title={order.status === 'draft' ? 'Edit order' : 'Edit expected delivery'} aria-label="Edit purchase order" onClick={() => onEdit(order)}><Edit2 size={14} /></button>
      <button className="row-action row-action-good" title="Mark as received" aria-label="Mark as received" onClick={() => onReceive(order, 'received')}><Check size={15} /></button>
      <button className="row-action row-action-danger" title="Delete purchase order" aria-label="Delete purchase order" onClick={() => onDelete(order)}><Trash2 size={14} /></button>
    </div>
  );
}

function OrdersTable({ orders, onEdit, onReceive, onDelete }) {
  if (!orders.length) {
    return <div className="empty-orders"><span className="empty-state-icon"><ShoppingCart size={20} /></span><strong>No orders here yet.</strong><p>Create a purchase order from a low-stock suggestion or add one manually.</p></div>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table orders-table">
        <thead><tr><th>PRODUCT</th><th>SUPPLIER</th><th>QUANTITY</th><th>EXPECTED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><div className="product-table-cell"><span className={`product-art product-art--${order.color}`}>{order.emoji}</span><span className="product-table-copy"><strong>{order.productName}</strong><small>{order.productSku} · PO-{order.id.slice(0, 4).toUpperCase()}</small></span></div></td>
              <td><span className="supplier-name">{order.supplier || <em>Not set</em>}</span></td>
              <td><span className="order-quantity">{order.quantity}<small> units</small></span></td>
              <td><span className="expected-date">{order.expectedDate ? formatDate(order.expectedDate, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</span></td>
              <td><StatusBadge status={order.status} /></td>
              <td><OrderActions order={order} onEdit={onEdit} onReceive={onReceive} onDelete={onDelete} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RestockPage({ products = [], restocks = [], onCreate, onEdit, onUpdateStatus, onDelete }) {
  const [showReceived, setShowReceived] = useState(false);
  const lowStock = useMemo(() => products.filter((product) => product.lowStock)
    .sort((a, b) => a.quantity - b.quantity), [products]);
  const activeOrders = restocks.filter((order) => order.status !== 'received');
  const receivedOrders = restocks.filter((order) => order.status === 'received');
  const openUnits = activeOrders.reduce((sum, order) => sum + order.quantity, 0);

  return (
    <div className="page-stack">
      <div className="page-heading compact-heading">
        <div><span className="section-kicker">BUY JUST ENOUGH, AT THE RIGHT TIME</span><h1>Restock, without the guesswork<span className="heading-period">.</span></h1><p>A tidy place for what’s running low and what’s already on its way.</p></div>
        <div className="heading-actions"><button className="button button-primary" onClick={() => onCreate(null)}><Plus size={16} /> New purchase order</button></div>
      </div>

      <div className="restock-stats-grid">
        <div className="restock-stat-card"><span className="restock-stat-icon stat-icon-amber"><Clock3 size={17} /></span><div><span>Needs a reorder</span><strong>{lowStock.length.toString().padStart(2, '0')} <small>products</small></strong></div></div>
        <div className="restock-stat-card"><span className="restock-stat-icon stat-icon-blue"><Truck size={17} /></span><div><span>Orders in progress</span><strong>{activeOrders.length.toString().padStart(2, '0')} <small>orders</small></strong></div></div>
        <div className="restock-stat-card"><span className="restock-stat-icon stat-icon-green"><PackageCheck size={17} /></span><div><span>Units on order</span><strong>{openUnits.toLocaleString()} <small>units</small></strong></div></div>
      </div>

      <section className="panel restock-recommendations">
        <div className="panel-header restock-panel-header">
          <div><div className="section-title-with-icon"><span className="panel-title-icon"><Clock3 size={17} /></span><h2>Worth a reorder</h2><span className="attention-counter">{lowStock.length}</span></div><p>Suggestions use your reorder point, recent sales pace, and supplier lead time.</p></div>
          <span className="recommendation-note">A starting point, not a hard rule</span>
        </div>
        {lowStock.length ? (
          <div className="restock-suggestion-grid">
            {lowStock.map((product) => <RestockSuggestion key={product.id} product={product} onCreate={onCreate} />)}
          </div>
        ) : (
          <div className="restock-all-clear"><span className="all-clear-check"><CheckCheck size={20} /></span><div><strong>Nothing asking for a reorder.</strong><p>You’re all caught up. We’ll surface products when they reach their reorder point.</p></div></div>
        )}
      </section>

      <section className="panel orders-panel">
        <div className="panel-header orders-header"><div><h2>Purchase orders</h2><p>Follow each delivery from draft to done.</p></div><button className="button button-quiet" onClick={() => setShowReceived((show) => !show)}>{showReceived ? 'View open orders' : `View received${receivedOrders.length ? ` · ${receivedOrders.length}` : ''}`} <ArrowRight size={14} /></button></div>
        <OrdersTable orders={showReceived ? receivedOrders : activeOrders} onEdit={onEdit} onReceive={onUpdateStatus} onDelete={onDelete} />
        {!showReceived && activeOrders.length > 0 && <div className="orders-foot"><span><Truck size={14} /> Tip: mark an order as received to update your stock automatically.</span><button onClick={() => setShowReceived(true)}>See completed orders <ArrowRight size={13} /></button></div>}
      </section>
    </div>
  );
}
