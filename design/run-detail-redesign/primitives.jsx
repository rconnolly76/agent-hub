// Shared primitives for Run Detail mocks.
// All directions use these so the canvas reads as one system.

const ACCENT = { violet: '#8b5cf6', blue: '#3b82f6', amber: '#f59e0b', emerald: '#10b981', rose: '#f43f5e' };

const SEV = {
  critical: { fg: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)', dot: '#ef4444', label: 'Critical' },
  warning:  { fg: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', dot: '#f59e0b', label: 'Warning' },
  investigate: { fg: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.28)', dot: '#a78bfa', label: 'Investigate' },
  info:     { fg: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)', dot: '#60a5fa', label: 'Info' },
  low:      { fg: '#9ca3af', bg: 'rgba(156,163,175,0.10)', border: 'rgba(156,163,175,0.24)', dot: '#9ca3af', label: 'Low' },
  passing:  { fg: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)', dot: '#10b981', label: 'Pass' },
};

const Icon = ({ d, size = 14, stroke = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const ICONS = {
  back: <Icon d={<path d="m15 18-6-6 6-6" />} />,
  check: <Icon d={<path d="M20 6 9 17l-5-5" />} />,
  x: <Icon d={<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>} />,
  alert: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>} />,
  warn: <Icon d={<><path d="M10.3 3.9 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>} />,
  info: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>} />,
  chevronRight: <Icon d={<path d="m9 6 6 6-6 6" />} />,
  chevronDown: <Icon d={<path d="m6 9 6 6 6-6" />} />,
  external: <Icon d={<><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>} />,
  copy: <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />,
  spark: <Icon d={<><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m5.6 18.4 2.1-2.1" /><path d="m16.3 7.7 2.1-2.1" /></>} />,
  camera: <Icon d={<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3.5" /></>} />,
  doc: <Icon d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6" /></>} />,
  filter: <Icon d={<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z" />} />,
  sort: <Icon d={<><path d="M3 6h18" /><path d="M6 12h12" /><path d="M10 18h4" /></>} />,
  search: <Icon d={<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>} />,
  clock: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />,
  share: <Icon d={<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></>} />,
  more: <Icon d={<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>} />,
  dot: <Icon d={<circle cx="12" cy="12" r="1.5" />} />,
  link: <Icon d={<><path d="M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1-1" /></>} />,
  shield: <Icon d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />} />,
  zap: <Icon d={<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />} />,
  eye: <Icon d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>} />,
  play: <Icon d={<polygon points="5 3 19 12 5 21 5 3" />} />,
  arrowRight: <Icon d={<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>} />,
};

function sevIcon(sev) {
  if (sev === 'critical') return ICONS.alert;
  if (sev === 'warning') return ICONS.warn;
  if (sev === 'investigate') return ICONS.spark;
  return ICONS.info;
}

function SeverityPill({ sev, size = 'sm' }) {
  const s = SEV[sev] || SEV.low;
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6,
      padding: sm ? '2px 7px' : '3px 10px', borderRadius: 999,
      fontSize: sm ? 10 : 11, fontWeight: 600, letterSpacing: 0.3,
      textTransform: 'uppercase',
      color: s.fg, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: sm ? 5 : 6, height: sm ? 5 : 6, borderRadius: 99, background: s.dot, boxShadow: `0 0 8px ${s.dot}66` }} />
      {s.label}
    </span>
  );
}

function StatusChip({ status }) {
  const map = {
    completed: { fg: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'Completed' },
    running:   { fg: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Running' },
    failed:    { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Failed' },
  }[status] || { fg: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)', label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color: map.fg, background: map.bg, border: `1px solid ${map.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: map.fg }} />{map.label}
    </span>
  );
}

function AppShell({ children, accent = ACCENT.violet, density = 4, showHeader = true, innerPad = '28px 40px' }) {
  return (
    <div style={{
      background: '#0a0a0a', color: '#fafafa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
      minHeight: '100%', width: '100%', letterSpacing: -0.005,
      '--accent': accent,
    }}>
      {showHeader && <TopNav accent={accent} />}
      <div style={{ padding: innerPad }}>{children}</div>
    </div>
  );
}

function TopNav({ accent }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 40px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 7,
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: -0.4,
            boxShadow: `0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 14px ${accent}40`,
          }}>A</span>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Agent Hub</span>
        </div>
        <nav style={{ display: 'flex', gap: 2, fontSize: 13 }}>
          {['Projects', 'Runs', 'Suites', 'Skills'].map((l, i) => (
            <span key={l} style={{
              padding: '6px 10px', borderRadius: 6,
              color: i === 1 ? '#fafafa' : 'rgba(250,250,250,0.55)',
              background: i === 1 ? 'rgba(255,255,255,0.06)' : 'transparent',
              fontWeight: i === 1 ? 500 : 400,
            }}>{l}</span>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: 'rgba(250,250,250,0.6)', minWidth: 180,
        }}>
          {ICONS.search}<span>Search runs, findings…</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>⌘K</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 99, background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>MC</div>
      </div>
    </header>
  );
}

function Breadcrumbs({ items, accent }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(250,250,250,0.55)', marginBottom: 18 }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span style={{ color: i === items.length - 1 ? 'rgba(250,250,250,0.85)' : 'rgba(250,250,250,0.55)', fontWeight: i === items.length - 1 ? 500 : 400 }}>{it}</span>
          {i < items.length - 1 && <span style={{ color: 'rgba(250,250,250,0.25)' }}>/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

// Severity counts summary bar
function SeverityBar({ signals, labels = true }) {
  const total = signals.critical + signals.warning + signals.passing + (signals.info || 0);
  const rows = [
    { k: 'critical', v: signals.critical, c: SEV.critical },
    { k: 'warning', v: signals.warning, c: SEV.warning },
    { k: 'info', v: signals.info || 0, c: SEV.info },
    { k: 'passing', v: signals.passing, c: SEV.passing },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
        {rows.map((r) => r.v > 0 && (
          <div key={r.k} style={{ flex: r.v, background: r.c.dot, opacity: 0.85 }} />
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'rgba(250,250,250,0.6)' }}>
          {rows.map((r) => (
            <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: r.c.dot }} />
              <span style={{ color: 'rgba(250,250,250,0.85)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
              <span style={{ textTransform: 'capitalize' }}>{r.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Small placeholder "screenshot"
function ScreenshotPlaceholder({ label, accent, ratio = 16 / 10 }) {
  return (
    <div style={{
      aspectRatio: ratio, borderRadius: 8, overflow: 'hidden',
      background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative', display: 'flex', alignItems: 'flex-end',
    }}>
      {/* fake UI lines */}
      <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2].map((i)=>(<div key={i} style={{width:8,height:8,borderRadius:99,background:'rgba(255,255,255,0.08)'}}/>))}
        </div>
        <div style={{ height: 8, width: '60%', borderRadius: 3, background: 'rgba(255,255,255,0.1)', marginTop: 4 }} />
        <div style={{ height: 4, width: '85%', borderRadius: 2, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ height: 4, width: '70%', borderRadius: 2, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <div style={{ flex: 1, height: 24, borderRadius: 4, background: `${accent}22`, border: `1px solid ${accent}44` }} />
          <div style={{ flex: 1, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      <div style={{
        position: 'relative', width: '100%',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.75), transparent)',
        padding: '12px 10px 8px', fontSize: 10, color: 'rgba(255,255,255,0.85)',
      }}>{label}</div>
    </div>
  );
}

Object.assign(window, {
  ACCENT, SEV, Icon, ICONS, sevIcon,
  SeverityPill, StatusChip, AppShell, TopNav, Breadcrumbs, SeverityBar, ScreenshotPlaceholder,
});
