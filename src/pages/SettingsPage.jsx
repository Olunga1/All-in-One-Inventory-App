import { useEffect, useState } from 'react';
import {
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';

export default function SettingsPage({ user, onSave, onLogout, saving }) {
  const [values, setValues] = useState({ name: user?.name || '', businessName: user?.businessName || '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setValues({ name: user?.name || '', businessName: user?.businessName || '' });
  }, [user?.id, user?.name, user?.businessName]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaved(false);
    setError('');
    try {
      await onSave(values);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <div className="page-stack settings-page">
      <div className="page-heading compact-heading">
        <div><span className="section-kicker">MAKE IT FEEL LIKE YOURS</span><h1>Settings<span className="heading-period">.</span></h1><p>Small details that make your stockroom yours.</p></div>
      </div>

      <div className="settings-layout">
        <section className="panel settings-account-panel">
          <div className="settings-section-heading"><span className="settings-heading-icon"><UserRound size={17} /></span><div><h2>Your profile</h2><p>Manage the details connected to this workspace.</p></div></div>
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="settings-form-grid">
              <label className="form-field"><span>Your name</span><input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={80} /><small>Used to personalize your workspace.</small></label>
              <label className="form-field"><span>Shop name</span><input value={values.businessName} onChange={(event) => setValues((current) => ({ ...current, businessName: event.target.value }))} required minLength={2} maxLength={100} /><small>This name appears in your sidebar.</small></label>
              <label className="form-field field-readonly"><span>Email address</span><div className="readonly-input"><Mail size={15} /><input value={user?.email || ''} readOnly /><span>Verified</span></div><small>Your sign-in email cannot be changed here.</small></label>
            </div>
            {error && <div className="form-error settings-error" role="alert">{error}</div>}
            <div className="settings-form-footer"><span>{saved ? <><Check size={14} /> Changes saved.</> : 'Your account details are private to your workspace.'}</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? <span className="spinner spinner-light" /> : saved ? <Check size={15} /> : null}{saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</button></div>
          </form>
        </section>

        <div className="settings-side-stack">
          <section className="panel plan-panel">
            <div className="plan-heading"><span className="plan-icon"><CreditCard size={18} /></span><span><span className="section-kicker">YOUR WORKSPACE</span><h2>Early access</h2></span></div>
            <p>You’re exploring the full Stockroom experience. Simple, affordable plans are the direction—we’re validating the workflow with small-shop owners first.</p>
            <div className="plan-note"><span><Check size={14} /> Product and stock tracking</span><span><Check size={14} /> Purchase orders and activity history</span><span><Check size={14} /> Your own private workspace</span></div>
            <div className="plan-foot"><span>Billing isn’t connected in this preview.</span><span className="plan-badge">PREVIEW</span></div>
          </section>

          <section className="panel privacy-panel">
            <div className="settings-section-heading"><span className="settings-heading-icon"><ShieldCheck size={17} /></span><div><h2>Your data, your shop</h2><p>Workspace data is scoped to your account.</p></div></div>
            <div className="privacy-list"><div><LockKeyhole size={15} /><span>Private sign-in session</span><Check size={14} /></div><div><Store size={15} /><span>Separate inventory for each account</span><Check size={14} /></div><div><Download size={15} /><span>Export products to CSV whenever you like</span><Check size={14} /></div></div>
          </section>

          <section className="help-settings-card"><span className="help-settings-icon"><CircleHelp size={18} /></span><span><strong>Need a hand?</strong><small>Questions or feedback? We’d love to hear what would make Stockroom useful for you.</small></span><ChevronRight size={16} /></section>
          <button className="button button-signout" onClick={onLogout}><LogOut size={16} /> Sign out of Stockroom</button>
        </div>
      </div>
    </div>
  );
}
