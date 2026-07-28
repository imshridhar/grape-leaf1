import {
  Component,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import GrapesYieldPrediction from './components/GrapesYieldPrediction';
import { useLanguage, LanguageSelector } from './LanguageContext';


const DISEASES = {
  healthy: {
    name: 'Healthy',
    severity: 'Stable',
    tone: '#2f9a67',
    cause: 'Balanced vine health',
    description:
      'The leaf shows even color, sound structure, and no visible lesion activity across the blade.',
    signs: ['Uniform green pigment', 'No spotting or edge burn', 'Consistent leaf texture'],
    treatment: ['Continue weekly scouting', 'Keep irrigation balanced', 'Preserve airflow through canopy'],
    prevention: ['Stay consistent with sanitation', 'Track rain and humidity shifts', 'Inspect after new growth flushes'],
    responseWindow: 'Monitor weekly',
    scoutFocus: 'Watch for sudden stress after rain, overhead irrigation, or heat spikes.',
  },
  black_rot: {
    name: 'Black Rot',
    severity: 'High',
    tone: '#7a4633',
    cause: 'Guignardia bidwellii',
    description:
      'A fungal disease that spreads aggressively in wet conditions and can affect leaves, shoots, and fruit.',
    signs: ['Tan circular lesions', 'Dark lesion margins', 'Black fruiting bodies'],
    treatment: ['Remove infected tissue fast', 'Apply a recommended fungicide program', 'Open the canopy to dry faster'],
    prevention: ['Clean mummified fruit', 'Protect new growth early', 'Reduce prolonged leaf wetness'],
    responseWindow: 'Act within 24-48 hours',
    scoutFocus: 'Check nearby clusters and young leaves after rainfall events.',
  },
  esca: {
    name: 'Esca',
    severity: 'Very High',
    tone: '#ba7a22',
    cause: 'Wood-infecting fungal complex',
    description:
      'A chronic vine disease often tied to tiger-stripe foliage, internal wood decay, and long-term vine decline.',
    signs: ['Tiger-stripe interveinal bands', 'Leaf scorch patterns', 'Sudden vine weakening'],
    treatment: ['Remove severely declining vines', 'Protect pruning wounds', 'Disinfect tools between cuts'],
    prevention: ['Avoid large wet-weather cuts', 'Seal pruning wounds early', 'Track chronic vine decline by row'],
    responseWindow: 'Escalate this week',
    scoutFocus: 'Review old pruning wounds and vines with recurring decline symptoms.',
  },
  leaf_blight: {
    name: 'Leaf Blight',
    severity: 'Medium',
    tone: '#cc5a3c',
    cause: 'Pseudocercospora vitis',
    description:
      'A spot-based leaf disease that can build toward early defoliation when humidity and canopy density stay high.',
    signs: ['Angular brown spotting', 'Yellow halos', 'Premature leaf drop'],
    treatment: ['Remove heavily affected leaves', 'Use an appropriate copper-based treatment', 'Reduce overhead irrigation'],
    prevention: ['Keep airflow moving', 'Scout humid blocks more often', 'Treat early before spread intensifies'],
    responseWindow: 'Respond within 2-3 days',
    scoutFocus: 'Inspect dense, humid rows and leaves shaded deep in the canopy.',
  },
};

const CLASS_ORDER = ['healthy', 'black_rot', 'esca', 'leaf_blight'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);
const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('GrapeGuard frontend error:', error);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-shell">
        <section className="app-error-card">
          <span className="status-pill">
            <Icon name="alert" size={14} />
            Something broke
          </span>
          <h1>We hit a frontend error.</h1>
          <p>
            The page did not render correctly. You can retry this screen or refresh the app without
            leaving the project.
          </p>
          <div className="page-header-actions">
            <button type="button" className="button primary" onClick={this.reset}>
              <Icon name="spark" size={18} />
              Try again
            </button>
            <button type="button" className="button subtle" onClick={() => window.location.reload()}>
              <Icon name="back" size={18} />
              Refresh app
            </button>
          </div>
        </section>
      </main>
    );
  }
}

function Icon({ name, size = 20 }) {
  const paths = {
    dashboard:
      'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
    scan: 'M5 4h4v2H6v3H4V5c0-.55.45-1 1-1Zm10 0h4c.55 0 1 .45 1 1v4h-2V6h-3V4ZM4 15h2v3h3v2H5a1 1 0 0 1-1-1v-4Zm14 0h2v4c0 .55-.45 1-1 1h-4v-2h3v-3ZM8 8h8v8H8V8Z',
    history:
      'M12 6v6l4 2 .8-1.6-2.8-1.4V6h-2Zm0-4a10 10 0 1 1-9.3 6.3l1.9.6A8 8 0 1 0 6 5.1V8H2V2h2v2a10 10 0 0 1 8-2Z',
    book: 'M5 4.5C6.2 3.6 7.6 3 9.2 3c1.3 0 2.5.4 3.8 1.1C14.3 3.4 15.5 3 16.8 3c1.6 0 3 .6 4.2 1.5V19c-1.2-.9-2.6-1.4-4.2-1.4-1.3 0-2.5.4-3.8 1.1-1.3-.7-2.5-1.1-3.8-1.1-1.6 0-3 .5-4.2 1.4V4.5Zm2 2.2v8.8c.7-.3 1.4-.5 2.2-.5 1 0 1.9.2 2.8.7V5.9c-.9-.5-1.8-.9-2.8-.9-.8 0-1.5.2-2.2.7Zm10-.7c-.9 0-1.9.3-2.8.9v9.8c.9-.4 1.8-.7 2.8-.7.8 0 1.5.2 2.2.5V6.7C18.5 6.2 17.8 6 17 6Z',
    leaf: 'M20.8 3.2C12.7 3.3 6.6 5.9 4 10.5c-1.8 3.2-.9 6.4 1.4 8.1 2.5 1.9 6.2 1.3 8.7-1.2 2.8-2.8 4.3-7.3 6.7-14.2ZM6.7 16.8c2.2-4.2 5.2-6.8 9.2-8.8-3.2 2.5-5.7 5.4-7.8 9.9-.5-.2-1-.5-1.4-1.1Z',
    upload: 'M11 16h2V8.8l3 3L17.4 10 12 4.6 6.6 10 8 11.8l3-3V16Zm-6 4h14v-2H5v2Z',
    camera: 'M4 7h3l1.4-2h7.2L17 7h3v12H4V7Zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2.1a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Z',
    clipboard: 'M9 3h6l1 2h3v16H5V5h3l1-2Zm1.2 2-.4.8H7V19h10V5.8h-2.8L13.8 5h-3.6Z',
    trash: 'M8 4h8l1 2h4v2H3V6h4l1-2Zm-2 6h12l-.8 11H6.8L6 10Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z',
    logout:
      'M5 4h8v2H7v12h6v2H5V4Zm10.6 4.4L20.2 13l-4.6 4.6-1.4-1.4 2.2-2.2H10v-2h6.4l-2.2-2.2 1.4-1.4Z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0H4Z',
    menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
    close: 'm7 5.6 5 5 5-5L18.4 7l-5 5 5 5-1.4 1.4-5-5-5 5L5.6 17l5-5-5-5L7 5.6Z',
    check: 'm10 15.2 7.6-7.6L19 9l-9 9-5-5 1.4-1.4 3.6 3.6Z',
    alert: 'M12 3 22 20H2L12 3Zm-1 6v5h2V9h-2Zm0 7v2h2v-2h-2Z',
    search: 'M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm7.4 10 3.3 3.3-1.4 1.4-3.3-3.3 1.4-1.4Z',
    spark: 'm12 2 2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2L12 2Z',
    shield: 'M12 2 4 5v6c0 5.3 3.4 10.2 8 11 4.6-.8 8-5.7 8-11V5l-8-3Zm0 4.1 5 1.9v3.1c0 3.9-2.3 7.5-5 8.5-2.7-1-5-4.6-5-8.5V8l5-1.9Z',
    target: 'M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9Zm0 2a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm0 2.5a4.5 4.5 0 1 1-4.5 4.5A4.5 4.5 0 0 1 12 7.5Zm0 2a2.5 2.5 0 1 0 2.5 2.5A2.5 2.5 0 0 0 12 9.5Z',
    trend: 'M4 16.5 10 10l3 3 6.5-7L21 7.5 13 16l-3-3-4.5 5.5L4 16.5Z',
    back: 'M14.4 5.6 8 12l6.4 6.4L13 19.8 5.2 12 13 4.2l1.4 1.4Z',
  };

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={paths[name] || paths.leaf} fill="currentColor" />
    </svg>
  );
}

async function apiRequest(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

function apiGet(path) {
  return apiRequest(path);
}

function apiPost(path, body) {
  if (body instanceof FormData) return apiRequest(path, { method: 'POST', body });
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

function apiDelete(path) {
  return apiRequest(path, { method: 'DELETE' });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatPercent(value) {
  if (value == null || value === '') return '--';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${normalized.toFixed(Number.isInteger(normalized) ? 0 : 1).replace(/\.0$/, '')}%`;
}

function formatDateLabel(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, options).format(parsed);
}

function labelForClass(value) {
  return DISEASES[value]?.name || value.replace('_', ' ');
}

function modelLabel(source) {
  if (source === 'keras_model') return 'Keras CNN';
  if (source === 'trained_model') return 'Trained model';
  if (source === 'heuristic_fallback') return 'Fallback analysis';
  return source || 'Unknown model';
}

function strongestThreat(distribution) {
  const threats = CLASS_ORDER.filter((key) => key !== 'healthy');
  const ranked = [...threats].sort((left, right) => (distribution[right] || 0) - (distribution[left] || 0));
  return ranked.find((key) => (distribution[key] || 0) > 0) || 'healthy';
}

function useRoute() {
  const [route, setRoute] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => {
      startTransition(() => setRoute(window.location.pathname || '/'));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path) => {
    if (!path || path === route) return;
    window.history.pushState({}, '', path);
    startTransition(() => setRoute(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return [route, navigate];
}

function Toasts({ toasts, removeToast }) {
  const iconByType = {
    success: 'check',
    error: 'alert',
    warning: 'alert',
    info: 'spark',
  };

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <Icon name={iconByType[toast.type] || 'check'} size={18} />
          <span>{toast.message}</span>
          <button
            type="button"
            className="icon-button ghost"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SearchField({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="search-field">
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function AuthPage({ onAuthed, notify }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const data = await apiPost(endpoint, payload);
      onAuthed(data.user);
      notify('Welcome to GrapeGuard.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand-mark">
          <Icon name="leaf" size={30} />
        </div>
        <span className="eyebrow">{t('auth.eyebrow')}</span>
        <h1>{t('auth.title')}</h1>
        <p>{t('auth.description')}</p>

        <div className="auth-stats">
          <div>
            <strong>4</strong>
            <span>{t('auth.classesStat')}</span>
          </div>
          <div>
            <strong>10MB</strong>
            <span>{t('auth.sizeStat')}</span>
          </div>
          <div>
            <strong>.keras</strong>
            <span>{t('auth.modelStat')}</span>
          </div>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <Icon name="scan" size={18} />
            <strong>{t('auth.feature1Title')}</strong>
            <span>{t('auth.feature1Desc')}</span>
          </article>
          <article className="feature-card">
            <Icon name="trend" size={18} />
            <strong>{t('auth.feature2Title')}</strong>
            <span>{t('auth.feature2Desc')}</span>
          </article>
          <article className="feature-card">
            <Icon name="shield" size={18} />
            <strong>{t('auth.feature3Title')}</strong>
            <span>{t('auth.feature3Desc')}</span>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {/* Top Language Switcher on Auth Screen */}
          <div style={{ marginBottom: '1rem' }}>
            <LanguageSelector compact />
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              {t('auth.signInTab')}
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              {t('auth.registerTab')}
            </button>
          </div>

          <div className="card-intro">
            <h2>{mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccountTitle')}</h2>
            <p>
              {mode === 'login' ? t('auth.loginSub') : t('auth.registerSub')}
            </p>
          </div>

          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && (
              <label>
                <span>{t('auth.fullName')}</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder={t('auth.namePlaceholder')}
                  required
                />
              </label>
            )}

            <label>
              <span>{t('auth.email')}</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </label>

            <label>
              <span>{t('auth.password')}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={6}
                placeholder={t('auth.passPlaceholder')}
                required
              />
            </label>

            <button className="button primary full" disabled={busy}>
              <Icon name="user" size={18} />
              {busy ? t('auth.working') : mode === 'login' ? t('auth.signInBtn') : t('auth.registerBtn')}
            </button>
          </form>

          <div className="card-footnote">
            <Icon name="target" size={16} />
            <span>{t('auth.footnote')}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function AppShell({ user, route, navigate, children, onLogout }) {
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    ['/detect', 'scan', t('nav.detect')],
    ['/grapes-yield', 'trend', t('nav.yield')],
    ['/history', 'history', t('nav.history')],
  ];
  const normalizedRoute = route === '/' ? '/detect' : route;
  const active = normalizedRoute.split('/')[1] || 'detect';

  const handleNavClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Mobile Top Header Bar */}
      <header className="mobile-top-bar">
        <button type="button" className="mobile-brand-btn" onClick={() => handleNavClick('/detect')}>
          <span className="brand-symbol">
            <Icon name="leaf" size={22} />
          </span>
          <span className="brand-title">{t('nav.brand')}</span>
        </button>

        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} size={24} />
        </button>
      </header>

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-container">
          <button type="button" className="brand-row" onClick={() => handleNavClick('/detect')}>
            <span className="brand-symbol">
              <Icon name="leaf" size={22} />
            </span>
            <span>
              <strong>{t('nav.brand')}</strong>
              <small>{t('nav.subtitle')}</small>
            </span>
          </button>
          <button type="button" className="mobile-close-icon" onClick={() => setMobileOpen(false)}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav>
          {nav.map(([path, icon, label]) => (
            <button
              key={path}
              type="button"
              className={active === path.slice(1) ? 'active' : ''}
              onClick={() => handleNavClick(path)}
            >
              <Icon name={icon} size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Sidebar Language Switcher */}
        <LanguageSelector />

        <div className="sidebar-user">
          <div className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
        </div>

        <button type="button" className="button subtle full" onClick={() => { setMobileOpen(false); onLogout(); }}>
          <Icon name="logout" size={18} />
          {t('nav.signOut')}
        </button>
      </aside>

      <main className="workspace">
        <div className="workspace-frame">{children}</div>
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  );
}

function HighlightBand({ label, value, meta }) {
  return (
    <div className="highlight-band">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DiseaseToken({ classKey }) {
  const disease = DISEASES[classKey] || DISEASES.healthy;
  return (
    <span className="disease-token" style={{ '--tone': disease.tone }}>
      {disease.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ScoreBar({ label, value, color, side }) {
  return (
    <div className="score-row">
      <div>
        <span>{label}</span>
        <small>{side || formatPercent(value)}</small>
      </div>
      <div className="bar-track">
        <span style={{ width: `${Math.max(4, value)}%`, background: color }} />
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

function ModelStatusCard({ model, compact = false }) {
  const ready = Boolean(model?.ready_for_inference);
  const dependencyMissing = model?.dependency_available === false;
  const modelMissing = model?.model_file_exists === false;
  const statusLabel = ready ? 'Keras active' : modelMissing ? 'Fallback mode' : 'Model blocked';
  const headline = !model
    ? 'Model status unavailable'
    : ready
      ? 'Ready for inference'
      : modelMissing && dependencyMissing
        ? 'No .keras model and TensorFlow missing'
        : modelMissing
          ? 'No .keras model detected'
          : 'TensorFlow dependency missing';

  return (
    <div className={`model-summary ${ready ? 'trained' : 'fallback'} ${compact ? 'compact' : ''}`}>
      <div className="model-summary-head">
        <span className="status-pill">
          <Icon name={ready ? 'shield' : 'spark'} size={14} />
          {statusLabel}
        </span>
        <strong>{headline}</strong>
      </div>
      <p>{model?.message || 'The application could not load model metadata right now.'}</p>
      {!compact && (
        <>
          <div className="mini-stat-grid">
            <div>
              <span>Model file</span>
              <strong>{model?.model_file_exists ? 'Present' : 'Missing'}</strong>
            </div>
            <div>
              <span>TensorFlow</span>
              <strong>{dependencyMissing ? 'Missing' : 'Available'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{ready ? 'CNN active' : 'Fallback active'}</strong>
            </div>
            <div>
              <span>Validation</span>
              <strong>{model?.validation_accuracy == null ? '--' : formatPercent(model.validation_accuracy)}</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>{model?.version || '1.0'}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatDateLabel(model?.trained_at)}</strong>
            </div>
          </div>

          {(model?.next_steps || []).length > 0 && (
            <details className="model-details">
              <summary>Show setup steps</summary>
              <div className="model-action-list">
                {(model.next_steps || []).map((step) => (
                  <span key={step}>
                    <Icon name="check" size={14} />
                    {step}
                  </span>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}



function Detect({ notify }) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [meta, setMeta] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(null);
  const previewUrlRef = useRef('');

  useEffect(() => {
    let active = true;
    apiGet('/api/model/status')
      .then((data) => {
        if (active) setModel(data);
      })
      .catch(() => {
        if (active) setModel(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
    };
  }, []);

  const setPreviewUrl = (nextUrl = '') => {
    const currentUrl = previewUrlRef.current;
    if (currentUrl && currentUrl !== nextUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    previewUrlRef.current = nextUrl;
    setPreview(nextUrl);
  };

  const validateFile = (nextFile) => {
    const ext = (nextFile.name || '').split('.').pop().toLowerCase();
    if (!nextFile.type.startsWith('image/') && !ALLOWED_EXTS.has(ext)) return 'Select an image file.';
    if (nextFile.type && !ALLOWED_TYPES.has(nextFile.type) && !ALLOWED_EXTS.has(ext)) return 'Unsupported image type.';
    if (nextFile.size > MAX_FILE_BYTES) return 'Image too large. Maximum size is 10MB.';
    return '';
  };

  const clearSelection = () => {
    setFile(null);
    setPreviewUrl('');
    setResult(null);
    setMeta(null);
  };

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    const error = validateFile(nextFile);
    if (error) {
      notify(error, 'error');
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreviewUrl(nextPreviewUrl);
    setMeta({ name: nextFile.name, size: formatBytes(nextFile.size), type: nextFile.type || 'image' });
    setResult(null);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      setResult(await apiPost('/api/predict', form));
      notify('Analysis complete.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('detect.eyebrow')}
        title={t('detect.title')}
        action={
          <button type="button" className="button subtle" onClick={() => notify(t('detect.tipMessage'), 'info')}>
            <Icon name="spark" size={18} />
            {t('detect.captureTip')}
          </button>
        }
      />

      <section className="detect-layout">
        <div className="stack">
          <div className="panel upload-panel">
            <div className="panel-head">
              <h2>{t('detect.acquireImage')}</h2>
              <span className="panel-kicker">{t('detect.step1')}</span>
            </div>

            <div
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              <Icon name="upload" size={34} />
              <strong>{t('detect.dropZoneTitle')}</strong>
              <small>{t('detect.supportedTypes')}</small>
              <label className="button primary">
                <Icon name="upload" size={18} />
                {t('detect.chooseFile')}
                <input type="file" accept="image/*" onChange={(event) => selectFile(event.target.files[0])} hidden />
              </label>
            </div>

            {file && (
              <div className="button-row">
                <button type="button" className="button subtle" onClick={clearSelection}>
                  <Icon name="close" size={18} />
                  {t('detect.clear')}
                </button>
              </div>
            )}

            {preview && (
              <div className="preview-box">
                <img
                  src={preview}
                  alt="Selected leaf"
                  decoding="async"
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setMeta((current) => ({
                      ...current,
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    }));
                  }}
                  onError={() => notify('The selected image preview could not be displayed.', 'error')}
                />
                <div className="file-line">
                  <span>{meta?.name}</span>
                  <b>{meta?.width && meta?.height ? `${meta.width} x ${meta.height}` : meta?.size}</b>
                </div>
                <button type="button" className="button primary full" onClick={analyze} disabled={busy}>
                  <Icon name="scan" size={18} />
                  {busy ? t('detect.analyzing') : t('detect.analyzeLeaf')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('detect.modelReadiness')}</h2>
              <span className="panel-kicker">{t('detect.step2')}</span>
            </div>
            <ModelStatusCard model={model} />
          </div>

          <div className="panel result-panel">
            {!result && (
              <EmptyState
                icon="scan"
                title={t('detect.noResultTitle')}
                text={t('detect.noResultText')}
              />
            )}
            {result && <PredictionResult result={result} />}
          </div>
        </div>
      </section>
    </>
  );
}

function ResultMiniStat({ label, value }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultSection({ title, items }) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      <ul>
        {(items || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function QualityItem({ label, value }) {
  return (
    <div className="quality-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PredictionResult({ result }) {
  const { t, getDiseaseInfo } = useLanguage();
  const diseaseInfo = getDiseaseInfo(result.predicted_class);
  const color = DISEASES[result.predicted_class]?.tone || '#2f9a67';
  const scores = Object.entries(result.all_scores || {}).sort((left, right) => right[1] - left[1]);
  const quality = result.image_quality || {};

  const translatedLabelForClass = (key) => {
    const info = getDiseaseInfo(key);
    return info?.name || labelForClass(key);
  };

  return (
    <div className="prediction">
      <div className="prediction-hero" style={{ '--tone': color }}>
        <DiseaseToken classKey={result.predicted_class} />
        <div>
          <span className="status-pill tone">
            <Icon name="shield" size={14} />
            {diseaseInfo?.severity || result.severity}
          </span>
          <h2>{diseaseInfo?.name || result.disease_name}</h2>
          <p>{diseaseInfo?.description || result.description}</p>
        </div>
        <strong>{formatPercent(result.confidence)}</strong>
      </div>

      <div className="result-mini-grid">
        <ResultMiniStat label={t('detect.modelSource')} value={modelLabel(result.model_source)} />
        <ResultMiniStat label={t('detect.modelVersion')} value={result.model_version || '1.0'} />
        <ResultMiniStat label={t('detect.qualityAlerts')} value={(quality.warnings || []).length || 0} />
        <ResultMiniStat
          label={t('detect.imageSize')}
          value={quality.width && quality.height ? `${quality.width} x ${quality.height}` : '--'}
        />
      </div>

      <div className="quality-grid">
        <QualityItem label={t('detect.brightness')} value={quality.brightness == null ? '--' : formatPercent(quality.brightness)} />
        <QualityItem label={t('detect.contrast')} value={quality.contrast == null ? '--' : formatPercent(quality.contrast)} />
        <QualityItem label={t('detect.sharpness')} value={quality.sharpness == null ? '--' : formatPercent(quality.sharpness)} />
        <QualityItem
          label={t('detect.leafColor')}
          value={quality.leaf_color_ratio == null ? '--' : formatPercent(quality.leaf_color_ratio)}
        />
      </div>

      {(quality.warnings || []).length > 0 && (
        <div className="warning-list">
          {quality.warnings.map((warning) => (
            <span key={warning}>
              <Icon name="alert" size={16} />
              {warning}
            </span>
          ))}
        </div>
      )}

      <ResultSection title={t('detect.treatment')} items={diseaseInfo?.treatment || result.solutions} />
      <ResultSection title={t('detect.prevention')} items={diseaseInfo?.prevention || result.prevention} />

      <div className="score-stack">
        {scores.map(([key, value]) => (
          <ScoreBar key={key} label={translatedLabelForClass(key)} value={value} color={DISEASES[key]?.tone || '#777'} />
        ))}
      </div>
    </div>
  );
}

function History({ navigate, notify }) {
  const { t, getDiseaseInfo } = useLanguage();
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const load = async (nextPage = 1) => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/history?page=${nextPage}&limit=10`);
      setRecords(data.records || []);
      setPage(data.page || 1);
      setPages(data.pages || 1);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const filteredRecords = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.disease_name, record.filename, record.created_at, record.severity]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [deferredQuery, records]);

  const remove = async (id) => {
    try {
      await apiDelete(`/api/history/${id}`);
      notify('Record deleted.', 'success');
      const nextPage = records.length === 1 && page > 1 ? page - 1 : page;
      load(nextPage);
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        action={
          <>
            <SearchField value={query} onChange={setQuery} placeholder={t('history.searchPlaceholder')} />
            <button type="button" className="button primary" onClick={() => navigate('/detect')}>
              <Icon name="scan" size={18} />
              {t('history.newScan')}
            </button>
          </>
        }
      />

      <div className="panel">
        <div className="panel-head">
          <h2>{t('history.savedDetections')}</h2>
          <span className="panel-kicker">
            {t('history.page')} {page} {t('history.of')} {pages}
          </span>
        </div>

        <div className="history-toolbar">
          <span>{filteredRecords.length} {t('history.visibleRecords')}</span>
          <span>{records.length} {t('history.totalLoaded')}</span>
        </div>

        {loading && <EmptyState icon="history" title={t('history.loadingRecords')} text="" />}
        {!loading && records.length === 0 && (
          <EmptyState icon="history" title={t('history.noRecords')} text="" />
        )}
        {!loading && records.length > 0 && filteredRecords.length === 0 && (
          <EmptyState icon="search" title={t('history.noMatches')} text="" />
        )}

        <div className="history-list">
          {filteredRecords.map((record) => {
            const dInfo = getDiseaseInfo(record.predicted_class);
            return (
              <div
                key={record.id}
                className="history-row"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/history/${record.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigate(`/history/${record.id}`);
                }}
              >
                <DiseaseToken classKey={record.predicted_class} />
                <span>
                  <strong>{dInfo?.name || record.disease_name}</strong>
                  <small>{record.created_at}</small>
                  <small>{record.filename}</small>
                </span>
                <div className="history-meta">
                  <b>{formatPercent(record.confidence)}</b>
                  <small>{dInfo?.severity || record.severity}</small>
                </div>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(record.id);
                  }}
                  aria-label={t('history.delete')}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            );
          })}
        </div>

        {pages > 1 && (
          <div className="pagination">
            {Array.from({ length: pages }, (_, index) => index + 1).map((next) => (
              <button
                key={next}
                type="button"
                className={next === page ? 'active' : ''}
                onClick={() => load(next)}
              >
                {next}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


function HistoryDetail({ id, navigate, notify }) {
  const { t } = useLanguage();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiGet(`/api/history/${id}`)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((error) => {
        if (active) notify(error.message, 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, notify]);

  const remove = async () => {
    try {
      await apiDelete(`/api/history/${id}`);
      notify('Record deleted.', 'success');
      navigate('/history');
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  if (loading) return <EmptyState icon="history" title={t('history.loadingRecords')} text="" />;
  if (!record) return <EmptyState icon="alert" title={t('history.noRecords')} text="" />;

  // Render Grapes Yield Report if this is a yield calculation record
  if (record.record_type === 'grapes_yield' || record.predicted_class === 'grapes_yield' || record.full_yield_result) {
    const yr = record.full_yield_result || {};
    const yieldSummary = yr.yield_summary || {};
    const financials = yr.financials || {};
    const quality = yr.quality_assessment || {};
    const recs = yr.recommendations || {};
    const plans = yr.action_plans || {};

    return (
      <>
        <PageHeader
          eyebrow={t('history.savedYieldReport')}
          title={record.disease_name}
          subtitle={`${record.created_at} - ${record.filename}`}
          action={
            <>
              <button type="button" className="button subtle" onClick={() => navigate('/history')}>
                <Icon name="back" size={18} />
                {t('history.backToHistory')}
              </button>
              <button type="button" className="button primary" onClick={() => window.print()}>
                {t('yield.printReport')}
              </button>
              <button type="button" className="button danger" onClick={remove}>
                <Icon name="trash" size={18} />
                {t('history.delete')}
              </button>
            </>
          }
        />

        <div className="grapes-results-container">
          {/* Main Hero Metrics Grid */}
          <div className="report-hero-grid">
            <div className="report-hero-card primary">
              <span className="card-kicker">{t('yield.totalYieldHeader')}</span>
              <h2>{yieldSummary.total_yield_tons || 'N/A'} Tons</h2>
              <small>({(yieldSummary.total_yield_kg || 0).toLocaleString()} kg {t('yield.totalHarvestKg')})</small>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.yieldPerAcreHeader')}</span>
              2<h2>{yieldSummary.yield_per_acre_tons || 'N/A'} Tons / Acre</h2>
              <small>({yieldSummary.yield_per_ha_tons || 'N/A'} Tons / Hectare)</small>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.yieldPerVineHeader')}</span>
              <h2>{yieldSummary.yield_per_vine_kg || 'N/A'} kg / vine</h2>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.modelConfidenceHeader')}</span>
              <h2>{yieldSummary.confidence_score || 95}%</h2>
            </div>
          </div>

          {/* Financial Revenue & Profit */}
          {financials.expected_profit && (
            <div className="report-section-card">
              <h3>{t('yield.financialSection')}</h3>
              <div className="fin-metrics-grid">
                <div className="fin-box">
                  <span>{t('yield.marketPrice')}</span>
                  <strong>₹{financials.market_price_per_kg} / kg</strong>
                </div>
                <div className="fin-box green">
                  <span>{t('yield.grossRevenue')}</span>
                  <strong>₹{(financials.expected_revenue || 0).toLocaleString()}</strong>
                </div>
                <div className="fin-box red">
                  <span>{t('yield.cultivationCosts')}</span>
                  <strong>₹{(financials.estimated_costs || 0).toLocaleString()}</strong>
                </div>
                <div className="fin-box purple">
                  <span>{t('yield.netProfit')}</span>
                  <strong>₹{(financials.expected_profit || 0).toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Quality Grade & Risk */}
          <div className="report-split-grid">
            <div className="report-section-card">
              <h3>{t('yield.qualitySection')}</h3>
              <div className="quality-pill">{quality.grade || record.severity}</div>
              <p className="quality-desc">{quality.description || record.description}</p>
            </div>

            {recs.irrigation && (
              <div className="report-section-card">
                <h3>{t('yield.agronomicSection')}</h3>
                <div className="rec-row">
                  <strong>{t('yield.irrigationGuidance')}</strong>
                  <p>{recs.irrigation}</p>
                </div>
                <div className="rec-row">
                  <strong>{t('yield.fertigationGuidance')}</strong>
                  <p>{recs.fertigation}</p>
                </div>
              </div>
            )}
          </div>

          {/* 7-Day Priority Action Plan */}
          {plans.seven_day_plan && (
            <div className="report-section-card">
              <h3>{t('yield.actionPlanSection')}</h3>
              <ol className="step-ol">
                {plans.seven_day_plan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Scan detail"
        title={record.disease_name}
        subtitle={`${record.created_at} - ${record.filename}`}
        action={
          <>
            <button type="button" className="button subtle" onClick={() => navigate('/history')}>
              <Icon name="back" size={18} />
              {t('history.backToHistory')}
            </button>
            <button type="button" className="button danger" onClick={remove}>
              <Icon name="trash" size={18} />
              {t('history.delete')}
            </button>
          </>
        }
      />

      <section className="detail-layout">
        <div className="panel image-panel">
          <img src={record.image_data} alt={record.disease_name} />
        </div>
        <div className="panel">
          <PredictionResult result={record} />
        </div>
      </section>
    </>
  );
}




function App() {
  const [route, navigate] = useRoute();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [toasts, setToasts] = useState([]);

  const notify = useMemo(
    () => (message, type = 'success') => {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      setToasts((current) => [...current, { id, message, type }]);
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3600);
    },
    [],
  );

  useEffect(() => {
    apiGet('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await apiPost('/api/auth/logout').catch(() => { });
    setUser(null);
    navigate('/login');
  };

  const removeToast = (id) => setToasts((current) => current.filter((toast) => toast.id !== id));

  if (checking) {
    return (
      <>
        <div className="boot-screen">
          <div className="boot-mark">
            <Icon name="leaf" size={36} />
          </div>
          <strong>GrapeGuard</strong>
          <span>Loading vineyard intelligence...</span>
        </div>
        <Toasts toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthPage
          onAuthed={(nextUser) => {
            setUser(nextUser);
            navigate('/detect');
          }}
          notify={notify}
        />
        <Toasts toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  const normalizedRoute = route === '/' || route === '/login' || route === '/dashboard' ? '/detect' : route;

  let page = <Detect notify={notify} />;
  if (normalizedRoute.startsWith('/detect')) page = <Detect notify={notify} />;
  if (normalizedRoute.startsWith('/grapes-yield')) {
    page = <GrapesYieldPrediction notify={notify} apiPost={apiPost} apiGet={apiGet} />;
  }
  if (normalizedRoute === '/history') page = <History navigate={navigate} notify={notify} />;
  if (normalizedRoute.startsWith('/history/')) {
    page = <HistoryDetail id={normalizedRoute.split('/')[2]} navigate={navigate} notify={notify} />;
  }


  return (
    <>
      <AppErrorBoundary>
        <AppShell user={user} route={normalizedRoute} navigate={navigate} onLogout={logout}>
          {page}
        </AppShell>
      </AppErrorBoundary>
      <Toasts toasts={toasts} removeToast={removeToast} />
    </>
  );
}

export default App;
