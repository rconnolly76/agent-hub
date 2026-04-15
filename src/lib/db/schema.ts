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
