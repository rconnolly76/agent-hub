import {
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { SkillParserConfig } from "../parsers/types";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  repoUrl: text("repo_url"),
  apiKey: text("api_key").notNull(),
  /** Maps ingest `skillType` → parser options (which parser id, generic fallback limits). */
  skillParserConfig: jsonb("skill_parser_config").$type<SkillParserConfig | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  skillType: text("skill_type").notNull(),
  status: text("status").notNull().default("completed"),
  executiveSummary: text("executive_summary"),
  rawMetadata: jsonb("raw_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  blobUrl: text("blob_url").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: real("value").notNull(),
  unit: text("unit"),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  recommendation: jsonb("recommendation"),
  status: text("status").notNull().default("open"),
  /** e.g. SEC-001 from skill report — powers cross-run project reconciliation */
  runFindingId: text("run_finding_id"),
  /** health = code/ux audits; strategy = GTM, research, roadmap, backlog */
  facet: text("facet"),
  extra: jsonb("extra").$type<{ affectedFiles?: string[] } | null>(),
});

/**
 * Deduplicated logical issue per project (reconciled across runs; deterministic, no LLM in v1).
 */
export const projectFindings = pgTable(
  "project_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** `${skillType}::${runFindingId || normalizeTitle}` */
    dedupeKey: text("dedupe_key").notNull(),
    skillType: text("skill_type").notNull(),
    facet: text("facet").notNull().default("health"),
    runFindingId: text("run_finding_id"),
    title: text("title").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    firstRunId: uuid("first_run_id").references(() => runs.id, { onDelete: "set null" }),
    lastRunId: uuid("last_run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    lastHubFindingId: uuid("last_hub_finding_id").references(() => findings.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectDedupe: uniqueIndex("project_findings_project_dedupe").on(
      t.projectId,
      t.dedupeKey
    ),
  })
);

/** Stored when project reconciliation compares this run to prior state */
export const trendEvents = pgTable("trend_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  projectFindingId: uuid("project_finding_id").references(() => projectFindings.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  skillType: text("skill_type").notNull(),
  fromRunId: uuid("from_run_id").references(() => runs.id, { onDelete: "set null" }),
  toRunId: uuid("to_run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  detail: jsonb("detail").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Full markdown text for content-bundle files (query/search); blobs remain canonical for assets. */
export const contentDocuments = pgTable(
  "content_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => artifacts.id, {
      onDelete: "set null",
    }),
    ingestSkillType: text("ingest_skill_type").notNull(),
    manifestSkillType: text("manifest_skill_type"),
    relativePath: text("relative_path").notNull(),
    title: text("title").notNull(),
    category: text("category"),
    description: text("description"),
    bodyMarkdown: text("body_markdown").notNull(),
    blobUrl: text("blob_url").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    runPathUnique: uniqueIndex("content_documents_run_id_relative_path").on(
      t.runId,
      t.relativePath
    ),
  })
);

// Relations

export const projectsRelations = relations(projects, ({ many }) => ({
  runs: many(runs),
  contentDocuments: many(contentDocuments),
  projectFindings: many(projectFindings),
  trendEvents: many(trendEvents),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, {
    fields: [runs.projectId],
    references: [projects.id],
  }),
  artifacts: many(artifacts),
  metrics: many(metrics),
  findings: many(findings),
  contentDocuments: many(contentDocuments),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  run: one(runs, {
    fields: [artifacts.runId],
    references: [runs.id],
  }),
}));

export const metricsRelations = relations(metrics, ({ one }) => ({
  run: one(runs, {
    fields: [metrics.runId],
    references: [runs.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  run: one(runs, {
    fields: [findings.runId],
    references: [runs.id],
  }),
}));

export const contentDocumentsRelations = relations(contentDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [contentDocuments.projectId],
    references: [projects.id],
  }),
  run: one(runs, {
    fields: [contentDocuments.runId],
    references: [runs.id],
  }),
  artifact: one(artifacts, {
    fields: [contentDocuments.artifactId],
    references: [artifacts.id],
  }),
}));

export const projectFindingsRelations = relations(projectFindings, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectFindings.projectId],
    references: [projects.id],
  }),
  firstRun: one(runs, {
    fields: [projectFindings.firstRunId],
    references: [runs.id],
  }),
  lastRun: one(runs, {
    fields: [projectFindings.lastRunId],
    references: [runs.id],
  }),
  lastHubFinding: one(findings, {
    fields: [projectFindings.lastHubFindingId],
    references: [findings.id],
  }),
  trends: many(trendEvents),
}));

export const trendEventsRelations = relations(trendEvents, ({ one }) => ({
  project: one(projects, {
    fields: [trendEvents.projectId],
    references: [projects.id],
  }),
  projectFinding: one(projectFindings, {
    fields: [trendEvents.projectFindingId],
    references: [projectFindings.id],
  }),
  fromRun: one(runs, {
    fields: [trendEvents.fromRunId],
    references: [runs.id],
  }),
  toRun: one(runs, {
    fields: [trendEvents.toRunId],
    references: [runs.id],
  }),
}));
