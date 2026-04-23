// Direction A — Editorial. Report-first reading comfort with a tight triage summary
// at the top. Calm, narrow-measure, sharp typography, quiet sidebar.

function DirectionA({ accent = ACCENT.violet, density = 4 }) {
  const R = RUN;
  const pad = 8 + density * 2;
  const cardPad = 12 + density * 2.5;

  return (
    <AppShell accent={accent} density={density} innerPad="0">
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 56px 80px' }}>
        <Breadcrumbs items={['Projects', R.project.name, 'Runs', `${R.skill}`]} />

        {/* HERO */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'start', paddingBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: accent }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: accent, boxShadow: `0 0 12px ${accent}` }} />
              {R.skill}
            </div>
            <h1 style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 600, letterSpacing: -0.8, margin: 0, maxWidth: 780, textWrap: 'balance' }}>
              {R.verdict.headline}
            </h1>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 18, fontSize: 12, color: 'rgba(250,250,250,0.55)' }}>
              <StatusChip status={R.status} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{ICONS.clock}{R.date} · {R.time}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{R.duration}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.7 }}>{R.runId.slice(0, 8)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn icon={ICONS.share} label="Share" />
            <IconBtn icon={ICONS.copy} label="Export" />
            <IconBtn icon={ICONS.more} />
          </div>
        </header>

        {/* VERDICT BAND */}
        <section style={{ padding: '28px 0 24px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)' }}>Verdict</span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                padding: '3px 8px', borderRadius: 4,
                color: SEV.warning.fg, background: SEV.warning.bg, border: `1px solid ${SEV.warning.border}`,
              }}>{R.verdict.severity}</span>
            </div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: 'rgba(250,250,250,0.82)', maxWidth: 640 }}>
              {R.verdict.summary}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)', marginBottom: 12 }}>Signals</div>
            <SeverityBar signals={R.signals} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
              <KPI label="Steps" value={`${R.coverage.stepsCompleted}/${R.coverage.stepsTotal}`} />
              <KPI label="Journeys" value={R.coverage.journeys} />
              <KPI label="Heuristic" value={`${R.coverage.heuristic}%`} />
              <KPI label="Findings" value={R.findings.length} />
            </div>
          </div>
        </section>

        {/* TRIAGE GRID (collapsed report, findings front-and-center) */}
        <section style={{ margin: '8px 0 40px' }}>
          <SectionHeader title="Triage" subtitle="Every finding, sorted by severity. Click through to evidence." accent={accent} count={R.findings.length} />
          <TriageGrid findings={R.findings} accent={accent} pad={cardPad} />
        </section>

        {/* COLLAPSED REPORT */}
        <section style={{ marginTop: 32 }}>
          <SectionHeader title="Full report" subtitle="Ingested, structured, and cross-linked." accent={accent} />
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            {R.sections.map((s) => <ReportRow key={s.id} section={s} accent={accent} />)}
          </div>
        </section>

        {/* EVIDENCE STRIP */}
        <section style={{ marginTop: 40 }}>
          <SectionHeader title="Evidence" subtitle="Screenshots captured during this run." accent={accent} count={R.screenshots.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {R.screenshots.map((s) => (
              <ScreenshotPlaceholder key={s.id} label={s.label} accent={accent} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function IconBtn({ icon, label }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 11px', borderRadius: 7,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(250,250,250,0.85)', fontSize: 12, cursor: 'pointer',
    }}>{icon}{label && <span>{label}</span>}</button>
  );
}

function KPI({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(250,250,250,0.5)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, accent, count }) {
  return (
    <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3, margin: 0 }}>{title}</h2>
      {count != null && (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(250,250,250,0.7)',
          fontVariantNumeric: 'tabular-nums',
        }}>{count}</span>
      )}
      {subtitle && (
        <span style={{ fontSize: 13, color: 'rgba(250,250,250,0.5)', marginLeft: 'auto' }}>{subtitle}</span>
      )}
    </header>
  );
}

function TriageGrid({ findings, accent, pad = 16 }) {
  // Split into severity columns
  const groups = [
    { key: 'critical', title: 'Critical', items: findings.filter((f) => f.severity === 'critical') },
    { key: 'warning',  title: 'Warning',  items: findings.filter((f) => f.severity === 'warning') },
    { key: 'info',     title: 'Notes',    items: findings.filter((f) => f.severity === 'info' || f.severity === 'investigate' || f.severity === 'low') },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(250,250,250,0.55)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: SEV[g.key].dot }} />
            {g.title}
            <span style={{ marginLeft: 'auto', color: 'rgba(250,250,250,0.4)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{g.items.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.items.map((f) => <FindingCard key={f.id} f={f} pad={pad} accent={accent} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FindingCard({ f, pad, accent }) {
  const s = SEV[f.severity] || SEV.low;
  return (
    <div style={{
      padding: pad, borderRadius: 9,
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderLeft: `2px solid ${s.dot}`,
      transition: 'background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 10 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: s.fg, fontWeight: 600 }}>{f.id}</span>
        <span style={{ color: 'rgba(250,250,250,0.4)' }}>·</span>
        <span style={{ color: 'rgba(250,250,250,0.6)' }}>{f.category}</span>
        {f.heuristic && (<><span style={{ color: 'rgba(250,250,250,0.3)' }}>·</span><span style={{ color: 'rgba(250,250,250,0.5)' }}>{f.heuristic.split(' · ')[0]}</span></>)}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: 'rgba(250,250,250,0.94)', marginBottom: 8, letterSpacing: -0.15 }}>
        {f.title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(250,250,250,0.62)' }}>{f.impact}</div>
      {(f.location || f.evidence) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 10, color: 'rgba(250,250,250,0.45)' }}>
          {f.location && <span style={{ fontFamily: 'ui-monospace, monospace' }}>{f.location}</span>}
          {f.evidence && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: accent }}>{ICONS.camera}evidence</span>}
        </div>
      )}
    </div>
  );
}

function ReportRow({ section, accent }) {
  const s = SEV[section.level === 'watch' ? 'warning' : section.level === 'critical' ? 'critical' : 'passing'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '100px 200px 1fr auto', alignItems: 'center', gap: 16,
      padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: s.fg }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: s.dot }} />
        {section.level}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(250,250,250,0.92)' }}>{section.title}</div>
      <div style={{ fontSize: 12.5, color: 'rgba(250,250,250,0.55)' }}>{section.summary}</div>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'rgba(250,250,250,0.45)' }}>
        {section.critical > 0 && <span style={{ color: SEV.critical.fg }}>{section.critical} critical</span>}
        {section.warning > 0 && <span style={{ color: SEV.warning.fg }}>{section.warning} warn</span>}
        <span style={{ color: accent }}>{ICONS.chevronRight}</span>
      </div>
    </div>
  );
}

window.DirectionA = DirectionA;
