// Direction B — Executive dashboard. Big health hero, severity at a glance,
// step timeline, findings board below. Commanding and data-rich.

function DirectionB({ accent = ACCENT.blue, density = 4 }) {
  const R = RUN;
  const pad = 8 + density * 2;

  const healthScore = Math.round(
    (R.signals.passing / (R.signals.critical * 3 + R.signals.warning * 1.5 + R.signals.passing + 0.1)) * 100,
  );

  return (
    <AppShell accent={accent} innerPad="0">
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 40px 80px' }}>
        <Breadcrumbs items={['Projects', R.project.name, 'Runs', R.runId.slice(0, 8)]} />

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>{R.skill}</h1>
              <StatusChip status={R.status} />
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(250,250,250,0.55)' }}>
              {R.project.name} · {R.date} · {R.time} · {R.duration}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fafafa',
            }}>{ICONS.play}Re-run</button>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              background: accent, color: '#fff', border: 'none',
            }}>{ICONS.share}Share report</button>
          </div>
        </div>

        {/* HEALTH HERO: score + verdict + severity rings */}
        <section style={{
          display: 'grid', gridTemplateColumns: '320px 1fr 400px', gap: 18, marginBottom: 18,
        }}>
          <HealthScoreCard score={healthScore} severity={R.verdict.severity} accent={accent} signals={R.signals} />
          <VerdictCard verdict={R.verdict} accent={accent} />
          <MetricStack coverage={R.coverage} findings={R.findings.length} accent={accent} />
        </section>

        {/* STEP TIMELINE */}
        <section style={{ marginBottom: 18 }}>
          <SectionHeader title="Journey timeline" subtitle={`${R.coverage.stepsCompleted} of ${R.coverage.stepsTotal} steps · ${R.coverage.journeys} journeys`} accent={accent} />
          <div style={{
            padding: '18px 20px', borderRadius: 12,
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <StepTimeline steps={R.steps} findings={R.findings} accent={accent} />
          </div>
        </section>

        {/* TRIAGE + RECS */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, marginBottom: 18 }}>
          <div>
            <SectionHeader title="Findings" subtitle="Sorted by severity · click to open" accent={accent} count={R.findings.length} />
            <FindingsTable findings={R.findings} accent={accent} />
          </div>
          <div>
            <SectionHeader title="Top 5" subtitle="Prioritized" accent={accent} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {R.recommendations.map((r, i) => <RecCard key={i} r={r} accent={accent} />)}
            </div>
          </div>
        </section>

        {/* EVIDENCE */}
        <section>
          <SectionHeader title="Screenshots" accent={accent} count={R.screenshots.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {R.screenshots.map((s) => <ScreenshotPlaceholder key={s.id} label={s.label} accent={accent} />)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function HealthScoreCard({ score, severity, accent, signals }) {
  const ringColor = score < 50 ? SEV.critical.dot : score < 75 ? SEV.warning.dot : SEV.passing.dot;
  const r = 58, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{
      padding: 20, borderRadius: 12,
      background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.55)', marginBottom: 10 }}>Health score</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
            <circle cx="70" cy="70" r={r} fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`} style={{ filter: `drop-shadow(0 0 6px ${ringColor}88)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
            <div style={{ fontSize: 10, color: 'rgba(250,250,250,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>/ 100</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            padding: '3px 8px', borderRadius: 4, marginBottom: 12,
            color: SEV.warning.fg, background: SEV.warning.bg, border: `1px solid ${SEV.warning.border}`,
          }}>{severity}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11 }}>
            <SevRow count={signals.critical} label="Critical" sev="critical" />
            <SevRow count={signals.warning} label="Warning" sev="warning" />
            <SevRow count={signals.passing} label="Passing" sev="passing" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SevRow({ count, label, sev }) {
  const s = SEV[sev];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.dot }} />
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: s.fg, minWidth: 16 }}>{count}</span>
      <span style={{ color: 'rgba(250,250,250,0.6)' }}>{label}</span>
    </div>
  );
}

function VerdictCard({ verdict, accent }) {
  return (
    <div style={{
      padding: 22, borderRadius: 12,
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.55)', marginBottom: 10 }}>Verdict</div>
      <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4, letterSpacing: -0.2, color: 'rgba(250,250,250,0.94)', marginBottom: 12 }}>
        {verdict.headline}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'rgba(250,250,250,0.6)' }}>{verdict.summary}</p>
      <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 12, fontSize: 11, color: accent }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>{ICONS.doc} Open full report{ICONS.arrowRight}</span>
      </div>
    </div>
  );
}

function MetricStack({ coverage, findings, accent }) {
  const items = [
    { label: 'Steps completed', v: `${coverage.stepsCompleted}/${coverage.stepsTotal}`, delta: null },
    { label: 'Journeys covered', v: coverage.journeys, delta: '+2 vs last' },
    { label: 'Heuristic coverage', v: `${coverage.heuristic}%`, delta: '−4 vs last', deltaNeg: true },
    { label: 'Findings raised', v: findings, delta: '+3 vs last', deltaNeg: true },
  ];
  return (
    <div style={{
      padding: 18, borderRadius: 12,
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
    }}>
      {items.map((m, i) => (
        <div key={m.label} style={{
          padding: '12px 14px',
          borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)' }}>{m.label}</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{m.v}</div>
          {m.delta && (
            <div style={{ fontSize: 10.5, marginTop: 4, color: m.deltaNeg ? SEV.warning.fg : SEV.passing.fg }}>{m.delta}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function StepTimeline({ steps, findings, accent }) {
  const findingMap = Object.fromEntries(findings.map((f) => [f.id, f]));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 4, marginBottom: 14 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ position: 'relative' }}>
            <div style={{
              height: 22, borderRadius: 4,
              background: s.status === 'pass' ? 'rgba(16,185,129,0.22)' : s.status === 'fail' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.28)',
              border: `1px solid ${s.status === 'pass' ? 'rgba(16,185,129,0.4)' : s.status === 'fail' ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontFamily: 'ui-monospace, monospace',
              color: s.status === 'pass' ? SEV.passing.fg : s.status === 'fail' ? SEV.critical.fg : SEV.warning.fg,
              fontWeight: 600,
            }}>{s.n}</div>
            {s.finding && (
              <div style={{ position: 'absolute', top: -6, right: -4, width: 10, height: 10, borderRadius: 99,
                background: SEV.critical.dot, border: '2px solid #0a0a0a', boxShadow: `0 0 6px ${SEV.critical.dot}` }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(250,250,250,0.6)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(16,185,129,0.3)', border: `1px solid ${SEV.passing.border}` }} />{steps.filter((s) => s.status === 'pass').length} pass</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(245,158,11,0.3)', border: `1px solid ${SEV.warning.border}` }} />{steps.filter((s) => s.status === 'warn').length} warn</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(239,68,68,0.3)', border: `1px solid ${SEV.critical.border}` }} />{steps.filter((s) => s.status === 'fail').length} fail</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'rgba(250,250,250,0.4)' }}>
          hover a step to see journey group
        </span>
      </div>
    </div>
  );
}

function FindingsTable({ findings, accent }) {
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '60px 110px 1fr 160px 120px',
        padding: '10px 16px',
        fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div>ID</div><div>Severity</div><div>Issue</div><div>Category</div><div>Location</div>
      </div>
      {findings.map((f, i) => (
        <div key={f.id} style={{
          display: 'grid', gridTemplateColumns: '60px 110px 1fr 160px 120px',
          padding: '12px 16px', alignItems: 'center', gap: 8,
          borderBottom: i < findings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          fontSize: 12.5,
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', color: SEV[f.severity].fg, fontWeight: 600, fontSize: 11 }}>{f.id}</div>
          <div><SeverityPill sev={f.severity} /></div>
          <div style={{ color: 'rgba(250,250,250,0.92)' }}>{f.title}</div>
          <div style={{ color: 'rgba(250,250,250,0.55)' }}>{f.category}</div>
          <div style={{ color: 'rgba(250,250,250,0.45)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{f.location || '—'}</div>
        </div>
      ))}
    </div>
  );
}

function RecCard({ r, accent }) {
  const pMap = { P0: SEV.critical, P1: SEV.warning, P2: SEV.info };
  const p = pMap[r.priority] || SEV.info;
  return (
    <div style={{
      padding: 12, borderRadius: 9,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: p.bg, border: `1px solid ${p.border}`, color: p.fg,
          fontFamily: 'ui-monospace, monospace',
        }}>{r.priority}</span>
        <span style={{ fontSize: 10, color: 'rgba(250,250,250,0.5)' }}>{r.effort} effort · {r.owner}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(250,250,250,0.94)', lineHeight: 1.4 }}>{r.title}</div>
      <div style={{ fontSize: 11.5, color: 'rgba(250,250,250,0.58)', lineHeight: 1.55, marginTop: 4 }}>{r.action}</div>
    </div>
  );
}

window.DirectionB = DirectionB;
