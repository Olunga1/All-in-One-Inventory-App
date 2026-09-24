import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Download,
  Filter,
  RotateCw,
  ShoppingBag,
} from 'lucide-react';
import { formatDate, movementDescription } from './DashboardPage.jsx';

function dateGroup(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(value, { weekday: 'long', month: 'long', day: 'numeric' });
}

function MovementIcon({ movement }) {
  if (movement.kind === 'sale') return <span className="movement-icon movement-icon-sale"><ShoppingBag size={16} /></span>;
  if (movement.kind === 'restock' || movement.kind === 'initial') return <span className="movement-icon movement-icon-restock"><ArrowDownRight size={17} /></span>;
  return <span className="movement-icon movement-icon-adjust"><RotateCw size={16} /></span>;
}

export default function ActivityPage({ movements = [], searchQuery = '', onSearch }) {
  const [kind, setKind] = useState('all');
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return movements.filter((movement) => {
      const matchKind = kind === 'all' || movement.kind === kind;
      const matchQuery = !query || [movement.productName, movement.productSku, movement.note, movement.kind]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchKind && matchQuery;
    });
  }, [kind, movements, searchQuery]);
  const groups = filtered.reduce((result, movement) => {
    const label = dateGroup(movement.createdAt);
    if (!result[label]) result[label] = [];
    result[label].push(movement);
    return result;
  }, {});
  const incoming = movements.filter((movement) => movement.quantityChange > 0).reduce((sum, movement) => sum + movement.quantityChange, 0);
  const outgoing = movements.filter((movement) => movement.quantityChange < 0).reduce((sum, movement) => sum + Math.abs(movement.quantityChange), 0);

  return (
    <div className="page-stack">
      <div className="page-heading compact-heading">
        <div><span className="section-kicker">EVERY IN, OUT, AND LITTLE COURSE-CORRECTION</span><h1>Activity<span className="heading-period">.</span></h1><p>A running record of how your stock changes, without the detective work.</p></div>
        <div className="heading-actions"><a className="button button-secondary" href="/api/products/export.csv"><Download size={15} /> Export product list</a></div>
      </div>

      <div className="activity-summary-row">
        <div><span className="activity-summary-icon incoming-summary"><ArrowDownRight size={16} /></span><span><small>Units received</small><strong>+{incoming.toLocaleString()}</strong></span></div>
        <div><span className="activity-summary-icon outgoing-summary"><ArrowUpRight size={16} /></span><span><small>Units sold or removed</small><strong>−{outgoing.toLocaleString()}</strong></span></div>
        <div><span className="activity-summary-icon record-summary"><ClipboardList size={16} /></span><span><small>Movements recorded</small><strong>{movements.length}</strong></span></div>
      </div>

      <section className="panel activity-panel">
        <div className="activity-toolbar">
          <div className="activity-filter-tabs" role="tablist" aria-label="Filter movement type">
            {[
              ['all', 'All activity'],
              ['sale', 'Sales'],
              ['restock', 'Restocks'],
              ['adjustment', 'Adjustments'],
            ].map(([value, label]) => <button className={kind === value ? 'activity-filter active' : 'activity-filter'} key={value} role="tab" aria-selected={kind === value} onClick={() => setKind(value)}>{label}</button>)}
          </div>
          <label className="table-search"><Filter size={14} /><input aria-label="Search activity" placeholder="Search activity…" value={searchQuery} onChange={(event) => onSearch(event.target.value)} /></label>
        </div>
        {filtered.length ? (
          <div className="activity-timeline">
            {Object.entries(groups).map(([label, items]) => (
              <section className="activity-day-group" key={label}>
                <div className="activity-date-label"><span>{label}</span><i /></div>
                {items.map((movement) => {
                  const incomingMove = movement.quantityChange > 0;
                  return (
                    <div className="activity-event" key={movement.id}>
                      <MovementIcon movement={movement} />
                      <span className={`activity-product-art product-art--${movement.color}`}>{movement.emoji}</span>
                      <div className="activity-event-main"><strong>{movement.productName}</strong><span>{movementDescription(movement)} · {movement.note || 'No note added'}</span><small>{movement.productSku}</small></div>
                      <span className={`activity-change ${incomingMove ? 'change-plus' : 'change-minus'}`}>{incomingMove ? '+' : '−'}{Math.abs(movement.quantityChange)} <small>units</small></span>
                      <span className="activity-event-time">{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(movement.createdAt))}</span>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-table-state"><span className="empty-state-icon"><ClipboardList size={20} /></span><h3>{movements.length ? 'No activity matches that filter.' : 'Your paper trail starts with your first stock move.'}</h3><p>{movements.length ? 'Try changing the filter or search term.' : 'Record a sale, delivery, or quick adjustment and it will show up here.'}</p>{searchQuery && <button className="button button-secondary" onClick={() => { onSearch(''); setKind('all'); }}>Clear filters</button>}</div>
        )}
        {filtered.length > 0 && <div className="activity-list-footer"><span><span className="activity-live-dot" /> Up to the last 50 stock movements</span><span>Updated when stock changes are saved</span></div>}
      </section>
    </div>
  );
}
