// Direction D — Evidence-linked storytelling. Vertical scroll-driven narrative
// pairing findings with their screenshots. Wide hero + two-column body.

function DirectionD({ accent = ACCENT.rose, density = 4 }) {
  const R = RUN;

  return (
    <AppShell accent={accent} innerPad="0">
      {/* HERO */}
      <section style={{
        padding: '48px 56px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: `
          radial-gradient(700px 240px at 85% 0%, ${accent}18, transparent 60%),
          radial-gradient(500px 200px at 10% 100%, ${accent}10, transparent 60%),
          #0a0a0a
        `,
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Breadcrumbs items={['Projects', R.project.name, 'Runs', R.runId.slice(0, 8)]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'center' }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 99,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 11, color: 'rgba(250,250,250,0.75)', marginBottom: 14,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: accent, boxShadow: `0 0 10px ${accent}` }} />
                {R.skill} · {R.date}
              </div>
              <h1 style={{ fontSize: 44, fontWeight: 600, letterSpacing: -0.9, lineHeight: 1.1, margin: 0, maxWidth: 720, textWrap: 'balance' }}>
                {R.verdict.headline}
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(250,250,250,0.6)', margin: '20px 0 0', maxWidth: 620 }}>
                {R.verdict.summary}
              </p>
            </div>
            <div style={{
              padding: 18, borderRadius: 12,
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.55)' }}>At a glance</span>
                <StatusChip status={R.status} />
              </div>
              <SeverityBar signals={R.signals} />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['Steps', `${R.coverage.stepsCompleted}/${R.coverage.stepsTotal}`],
                  ['Journeys', R.coverage.journeys],
                  ['Heuristic', `${R.coverage.heuristic}%`],
                  ['Duration', R.duration],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(250,250,250,0.5)' }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STORY BODY */}
      <section style={{ padding: '48px 56px 80px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 48 }}>
          {/* Sticky section nav */}
          <aside style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)', marginBottom: 10 }}>On this page</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
              <NavLink accent={accent} active>Top recommendations</NavLink>
              <NavLink accent={accent}>Critical findings</NavLink>
              <NavLink accent={accent}>Warnings</NavLink>
              <NavLink accent={accent}>Journey coverage</NavLink>
              <NavLink accent={accent}>Notes & follow-ups</NavLink>
              <NavLink accent={accent}>Evidence gallery</NavLink>
            </nav>
          </aside>

          <div style={{ minWidth: 0 }}>
            {/* TOP RECS */}
            <StorySection title="Top recommendations" subtitle="What to do first." accent={accent}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {R.recommendations.map((r, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '40px 80px 1fr auto', alignItems: 'center', gap: 16,
                    padding: '14px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(250,250,250,0.3)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      fontFamily: 'ui-monospace, monospace', textAlign: 'center',
                      color: r.priority === 'P0' ? SEV.critical.fg : r.priority === 'P1' ? SEV.warning.fg : SEV.info.fg,
                      background: r.priority === 'P0' ? SEV.critical.bg : r.priority === 'P1' ? SEV.warning.bg : SEV.info.bg,
                      border: `1px solid ${r.priority === 'P0' ? SEV.critical.border : r.priority === 'P1' ? SEV.warning.border : SEV.info.border}`,
                    }}>{r.priority}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(250,250,250,0.94)' }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'rgba(250,250,250,0.55)', marginTop: 2 }}>{r.action}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.45)' }}>{r.effort} · {r.owner}</div>
                  </div>
                ))}
              </div>
            </StorySection>

            {/* CRITICAL */}
            <StorySection title="Critical findings" subtitle="Trust-eroding bugs at critical moments." accent={accent}>
              {R.findings.filter((f) => f.severity === 'critical').map((f) => (
                <EvidenceBlock key={f.id} f={f} accent={accent} />
              ))}
            </StorySection>

            {/* WARNINGS */}
            <StorySection title="Warnings" subtitle="Rough edges that don't block a user, but erode polish." accent={accent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {R.findings.filter((f) => f.severity === 'warning').map((f) => <MiniFinding key={f.id} f={f} accent={accent} />)}
              </div>
            </StorySection>

            {/* COVERAGE */}
            <StorySection title="Journey coverage" subtitle="15 of 15 steps across 10 journeys." accent={accent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {R.sections.map((s) => {
                  const c = s.level === 'critical' ? SEV.critical : s.level === 'watch' ? SEV.warning : SEV.passing;
                  return (
                    <div key={s.id} style={{
                      padding: 14, borderRadius: 9,
                      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: c.dot }} />
                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: c.fg }}>{s.level}</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(250,250,250,0.92)', marginBottom: 3 }}>{s.title}</div>
                      <div style={{ fontSize: 11.5, color: 'rgba(250,250,250,0.55)', lineHeight: 1.5 }}>{s.summary}</div>
                    </div>
                  );
                })}
              </div>
            </StorySection>

            {/* NOTES */}
            <StorySection title="Notes & follow-ups" subtitle="Lower priority, but worth tracking." accent={accent}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {R.findings.filter((f) => f.severity === 'info' || f.severity === 'low' || f.severity === 'investigate').map((f) => (
                  <li key={f.id} style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 14,
                    padding: '11px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <SeverityPill sev={f.severity} />
                    <span style={{ fontSize: 13, color: 'rgba(250,250,250,0.88)' }}>{f.title}</span>
                    <span style={{ fontSize: 11, color: 'rgba(250,250,250,0.45)' }}>{f.category}</span>
                  </li>
                ))}
              </ul>
            </StorySection>

            {/* EVIDENCE */}
            <StorySection title="Evidence gallery" subtitle={`${R.screenshots.length} screenshots captured during the run.`} accent={accent}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {R.screenshots.map((s) => <ScreenshotPlaceholder key={s.id} label={s.label} accent={accent} />)}
              </div>
            </StorySection>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function NavLink({ children, active, accent }) {
  return (
    <a style={{
      padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
      color: active ? '#fafafa' : 'rgba(250,250,250,0.55)',
      background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
      borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
      paddingLeft: 10,
    }}>{children}</a>
  );
}

function StorySection({ title, subtitle, accent, children }) {
  return (
    <section style={{ marginBottom: 52 }}>
      <header style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: 'rgba(250,250,250,0.55)', margin: '4px 0 0' }}>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function EvidenceBlock({ f, accent }) {
  const s = SEV[f.severity];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24,
      padding: '18px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
      alignItems: 'start',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: s.fg, fontWeight: 600 }}>{f.id}</span>
          <SeverityPill sev={f.severity} />
          <span style={{ fontSize: 11, color: 'rgba(250,250,250,0.5)' }}>{f.category}</span>
          {f.heuristic && <span style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)' }}>· {f.heuristic}</span>}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.25, margin: '0 0 10px', lineHeight: 1.3 }}>{f.title}</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(250,250,250,0.72)', margin: '0 0 12px' }}>{f.impact}</p>
        <div style={{
          padding: '10px 14px', borderRadius: 7,
          background: `${accent}10`, border: `1px solid ${accent}33`,
          fontSize: 12.5, lineHeight: 1.5, color: 'rgba(250,250,250,0.88)',
        }}>
          <strong style={{ color: accent, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Recommendation</strong>
          {f.recommendation}
        </div>
        {f.location && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(250,250,250,0.5)', fontFamily: 'ui-monospace, monospace' }}>{f.location}</div>
        )}
      </div>
      <div>
        <ScreenshotPlaceholder label={f.evidence || 'No evidence captured'} accent={accent} ratio={16 / 11} />
      </div>
    </div>
  );
}

function MiniFinding({ f, accent }) {
  const s = SEV[f.severity];
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: `2px solid ${s.dot}`,
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: s.fg, fontWeight: 600 }}>{f.id}</span>
        <span style={{ fontSize: 10, color: 'rgba(250,250,250,0.5)' }}>{f.category}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'rgba(250,250,250,0.9)', fontWeight: 500 }}>{f.title}</div>
      <div style={{ fontSize: 11.5, color: 'rgba(250,250,250,0.55)', marginTop: 4, lineHeight: 1.5 }}>{f.recommendation}</div>
    </div>
  );
}

window.DirectionD = DirectionD;
