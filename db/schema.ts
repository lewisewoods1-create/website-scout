import {
  sqliteTable,
  integer,
  text,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// ── Businesses ──
export const businesses = sqliteTable("businesses", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  externalId: text("external_id"),
  name: text("name").notNull(),
  owner: text("owner"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  socialLinks: text("social_links", { mode: "json" }).$type<Record<string, string>>(),
  industry: text("industry"),
  openingHours: text("opening_hours"),
  googleRating: real("google_rating"),
  reviewCount: integer("review_count"),
  city: text("city"),
  region: text("region"),
  postcode: text("postcode"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  description: text("description"),
  hasWebsite: integer("has_website", { mode: "boolean" }).notNull().default(false),
  source: text("source").default("google_places"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_business_city").on(table.city),
  index("idx_business_industry").on(table.industry),
  index("idx_business_external").on(table.externalId),
]);

// ── Leads ──
export const leads = sqliteTable("leads", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  status: text("status").notNull().default("new"),
  stage: text("stage").notNull().default("research"),
  overallScore: integer("overall_score").default(0),
  websiteScore: integer("website_score").default(0),
  seoScore: integer("seo_score").default(0),
  performanceScore: integer("performance_score").default(0),
  designScore: integer("design_score").default(0),
  brandScore: integer("brand_score").default(0),
  marketingScore: integer("marketing_score").default(0),
  conversionScore: integer("conversion_score").default(0),
  localPresenceScore: integer("local_presence_score").default(0),
  growthPotential: integer("growth_potential").default(0),
  salesProbability: integer("sales_probability").default(0),
  priority: text("priority").default("low"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  revenue: integer("revenue"),
  assignedTo: text("assigned_to"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_lead_status").on(table.status),
  index("idx_lead_stage").on(table.stage),
  index("idx_lead_priority").on(table.priority),
]);

// ── Website Analyses ──
export const websiteAnalyses = sqliteTable("website_analyses", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  modernAppearance: integer("modern_appearance").default(0),
  visualQuality: integer("visual_quality").default(0),
  branding: integer("branding").default(0),
  typography: integer("typography").default(0),
  colors: integer("colors").default(0),
  navigation: integer("navigation").default(0),
  userExperience: integer("user_experience").default(0),
  accessibility: integer("accessibility").default(0),
  coreWebVitals: integer("core_web_vitals").default(0),
  mobileResponsiveness: integer("mobile_responsiveness").default(0),
  seoScore: integer("seo_score").default(0),
  ssl: integer("ssl", { mode: "boolean" }).default(false),
  pageSpeed: integer("page_speed").default(0),
  brokenLinks: integer("broken_links").default(0),
  images: integer("images").default(0),
  callToActionQuality: integer("call_to_action_quality").default(0),
  leadGenerationPotential: integer("lead_generation_potential").default(0),
  conversionOptimisation: integer("conversion_optimisation").default(0),
  overallProfessionalism: integer("overall_professionalism").default(0),
  contentQuality: integer("content_quality").default(0),
  trustSignals: integer("trust_signals").default(0),
  technicalStack: text("technical_stack", { mode: "json" }).$type<string[]>(),
  cmsDetection: text("cms_detection"),
  hosting: text("hosting"),
  analyticsDetection: text("analytics_detection", { mode: "json" }).$type<string[]>(),
  schema: integer("schema", { mode: "boolean" }).default(false),
  indexing: integer("indexing").default(0),
  performance: integer("performance").default(0),
  estimatedWebsiteAge: integer("estimated_website_age"),
  estimatedLastRedesign: integer("estimated_last_redesign"),
  outdatedTechnologies: text("outdated_technologies", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_analysis_business").on(table.businessId),
]);

// ── Scout Jobs ──
export const scoutJobs = sqliteTable("scout_jobs", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").default(0),
  leadsFound: integer("leads_found").default(0),
  totalSources: integer("total_sources").default(8),
  sourcesScanned: integer("sources_scanned").default(0),
  currentSource: text("current_source"),
  location: text("location"),
  industry: text("industry"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_scout_status").on(table.status),
]);

// ── Email Drafts ──
export const emailDrafts = sqliteTable("email_drafts", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull().default("cold_email"),
  subject: text("subject"),
  body: text("body"),
  analysis: text("analysis"),
  recommendations: text("recommendations"),
  score: integer("score"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  sent: integer("sent", { mode: "boolean" }).default(false),
  sentAt: integer("sent_at", { mode: "timestamp" }),
}, (table) => [
  index("idx_draft_lead").on(table.leadId),
]);

// ── Notes ──
export const notes = sqliteTable("notes", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by").default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_note_lead").on(table.leadId),
]);

// ── User Settings ──
export const userSettings = sqliteTable("user_settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  notifications: integer("notifications", { mode: "boolean" }).default(true),
  dailyDigest: integer("daily_digest", { mode: "boolean" }).default(true),
  weeklyReport: integer("weekly_report", { mode: "boolean" }).default(true),
  kimiApiKey: text("kimi_api_key"),
  kimiEndpoint: text("kimi_endpoint").default("https://api.moonshot.cn/v1"),
  kimiModel: text("kimi_model").default("kimi-latest"),
  kimiEnabled: integer("kimi_enabled", { mode: "boolean" }).default(false),
  googlePlacesApiKey: text("google_places_api_key"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── OAuth Users ──
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  unionId: text("unionId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  avatar: text("avatar"),
  role: text("role").default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignInAt: integer("lastSignInAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── Local Users (email/password auth) ──
export const localUsers = sqliteTable("local_users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").default("user").notNull(),
  emailConfirmed: integer("email_confirmed", { mode: "boolean" }).default(false),
  confirmationToken: text("confirmation_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: integer("reset_token_expiry", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignInAt: integer("last_sign_in_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;
