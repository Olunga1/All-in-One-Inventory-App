import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { api } from './api.js';
import AppShell from './components/AppShell.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import { Modal, ConfirmDialog } from './components/Modal.jsx';
import ProductForm from './components/ProductForm.jsx';
import RestockForm from './components/RestockForm.jsx';
import StockForm from './components/StockForm.jsx';
import Toast from './components/Toast.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import RestockPage from './pages/RestockPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function LoadingScreen() {
  return <div className="loading-screen"><a className="brand" href="#loading"><span className="brand-mark"><Boxes size={20} /></span><span className="brand-word">stockroom<span className="brand-period">.</span></span></a><span className="loading-line" /></div>;
}

function WorkspaceSkeleton() {
  return <div className="page-stack" aria-label="Loading your workspace"><div className="skeleton" style={{ height: 70, width: '45%' }} /><div className="skeleton-grid"><i className="skeleton skeleton-card" /><i className="skeleton skeleton-card" /><i className="skeleton skeleton-card" /><i className="skeleton skeleton-card" /></div><div className="skeleton skeleton-panel" /></div>;
}

function productFromDraft(values, id) {
  return {
    ...values,
    id,
    lowStock: Number(values.quantity) <= Number(values.reorderPoint),
    stockValue: Number(values.quantity) * Number(values.unitCost),
    createdAt: new Date().toISOString(),
  };
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [restocks, setRestocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [page, setPage] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const notify = useCallback((message, type = 'success') => setToast({ message, type, id: Date.now() }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const refreshWorkspace = useCallback(async (showLoading = false) => {
    if (showLoading) setWorkspaceLoading(true);
    try {
      const [nextDashboard, nextProducts, nextRestocks, nextMovements] = await Promise.all([
        api.dashboard(), api.products(), api.restocks(), api.movements(),
      ]);
      setDashboard(nextDashboard);
      setProducts(nextProducts.products);
      setRestocks(nextRestocks.restocks);
      setMovements(nextMovements.movements);
      return true;
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setDashboard(null);
        setProducts([]);
        setRestocks([]);
        setMovements([]);
      } else {
        notify(error.message, 'error');
      }
      return false;
    } finally {
      if (showLoading) setWorkspaceLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    api.me().then(({ user: currentUser }) => {
      if (active) setUser(currentUser);
    }).catch(() => {
      if (active) setUser(null);
    }).finally(() => {
      if (active) setAuthReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      setProducts([]);
      setRestocks([]);
      setMovements([]);
      setWorkspaceLoading(false);
      return;
    }
    refreshWorkspace(true);
  }, [user?.id, refreshWorkspace]);

  const lowStockProducts = useMemo(() => products.filter((product) => product.lowStock), [products]);

  const authenticated = (nextUser) => {
    setUser(nextUser);
    setPage('overview');
    setSearchQuery('');
    setModal(null);
  };

  const handlePage = (nextPage) => {
    setPage(nextPage);
    if (nextPage !== 'products' && nextPage !== 'activity') setSearchQuery('');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query) setPage('products');
  };

  const openProductForm = (product = null) => setModal({ type: 'product', product });
  const openStockForm = (product) => setModal({ type: 'stock', product });
  const openRestockForm = (product = null, quantity = null) => setModal({ type: 'restock', restock: null, product, quantity });

  const saveProduct = async (values) => {
    const editingProduct = modal?.product;
    const before = products;
    const temporaryId = `optimistic-${Date.now()}`;
    const optimisticProduct = productFromDraft(values, editingProduct?.id || temporaryId);
    setProducts((current) => editingProduct
      ? current.map((product) => product.id === editingProduct.id ? optimisticProduct : product)
      : [optimisticProduct, ...current]);
    try {
      const result = editingProduct
        ? await api.updateProduct(editingProduct.id, values)
        : await api.createProduct(values);
      setProducts((current) => editingProduct
        ? current.map((product) => product.id === editingProduct.id ? result.product : product)
        : [result.product, ...current.filter((product) => product.id !== temporaryId)]);
      setModal(null);
      notify(editingProduct ? 'Product details updated.' : `${result.product.name} added to your catalog.`);
      await refreshWorkspace();
    } catch (error) {
      setProducts(before);
      throw error;
    }
  };

  const saveStock = async (values) => {
    const product = modal?.product;
    if (!product) throw new Error('Choose a product before changing stock.');
    const before = products;
    const nextQuantity = product.quantity + (values.direction === 'out' ? -values.quantity : values.quantity);
    if (nextQuantity < 0) throw new Error('There is not enough stock for that sale.');
    setProducts((current) => current.map((item) => item.id === product.id
      ? { ...item, quantity: nextQuantity, lowStock: nextQuantity <= item.reorderPoint, stockValue: nextQuantity * item.unitCost }
      : item));
    try {
      const result = await api.adjustStock(product.id, values);
      setProducts((current) => current.map((item) => item.id === product.id ? result.product : item));
      setModal(null);
      notify(values.direction === 'out' ? 'Sale recorded and stock updated.' : 'Delivery recorded and stock updated.');
      await refreshWorkspace();
    } catch (error) {
      setProducts(before);
      throw error;
    }
  };

  const saveRestock = async (values) => {
    const editingOrder = modal?.restock;
    const before = restocks;
    const optimisticId = editingOrder?.id || `optimistic-${Date.now()}`;
    const selectedProduct = products.find((product) => product.id === values.productId);
    const optimistic = {
      ...editingOrder,
      ...values,
      id: optimisticId,
      productName: selectedProduct?.name || editingOrder?.productName || 'Purchase order',
      productSku: selectedProduct?.sku || editingOrder?.productSku || '',
      emoji: selectedProduct?.emoji || editingOrder?.emoji || '📦',
      color: selectedProduct?.color || editingOrder?.color || 'sage',
      updatedAt: new Date().toISOString(),
    };
    setRestocks((current) => editingOrder
      ? current.map((order) => order.id === editingOrder.id ? optimistic : order)
      : [optimistic, ...current]);
    try {
      const result = editingOrder
        ? await api.updateRestock(editingOrder.id, values)
        : await api.createRestock(values);
      setRestocks((current) => editingOrder
        ? current.map((order) => order.id === editingOrder.id ? result.restock : order)
        : [result.restock, ...current.filter((order) => order.id !== optimisticId)]);
      setModal(null);
      notify(editingOrder ? 'Purchase order updated.' : 'Purchase order added to your queue.');
      await refreshWorkspace();
    } catch (error) {
      setRestocks(before);
      throw error;
    }
  };

  const changeRestockStatus = async (order, nextStatus) => {
    const beforeOrders = restocks;
    const beforeProducts = products;
    setRestocks((current) => current.map((item) => item.id === order.id ? { ...item, status: nextStatus } : item));
    if (nextStatus === 'received') {
      setProducts((current) => current.map((item) => item.id === order.productId
        ? { ...item, quantity: item.quantity + order.quantity, lowStock: item.quantity + order.quantity <= item.reorderPoint, stockValue: (item.quantity + order.quantity) * item.unitCost }
        : item));
    }
    try {
      await api.updateRestock(order.id, {
        productId: order.productId,
        quantity: order.quantity,
        supplier: order.supplier,
        expectedDate: order.expectedDate,
        status: nextStatus,
        note: order.note,
      });
      notify(nextStatus === 'received' ? 'Delivery received; your stock is up to date.' : 'Order marked as placed.');
      await refreshWorkspace();
    } catch (error) {
      setRestocks(beforeOrders);
      setProducts(beforeProducts);
      notify(error.message, 'error');
    }
  };

  const askDeleteProduct = (product) => setModal({ type: 'delete-product', product });
  const askDeleteRestock = (restock) => setModal({ type: 'delete-restock', restock });

  const confirmDelete = async () => {
    if (!modal) return;
    setDeleting(true);
    const target = modal.type === 'delete-product' ? modal.product : modal.restock;
    const beforeProducts = products;
    const beforeRestocks = restocks;
    if (modal.type === 'delete-product') {
      setProducts((current) => current.filter((product) => product.id !== target.id));
      setRestocks((current) => current.filter((order) => order.productId !== target.id));
    } else {
      setRestocks((current) => current.filter((order) => order.id !== target.id));
    }
    try {
      if (modal.type === 'delete-product') await api.deleteProduct(target.id);
      else await api.deleteRestock(target.id);
      setModal(null);
      notify(modal.type === 'delete-product' ? 'Product removed from your catalog.' : 'Purchase order deleted.');
      await refreshWorkspace();
    } catch (error) {
      setProducts(beforeProducts);
      setRestocks(beforeRestocks);
      notify(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const saveProfile = async (values) => {
    setProfileSaving(true);
    try {
      const result = await api.profile(values);
      setUser(result.user);
      notify('Workspace details saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  const exportProducts = async () => {
    setExporting(true);
    try {
      const blob = await api.exportProducts();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stockroom-products.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('Your product list is ready to download.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* clear the local view even if the request is offline */ }
    setUser(null);
    setPage('overview');
    setSearchQuery('');
    setModal(null);
    notify('You’ve signed out.');
  };

  if (!authReady) return <LoadingScreen />;
  if (!user) return <><AuthScreen onAuthenticated={authenticated} /><Toast toast={toast} onDismiss={dismissToast} /></>;

  let pageContent;
  if (workspaceLoading) {
    pageContent = <WorkspaceSkeleton />;
  } else if (page === 'products') {
    pageContent = <ProductsPage
      products={products}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      onAdd={() => openProductForm()}
      onEdit={openProductForm}
      onAdjust={openStockForm}
      onDelete={askDeleteProduct}
      onExport={exportProducts}
      exporting={exporting}
    />;
  } else if (page === 'restock') {
    pageContent = <RestockPage
      products={products}
      restocks={restocks}
      onCreate={(product, quantity) => openRestockForm(product, quantity)}
      onEdit={(restock) => setModal({ type: 'restock', restock, product: null, quantity: null })}
      onUpdateStatus={changeRestockStatus}
      onDelete={askDeleteRestock}
    />;
  } else if (page === 'activity') {
    pageContent = <ActivityPage movements={movements} searchQuery={searchQuery} onSearch={setSearchQuery} />;
  } else if (page === 'settings') {
    pageContent = <SettingsPage user={user} onSave={saveProfile} onLogout={logout} saving={profileSaving} />;
  } else {
    pageContent = <DashboardPage
      user={user}
      dashboard={dashboard}
      onNavigate={handlePage}
      onAddProduct={() => openProductForm()}
      onQuickRestock={(product) => product ? openRestockForm(product) : handlePage('restock')}
    />;
  }

  return (
    <>
      <AppShell
        user={user}
        page={page}
        onPage={handlePage}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        lowStockProducts={lowStockProducts}
        onLogout={logout}
        onRestockFromAlert={(product) => openRestockForm(product)}
      >
        {pageContent}
      </AppShell>

      {modal?.type === 'product' && (
        <Modal
          title={modal.product ? 'Edit product' : 'Add a product'}
          description={modal.product ? 'A quick tidy-up of the details in your catalog.' : 'Add the details you have. You can fill in the rest later.'}
          onClose={() => setModal(null)}
          size="large"
        >
          <ProductForm product={modal.product} onSave={saveProduct} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === 'stock' && (
        <Modal title="Adjust stock" description="Every change is added to your activity history." onClose={() => setModal(null)} size="medium">
          <StockForm product={modal.product} onSave={saveStock} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === 'restock' && (
        <Modal title={modal.restock ? 'Edit purchase order' : 'New purchase order'} description="Keep the supplier, quantity, and delivery details close together." onClose={() => setModal(null)} size="medium">
          <RestockForm restock={modal.restock} products={products} initialProduct={modal.product} initialQuantity={modal.quantity} onSave={saveRestock} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === 'delete-product' && (
        <ConfirmDialog
          title={`Remove ${modal.product.name}?`}
          description="This permanently removes the product, its stock movement history, and any purchase orders linked to it. This can’t be undone."
          busy={deleting}
          onCancel={() => setModal(null)}
          onConfirm={confirmDelete}
        />
      )}
      {modal?.type === 'delete-restock' && (
        <ConfirmDialog
          title="Delete this purchase order?"
          description="The order will be removed from your restock queue. Your current stock count will not change."
          busy={deleting}
          onCancel={() => setModal(null)}
          onConfirm={confirmDelete}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
