// Direction C — Command Center. Dense multi-pane: left nav, center kanban triage board,
// right evidence inspector. Keyboard-driven power-user feel.

function DirectionC({ accent = ACCENT.emerald, density = 4 }) {
  const R = RUN;
  const [selected, setSelected] = React.useState(R.findings[0].id);
  const sel = R.findings.find((f) => f.id === selected) || R.findings[0];

  return (
    <AppShell accent={accent} innerPad="0" showHeader={false}>
      {/* SLIM HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 5,
          background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>A</span>
        <span style={{ color: 'rgba(250,250,250,0.55)' }}>{R.project.name}</span>
        <span style={{ color: 'rgba(250,250,250,0.3)' }}>/</span>
        <span style={{ color: 'rgba(250,250,250,0.55)' }}>runs</span>
        <span style={{ color: 'rgba(250,250,250,0.3)' }}>/</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: 'rgba(250,250,250,0.9)' }}>{R.runId.slice(0, 8)}</span>
        <StatusChip status={R.status} />
        <span style={{ color: 'rgba(250,250,250,0.5)' }}>{R.skill} · {R.date} · {R.duration}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Kbd k="J" /><Kbd k="K" /><span style={{ color: 'rgba(250,250,250,0.45)' }}>navigate</span>
          <span style={{ margin: '0 8px', color: 'rgba(250,250,250,0.2)' }}>·</span>
          <Kbd k="E" /><span style={{ color: 'rgba(250,250,250,0.45)' }}>evidence</span>
          <span style={{ margin: '0 8px', color: 'rgba(250,250,250,0.2)' }}>·</span>
          <Kbd k="⌘K" /><span style={{ color: 'rgba(250,250,250,0.45)' }}>palette</span>
        </span>
      </div>

      {/* 3-PANE */}
      <div style={{
        display: 'grid', gridTemplateColumns: '220px 1fr 400px',
        height: 'calc(100% - 42px)', minHeight: 'calc(100vh - 42px)',
      }}>
        {/* LEFT NAV */}
        <aside style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 18,
          overflowY: 'auto',
        }}>
          <NavSection title="Overview" items={[
            { label: 'Summary', icon: ICONS.doc, active: true },
            { label: 'Verdict', icon: ICONS.spark },
            { label: 'Recommendations', icon: ICONS.zap, count: 5 },
          ]} accent={accent} />
          <NavSection title="Triage" items={[
            { label: 'All findings', icon: ICONS.filter, count: R.findings.length, active: true },
            { label: 'Critical', icon: ICONS.alert, count: R.signals.critical, tint: SEV.critical.fg },
            { label: 'Warning', icon: ICONS.warn, count: R.signals.warning, tint: SEV.warning.fg },
            { label: 'Passing', icon: ICONS.check, count: R.signals.passing, tint: SEV.passing.fg },
          ]} accent={accent} />
          <NavSection title="Report" items={R.sections.map((s) => ({
            label: s.title, icon: ICONS.dot,
            tint: s.level === 'critical' ? SEV.critical.fg : s.level === 'watch' ? SEV.warning.fg : SEV.passing.fg,
          }))} accent={accent} />
          <NavSection title="Evidence" items={[
            { label: 'Screenshots', icon: ICONS.camera, count: R.screenshots.length },
            { label: 'Steps', icon: ICONS.play, count: R.steps.length },
          ]} accent={accent} />
        </aside>

        {/* CENTER BOARD */}
        <main style={{ padding: '18px 22px', overflowY: 'auto' }}>
          {/* TITLE ROW */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>Triage board</h1>
            <span style={{ fontSize: 12, color: 'rgba(250,250,250,0.5)' }}>{R.findings.length} findings · drag to re-prioritize</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <FilterChip label="All" active accent={accent} />
              <FilterChip label="Mine" />
              <FilterChip label="P0" tint={SEV.critical.fg} />
              <FilterChip label="Open" />
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(250,250,250,0.7)',
              }}>{ICONS.sort}Severity</button>
            </div>
          </div>

          {/* VERDICT STRIP */}
          <div style={{
            padding: '12px 16px', borderRadius: 9, marginBottom: 16,
            background: 'rgba(245,158,11,0.06)', border: `1px solid ${SEV.warning.border}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
              color: SEV.warning.fg, background: SEV.warning.bg, border: `1px solid ${SEV.warning.border}`,
            }}>{R.verdict.severity}</span>
            <span style={{ fontSize: 12.5, color: 'rgba(250,250,250,0.88)' }}>{R.verdict.headline}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Read full verdict{ICONS.arrowRight}
            </span>
          </div>

          {/* KANBAN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { key: 'critical', items: R.findings.filter((f) => f.severity === 'critical') },
              { key: 'warning', items: R.findings.filter((f) => f.severity === 'warning') },
              { key: 'investigate', items: R.findings.filter((f) => f.severity === 'investigate' || f.severity === 'info') },
              { key: 'low', items: R.findings.filter((f) => f.severity === 'low') },
            ].map((col) => {
              const s = SEV[col.key];
              return (
                <div key={col.key} style={{
                  padding: 10, borderRadius: 9,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  minHeight: 300,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 10px',
                    borderBottom: `1px solid rgba(255,255,255,0.05)`,
                    marginBottom: 10,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(250,250,250,0.8)' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: 'rgba(250,250,250,0.5)', fontVariantNumeric: 'tabular-nums' }}>{col.items.length}</span>
                    <span style={{ marginLeft: 'auto', color: 'rgba(250,250,250,0.4)' }}>{ICONS.more}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {col.items.map((f) => (
                      <KanbanCard key={f.id} f={f} selected={f.id === selected} onClick={() => setSelected(f.id)} accent={accent} />
                    ))}
                    {col.items.length === 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.35)', padding: '20px 4px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 6 }}>No issues</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* STEPS SPARKLINE */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'rgba(250,250,250,0.85)' }}>Steps</h2>
              <span style={{ fontSize: 11, color: 'rgba(250,250,250,0.5)' }}>{R.coverage.stepsCompleted}/{R.coverage.stepsTotal} · {R.coverage.journeys} journeys</span>
            </div>
            <div style={{ padding: 10, borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {R.steps.map((st) => (
                  <div key={st.n} title={`${st.group} · ${st.name}`} style={{
                    width: 32, height: 28, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontFamily: 'ui-monospace, monospace', fontWeight: 600,
                    background: st.status === 'pass' ? 'rgba(16,185,129,0.15)' : st.status === 'fail' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)',
                    color: st.status === 'pass' ? SEV.passing.fg : st.status === 'fail' ? SEV.critical.fg : SEV.warning.fg,
                    border: `1px solid ${st.status === 'pass' ? SEV.passing.border : st.status === 'fail' ? SEV.critical.border : SEV.warning.border}`,
                  }}>{st.n}</div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT INSPECTOR */}
        <aside style={{
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 18px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <Inspector f={sel} accent={accent} />
        </aside>
      </div>
    </AppShell>
  );
}

function NavSection({ title, items, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.4)', padding: '0 8px 6px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5,
            fontSize: 12.5, cursor: 'pointer',
            background: it.active ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: it.active ? 'rgba(250,250,250,0.95)' : 'rgba(250,250,250,0.65)',
          }}>
            <span style={{ color: it.tint || (it.active ? accent : 'rgba(250,250,250,0.5)'), display: 'flex' }}>{it.icon}</span>
            <span>{it.label}</span>
            {it.count != null && (
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'rgba(250,250,250,0.5)', fontVariantNumeric: 'tabular-nums' }}>{it.count}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kbd({ k }) {
  return <span style={{
    fontFamily: 'ui-monospace, monospace', fontSize: 10, padding: '2px 5px',
    borderRadius: 3, background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(250,250,250,0.75)',
  }}>{k}</span>;
}

function FilterChip({ label, active, tint, accent }) {
  return (
    <button style={{
      padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      border: `1px solid ${active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
      color: tint || (active ? '#fafafa' : 'rgba(250,250,250,0.65)'),
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {tint && <span style={{ width: 5, height: 5, borderRadius: 99, background: tint }} />}
      {label}
    </button>
  );
}

function KanbanCard({ f, selected, onClick, accent }) {
  const s = SEV[f.severity] || SEV.low;
  return (
    <div onClick={onClick} style={{
      padding: 10, borderRadius: 7, cursor: 'pointer',
      background: selected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
      border: selected ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.06)',
      boxShadow: selected ? `0 0 0 3px ${accent}22` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: s.fg, fontWeight: 600 }}>{f.id}</span>
        <span style={{ fontSize: 9.5, color: 'rgba(250,250,250,0.4)' }}>{f.category}</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(250,250,250,0.9)', fontWeight: 500 }}>{f.title}</div>
      {f.evidence && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(250,250,250,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {ICONS.camera}evidence
        </div>
      )}
    </div>
  );
}

function Inspector({ f, accent }) {
  const s = SEV[f.severity] || SEV.low;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: s.fg, fontWeight: 700 }}>{f.id}</span>
        <SeverityPill sev={f.severity} />
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(250,250,250,0.5)' }}>{f.category}</span>
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2, margin: 0, lineHeight: 1.35 }}>{f.title}</h3>

      {f.evidence && (
        <div>
          <ScreenshotPlaceholder label={f.evidence} accent={accent} ratio={16 / 11} />
        </div>
      )}

      <Block title="Impact" body={f.impact} />
      <Block title="Recommendation" body={f.recommendation} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Meta label="Location" value={f.location || '—'} mono />
        <Meta label="Heuristic" value={f.heuristic || '—'} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button style={{
          flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: accent, color: '#fff', border: 'none', fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>{ICONS.link}Open in Linear</button>
        <button style={{
          padding: '7px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', color: '#fafafa',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>Dismiss</button>
      </div>
    </>
  );
}

function Block({ title, body }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)', marginBottom: 6 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'rgba(250,250,250,0.78)' }}>{body}</p>
    </div>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(250,250,250,0.45)' }}>{label}</div>
      <div style={{ fontSize: 11.5, marginTop: 3, color: 'rgba(250,250,250,0.85)', fontFamily: mono ? 'ui-monospace, monospace' : 'inherit', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

window.DirectionC = DirectionC;
