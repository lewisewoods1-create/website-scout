import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
  json,
  tinyint,
  float,
  index,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

// ── Businesses (raw data from external sources like Google Places) ──
export const businesses = mysqlTable("businesses", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 255 }), // Google Place ID
  name: varchar("name", { length: 255 }).notNull(),
  owner: varchar("owner", { length: 255 }),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  socialLinks: json("social_links").$type<Record<string, string>>(),
  industry: varchar("industry", { length: 100 }),
  openingHours: text("opening_hours"),
  googleRating: float("google_rating"),
  reviewCount: int("review_count"),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }),
  latitude: float("latitude"),
  longitude: float("longitude"),
  description: text("description"),
  hasWebsite: tinyint("has_website").notNull().default(0),
  source: varchar("source", { length: 100 }).default("google_places"), // google_places, yell, manual
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_business_city").on(table.city),
  index("idx_business_industry").on(table.industry),
  index("idx_business_external").on(table.externalId),
]);

// ── Leads (enriched businesses with AI scoring & pipeline status) ──
export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  businessId: int("business_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("new"), // new, contacted, qualified, proposal_sent, negotiation, won, lost, archived
  stage: varchar("stage", { length: 50 }).notNull().default("research"), // research, contacted, negotiation, won, lost
  overallScore: int("overall_score").default(0),
  websiteScore: int("website_score").default(0),
  seoScore: int("seo_score").default(0),
  performanceScore: int("performance_score").default(0),
  designScore: int("design_score").default(0),
  brandScore: int("brand_score").default(0),
  marketingScore: int("marketing_score").default(0),
  conversionScore: int("conversion_score").default(0),
  localPresenceScore: int("local_presence_score").default(0),
  growthPotential: int("growth_potential").default(0),
  salesProbability: int("sales_probability").default(0),
  priority: varchar("priority", { length: 20 }).default("low"), // low, medium, high, urgent
  tags: json("tags").$type<string[]>(),
  revenue: int("revenue"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_lead_status").on(table.status),
  index("idx_lead_stage").on(table.stage),
  index("idx_lead_priority").on(table.priority),
]);

// ── Website Analyses ──
export const websiteAnalyses = mysqlTable("website_analyses", {
  id: serial("id").primaryKey(),
  businessId: int("business_id").notNull(),
  modernAppearance: int("modern_appearance").default(0),
  visualQuality: int("visual_quality").default(0),
  branding: int("branding").default(0),
  typography: int("typography").default(0),
  colors: int("colors").default(0),
  navigation: int("navigation").default(0),
  userExperience: int("user_experience").default(0),
  accessibility: int("accessibility").default(0),
  coreWebVitals: int("core_web_vitals").default(0),
  mobileResponsiveness: int("mobile_responsiveness").default(0),
  seoScore: int("seo_score").default(0),
  ssl: tinyint("ssl").default(0),
  pageSpeed: int("page_speed").default(0),
  brokenLinks: int("broken_links").default(0),
  images: int("images").default(0),
  callToActionQuality: int("call_to_action_quality").default(0),
  leadGenerationPotential: int("lead_generation_potential").default(0),
  conversionOptimisation: int("conversion_optimisation").default(0),
  overallProfessionalism: int("overall_professionalism").default(0),
  contentQuality: int("content_quality").default(0),
  trustSignals: int("trust_signals").default(0),
  technicalStack: json("technical_stack").$type<string[]>(),
  cmsDetection: varchar("cms_detection", { length: 100 }),
  hosting: varchar("hosting", { length: 100 }),
  analyticsDetection: json("analytics_detection").$type<string[]>(),
  schema: tinyint("schema").default(0),
  indexing: int("indexing").default(0),
  performance: int("performance").default(0),
  estimatedWebsiteAge: int("estimated_website_age"),
  estimatedLastRedesign: int("estimated_last_redesign"),
  outdatedTechnologies: json("outdated_technologies").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_analysis_business").on(table.businessId),
]);

// ── Scout Jobs (background search tasks) ──
export const scoutJobs = mysqlTable("scout_jobs", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, running, paused, completed, failed
  progress: int("progress").default(0),
  leadsFound: int("leads_found").default(0),
  totalSources: int("total_sources").default(8),
  sourcesScanned: int("sources_scanned").default(0),
  currentSource: varchar("current_source", { length: 255 }),
  location: varchar("location", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_scout_status").on(table.status),
]);

// ── Email Drafts ──
export const emailDrafts = mysqlTable("email_drafts", {
  id: serial("id").primaryKey(),
  leadId: int("lead_id").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("cold_email"), // cold_email, linkedin, facebook, followup1, followup2, followup3, proposal
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  analysis: text("analysis"),
  recommendations: text("recommendations"),
  score: int("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sent: tinyint("sent").default(0),
  sentAt: timestamp("sent_at"),
}, (table) => [
  index("idx_draft_lead").on(table.leadId),
]);

// ── Notes ──
export const notes = mysqlTable("notes", {
  id: serial("id").primaryKey(),
  leadId: int("lead_id").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by", { length: 255 }).default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_note_lead").on(table.leadId),
]);

// ── User Settings ──
export const userSettings = mysqlTable("user_settings", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  notifications: tinyint("notifications").default(1),
  dailyDigest: tinyint("daily_digest").default(1),
  weeklyReport: tinyint("weekly_report").default(1),
  kimiApiKey: varchar("kimi_api_key", { length: 500 }),
  kimiEndpoint: varchar("kimi_endpoint", { length: 500 }).default("https://api.moonshot.cn/v1"),
  kimiModel: varchar("kimi_model", { length: 100 }).default("kimi-latest"),
  kimiEnabled: tinyint("kimi_enabled").default(0),
  googlePlacesApiKey: varchar("google_places_api_key", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
