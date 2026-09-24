import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';

export function formatCurrency(value, compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(Number(value || 0));
}

export function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function movementDescription(movement) {
  if (movement.kind === 'sale') return 'Sold';
  if (movement.kind === 'restock') return 'Restocked';
  if (movement.kind === 'initial') return 'Opening stock';
  return 'Stock adjusted';
}

function movementTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return formatDate(value);
}

function PageHeading({ user, onAddProduct, onRestock }) {
  const firstName = user?.name?.split(' ')[0] || 'there';
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  return (
    <div className="page-heading dashboard-heading">
      <div>
        <div className="heading-date"><span className="live-dot" />{date}</div>
        <h1>Good to see you, {firstName}<span className="heading-period">.</span></h1>
        <p>Here’s what’s happening in your stockroom today.</p>
      </div>
      <div className="heading-actions">
        <button className="button button-secondary" onClick={onRestock}><RefreshCw size={15} /> Restock queue</button>
        <button className="button button-primary" onClick={onAddProduct}><Plus size={16} /> Add a product</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone, onClick }) {
  return (
    <button className={`stat-card ${onClick ? 'stat-card-clickable' : ''}`} onClick={onClick} disabled={!onClick}>
      <div className="stat-top"><span className={`stat-icon stat-icon-${tone}`}><Icon size={18} strokeWidth={1.85} /></span><span className="stat-label">{label}</span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </button>
  );
}

function ActivityChart({ activity = [] }) {
  const maxValue = Math.max(1, ...activity.map((entry) => Math.max(entry.incoming, entry.outgoing)));
  return (
    <section className="panel activity-chart-panel">
      <div className="panel-header">
        <div><h2>Stock movement</h2><p>Units in and out over the last 7 days</p></div>
        <div className="chart-legend"><span><i className="legend-dot legend-in" />Received</span><span><i className="legend-dot legend-out" />Sold</span></div>
      </div>
      <div className="activity-chart" role="img" aria-label="Bar chart of stock received and sold during the past seven days">
        <div className="chart-y-labels"><span>{Math.ceil(maxValue)}</span><span>{Math.ceil(maxValue / 2)}</span><span>0</span></div>
        <div className="chart-main">
          <div className="chart-grid-lines"><i /><i /><i /></div>
          <div className="chart-columns">
            {activity.map((day) => {
              const inHeight = day.incoming ? Math.max(8, (day.incoming / maxValue) * 100) : 3;
              const outHeight = day.outgoing ? Math.max(8, (day.outgoing / maxValue) * 100) : 3;
              return (
                <div className="chart-day" key={day.date} title={`${day.label}: ${day.incoming} received, ${day.outgoing} sold`}>
                  <div className="chart-bars">
                    <span className={`chart-bar chart-bar-in ${day.incoming ? '' : 'chart-bar-empty'}`} style={{ height: `${inHeight}%` }} />
                    <span className={`chart-bar chart-bar-out ${day.outgoing ? '' : 'chart-bar-empty'}`} style={{ height: `${outHeight}%` }} />
                  </div>
                  <span className="chart-day-label">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function LowStockPanel({ products = [], totalCount = products.length, onNavigate, onQuickRestock }) {
  return (
    <section className="panel low-stock-panel">
      <div className="panel-header">
        <div><h2>Needs a little love</h2><p>Products at or below your reorder point</p></div>
        <span className="attention-counter">{totalCount}</span>
      </div>
      {products.length ? (
        <div className="low-stock-list">
          {products.slice(0, 3).map((product) => (
            <div className="low-stock-row" key={product.id}>
              <span className={`product-art product-art--${product.color}`}>{product.emoji}</span>
              <div className="low-stock-copy"><strong>{product.name}</strong><span>{product.supplier || 'Supplier not set'}</span></div>
              <div className="low-stock-quantity"><strong>{product.quantity}</strong><span>left</span></div>
              <button className="quick-order-button" onClick={() => onQuickRestock(product)} aria-label={`Create restock for ${product.name}`} title="Create a purchase order"><Plus size={16} /></button>
            </div>
          ))}
          <button className="panel-link" onClick={() => onNavigate('restock')}>Open restock queue <ArrowRight size={14} /></button>
        </div>
      ) : (
        <div className="all-clear"><span><Package size={19} /></span><strong>Looking good.</strong><p>Nothing needs reordering right now.</p></div>
      )}
    </section>
  );
}

function RecentMovement({ movements = [], onNavigate }) {
  return (
    <section className="panel recent-panel">
      <div className="panel-header">
        <div><h2>Recent activity</h2><p>The latest changes across your stock</p></div>
        <button className="panel-link panel-link-inline" onClick={() => onNavigate('activity')}>View all <ArrowRight size={14} /></button>
      </div>
      {movements.length ? (
        <div className="recent-list">
          {movements.slice(0, 5).map((movement) => {
            const isIncoming = movement.quantityChange > 0;
            return (
              <div className="recent-row" key={movement.id}>
                <span className={`movement-indicator ${isIncoming ? 'movement-in' : 'movement-out'}`}>{isIncoming ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</span>
                <span className={`movement-product-art product-art--${movement.color}`}>{movement.emoji}</span>
                <span className="recent-product"><strong>{movement.productName}</strong><small>{movement.note || movementDescription(movement)}</small></span>
                <span className={`movement-amount ${isIncoming ? 'amount-in' : 'amount-out'}`}>{isIncoming ? '+' : '−'}{Math.abs(movement.quantityChange)}</span>
                <span className="movement-time">{movementTime(movement.createdAt)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="inline-empty"><span>No stock movements yet.</span><button onClick={() => onNavigate('products')}>Browse products</button></div>
      )}
    </section>
  );
}

function Bestsellers({ products = [] }) {
  const maxSales = Math.max(1, ...products.map((product) => product.weeklySales));
  return (
    <section className="panel bestsellers-panel">
      <div className="panel-header"><div><h2>Moving nicely</h2><p>Your weekly bestsellers</p></div><span className="tiny-label">UNITS / WK</span></div>
      {products.length ? (
        <div className="bestseller-list">
          {products.slice(0, 4).map((product, index) => (
            <div className="bestseller-row" key={product.id}>
              <span className="bestseller-rank">0{index + 1}</span>
              <span className={`bestseller-art product-art--${product.color}`}>{product.emoji}</span>
              <span className="bestseller-copy"><strong>{product.name}</strong><span className="bestseller-meter"><i style={{ width: `${Math.max(8, (product.weeklySales / maxSales) * 100)}%` }} /></span></span>
              <strong className="bestseller-count">{product.weeklySales}</strong>
            </div>
          ))}
        </div>
      ) : <div className="inline-empty"><span>Add a product to see what’s moving.</span></div>}
    </section>
  );
}

function FirstProductEmpty({ onAddProduct }) {
  return (
    <section className="empty-workspace panel">
      <div className="empty-art"><span>🕯️</span><span>🌿</span><span>📦</span><i><Boxes size={25} /></i></div>
      <div className="empty-copy"><span className="section-kicker">YOUR FIRST SHELF STARTS HERE</span><h2>Let’s make some room for good things.</h2><p>Add the products you sell, set a comfy reorder point, and your stockroom will take it from there.</p><button className="button button-primary" onClick={onAddProduct}><Plus size={16} /> Add your first product</button></div>
      <div className="empty-footnote"><span><TriangleAlert size={14} /> Your workspace is private to you.</span><span><CircleDollarSign size={14} /> No spreadsheet formulas required.</span></div>
    </section>
  );
}

export default function DashboardPage({ user, dashboard, onNavigate, onAddProduct, onQuickRestock }) {
  const stats = dashboard?.stats || {};
  const hasProducts = stats.products > 0;
  return (
    <div className="page-stack">
      <PageHeading user={user} onAddProduct={onAddProduct} onRestock={() => onQuickRestock(null)} />
      {hasProducts ? (
        <>
          <div className="stats-grid">
            <StatCard label="Inventory value" value={formatCurrency(stats.stockValue, true)} detail="At your unit cost" icon={CircleDollarSign} tone="green" />
            <StatCard label="Units on hand" value={Number(stats.totalUnits || 0).toLocaleString()} detail="Across your whole catalog" icon={Boxes} tone="blue" />
            <StatCard label="Products" value={Number(stats.products || 0).toLocaleString()} detail="Active items in your shop" icon={Package} tone="lilac" onClick={() => onNavigate('products')} />
            <StatCard label="Needs attention" value={Number(stats.lowStock || 0).toString().padStart(2, '0')} detail={stats.lowStock ? 'At or below reorder point' : 'Your shelves look healthy'} icon={TriangleAlert} tone={stats.lowStock ? 'amber' : 'green'} onClick={() => onNavigate('restock')} />
          </div>
          <div className="dashboard-grid dashboard-grid-top">
            <ActivityChart activity={dashboard?.activityByDay || []} />
            <LowStockPanel products={dashboard?.lowStockProducts || []} totalCount={stats.lowStock || 0} onNavigate={onNavigate} onQuickRestock={onQuickRestock} />
          </div>
          <div className="dashboard-grid dashboard-grid-bottom">
            <RecentMovement movements={dashboard?.recentMovements || []} onNavigate={onNavigate} />
            <Bestsellers products={dashboard?.topProducts || []} />
          </div>
          <div className="dashboard-footnote"><span><ShoppingCart size={14} /> Open purchase orders: <strong>{stats.openRestocks || 0}</strong></span><button onClick={() => onNavigate('restock')}>Review orders <ArrowRight size={13} /></button></div>
        </>
      ) : <FirstProductEmpty onAddProduct={onAddProduct} />}
    </div>
  );
}
