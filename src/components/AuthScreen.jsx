import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../api.js';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ name: '', businessName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = mode === 'register'
        ? await api.register(values)
        : await api.login(values.email, values.password);
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const openDemo = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.demo();
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About Stockroom">
        <div className="auth-story-inner">
          <a className="brand brand-on-dark" href="#top" aria-label="Stockroom home">
            <span className="brand-mark"><PackageCheck size={21} strokeWidth={2.15} /></span>
            <span className="brand-word">stockroom<span className="brand-period">.</span></span>
          </a>
          <div className="story-copy">
            <div className="story-eyebrow"><Sparkles size={14} /> MADE FOR THE MAKERS</div>
            <h1>Keep the good stuff<br />in <em>stock.</em></h1>
            <p className="story-lede">A quieter way to stay on top of products, stock levels, and the next order to place.</p>
            <ul className="story-checklist">
              <li><span><Check size={13} /></span> Know what needs reordering, before it runs out</li>
              <li><span><Check size={13} /></span> Keep every supplier and stock movement together</li>
              <li><span><Check size={13} /></span> Spend less time untangling spreadsheets</li>
            </ul>
          </div>
          <div className="auth-preview" aria-hidden="true">
            <div className="preview-topline"><span className="preview-dot" /><span>JUNIPER &amp; LOOM</span><span className="preview-topline-right">TODAY</span></div>
            <div className="preview-card-row">
              <div className="preview-stat"><span>Stock value</span><strong>$8,240</strong><small>At cost</small></div>
              <div className="preview-stat preview-alert"><span>Reorder soon</span><strong>03</strong><small>Products need a look</small></div>
            </div>
            <div className="preview-product">
              <span className="preview-product-emoji">🕯️</span>
              <span className="preview-product-name"><strong>Amber grove candle</strong><small>CAN-021 · Cedar &amp; Sage</small></span>
              <span className="preview-low">4 left</span>
            </div>
            <div className="preview-product preview-product-soft">
              <span className="preview-product-emoji">🧼</span>
              <span className="preview-product-name"><strong>Botanical soap trio</strong><small>BTH-003 · Juniper Botanicals</small></span>
              <span className="preview-okay">In stock</span>
            </div>
          </div>
          <div className="story-footer"><span>STOCK, SORTED.</span><span>Built for little shops doing big things.</span></div>
        </div>
      </section>

      <section className="auth-panel" id="top">
        <div className="auth-panel-mobile-brand">
          <span className="brand-mark"><PackageCheck size={21} strokeWidth={2.15} /></span>
          <span className="brand-word">stockroom<span className="brand-period">.</span></span>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <span className="auth-kicker">{isRegister ? 'A fresh start' : 'YOUR WORKSPACE AWAITS'}</span>
            <h2>{isRegister ? 'Set up your shop.' : 'Welcome back.'}</h2>
            <p>{isRegister ? 'A few details, then your stockroom is yours.' : 'Sign in to pick up where you left off.'}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <label className="field-label" htmlFor="auth-name">Your name</label>
                <input id="auth-name" name="name" autoComplete="name" value={values.name} onChange={update} placeholder="Maya Chen" required minLength={2} />
                <label className="field-label" htmlFor="auth-business">Shop name</label>
                <input id="auth-business" name="businessName" autoComplete="organization" value={values.businessName} onChange={update} placeholder="Juniper & Loom Studio" required minLength={2} />
              </>
            )}
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" value={values.email} onChange={update} placeholder="you@yourshop.com" required />
            <label className="field-label" htmlFor="auth-password">Password</label>
            <div className="password-wrap">
              <input id="auth-password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={values.password} onChange={update} placeholder={isRegister ? 'At least 8 characters' : 'Your password'} required minLength={isRegister ? 8 : undefined} />
              <LockKeyhole size={16} aria-hidden="true" />
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>
              {busy ? <span className="spinner spinner-light" /> : <>{isRegister ? 'Create my workspace' : 'Sign in'} <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="auth-divider"><span /> <span>OR</span> <span /></div>
          <button className="button button-demo" onClick={openDemo} disabled={busy} type="button">
            <KeyRound size={16} /> {busy ? 'Opening workspace…' : 'Explore the demo workspace'} <ChevronRight size={15} />
          </button>
          <div className="demo-hint"><CircleHelp size={14} /> A ready-to-explore shop with sample stock and orders.</div>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to Stockroom?'}{' '}
            <button type="button" onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>
              {isRegister ? 'Sign in' : 'Create a workspace'}
            </button>
          </p>
          <p className="auth-legal">By continuing, you agree to keep your shop data safe and your stock moving.</p>
        </div>
        <div className="auth-bottom-note"><span>Simple stock management, made for small shops.</span><span>Private by default <LockKeyhole size={13} /></span></div>
      </section>
    </main>
  );
}
