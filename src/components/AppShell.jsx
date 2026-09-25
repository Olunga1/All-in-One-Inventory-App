import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Home,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  X,
} from 'lucide-react';

const navigation = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'restock', label: 'Restock', icon: ShoppingCart },
  { id: 'activity', label: 'Activity', icon: Activity },
];

const pageTitles = {
  overview: ['YOUR SHOP AT A GLANCE', 'Overview'],
  products: ['YOUR CATALOG', 'Products'],
  restock: ['PURCHASING', 'Restock'],
  activity: ['THE PAPER TRAIL', 'Activity'],
  settings: ['YOUR WORKSPACE', 'Settings'],
};

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';
}

export default function AppShell({
  user,
  page,
  onPage,
  children,
  searchQuery,
  onSearch,
  lowStockProducts = [],
  onLogout,
  onRestockFromAlert,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [eyebrow, title] = pageTitles[page] || pageTitles.overview;

  const navigate = (nextPage) => {
    onPage(nextPage);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  return (
    <div className={`app-shell ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); navigate('overview'); }}>
            <span className="brand-mark"><Boxes size={20} strokeWidth={2.2} /></span>
            <span className="brand-word">stockroom<span className="brand-period">.</span></span>
          </a>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>

        <button className="workspace-switcher" onClick={() => navigate('settings')} aria-label="Manage workspace settings">
          <span className="workspace-monogram">{initials(user?.businessName)}</span>
          <span className="workspace-copy"><strong>{user?.businessName || 'My workspace'}</strong><small>Independent shop</small></span>
          <ChevronDown size={15} className="workspace-chevron" />
        </button>

        <div className="nav-group-label">WORKSPACE</div>
        <nav className="side-navigation" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {id === 'restock' && lowStockProducts.length > 0 && <span className="nav-count">{lowStockProducts.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><SparkleMark /></div>
          <p><strong>A little tip</strong><br />Set a reorder point on your bestsellers. Future you will be glad.</p>
          <button className="tip-link" onClick={() => navigate('products')}>View your products <ChevronRight size={13} /></button>
        </div>
        <button className={`nav-link settings-nav ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
          <Settings size={18} strokeWidth={1.9} /><span>Settings</span>
        </button>

        <div className="sidebar-profile">
          <span className="avatar avatar-sidebar">{initials(user?.name)}</span>
          <span className="sidebar-profile-copy"><strong>{user?.name || 'Shop owner'}</strong><small>{user?.email || ''}</small></span>
          <button className="icon-button profile-menu-trigger" title="Account options" onClick={() => setProfileOpen((open) => !open)}><ChevronDown size={15} /></button>
          {profileOpen && (
            <div className="profile-popover">
              <button onClick={() => navigate('settings')}><Settings size={15} /> Workspace settings</button>
              <button onClick={onLogout}><LogOut size={15} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu-trigger" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="topbar-heading">
            <span className="topbar-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <div className="topbar-tools">
            <label className={`global-search ${searchFocused ? 'focused' : ''}`}>
              <Search size={16} />
              <input
                aria-label="Search products"
                placeholder="Search products…"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={(event) => onSearch(event.target.value)}
              />
              <kbd><Command size={10} /> K</kbd>
            </label>
            <div className="topbar-popover-anchor">
              <button className={`icon-button topbar-bell ${notificationsOpen ? 'selected' : ''}`} aria-label={`Notifications${lowStockProducts.length ? `, ${lowStockProducts.length} low stock products` : ''}`} onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }}>
                <Bell size={18} />
                {lowStockProducts.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading"><span><strong>Stock watch</strong><small>{lowStockProducts.length ? `${lowStockProducts.length} products to check` : 'All clear for now'}</small></span><button className="icon-button popover-close" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={15} /></button></div>
                  {lowStockProducts.length ? (
                    <div className="notification-list">
                      {lowStockProducts.slice(0, 4).map((product) => (
                        <button className="notification-item" key={product.id} onClick={() => { onRestockFromAlert(product); setNotificationsOpen(false); }}>
                          <span className={`notification-product-icon product-art--${product.color}`}>{product.emoji}</span>
                          <span><strong>{product.name}</strong><small>{product.quantity === 0 ? 'Out of stock' : `${product.quantity} left`} · reorder at ${product.reorderPoint}</small></span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  ) : <div className="popover-empty"><Boxes size={20} /><span>No low-stock items to chase today.</span></div>}
                  <button className="popover-footer" onClick={() => navigate('restock')}>Open restock queue <ChevronRight size={14} /></button>
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <button className="topbar-user" onClick={() => navigate('settings')} aria-label="Open workspace settings">
              <span className="avatar">{initials(user?.name)}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        <main className="main-content">
          {!demoBannerDismissed && user?.email === 'demo@stockroom.app' && (
            <div className="demo-banner"><span className="demo-banner-icon"><CircleHelp size={15} /></span><span><strong>You’re in the sample workspace.</strong> Explore freely—changes save here and are visible to other demo visitors.</span><button onClick={() => setDemoBannerDismissed(true)} aria-label="Dismiss demo notice"><X size={15} /></button></div>
          )}
          {children}
        </main>
        <footer className="app-footer"><span>Made for small shops, with care.</span><span>Stockroom <span className="footer-dot">·</span> 1.0</span></footer>
      </div>
    </div>
  );
}

function SparkleMark() {
  return <AlertTriangle size={16} strokeWidth={1.8} />;
}
