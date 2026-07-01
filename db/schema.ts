import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  json,
  boolean,
  real,
  index,
} from "drizzle-orm/pg-core";

// ── Businesses (raw data from external sources like Google Places) ──
export const businesses = pgTable("businesses", {
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
  googleRating: real("google_rating"),
  reviewCount: integer("review_count"),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  description: text("description"),
  hasWebsite: boolean("has_website").notNull().default(false),
  source: varchar("source", { length: 100 }).default("google_places"), // google_places, yell, manual
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_business_city").on(table.city),
  index("idx_business_industry").on(table.industry),
  index("idx_business_external").on(table.externalId),
]);

// ── Leads (enriched businesses with AI scoring & pipeline status) ──
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("new"), // new, contacted, qualified, proposal_sent, negotiation, won, lost, archived
  stage: varchar("stage", { length: 50 }).notNull().default("research"), // research, contacted, negotiation, won, lost
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
  priority: varchar("priority", { length: 20 }).default("low"), // low, medium, high, urgent
  tags: json("tags").$type<string[]>(),
  revenue: integer("revenue"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index("idx_lead_status").on(table.status),
  index("idx_lead_stage").on(table.stage),
  index("idx_lead_priority").on(table.priority),
]);

// ── Website Analyses ──
export const websiteAnalyses = pgTable("website_analyses", {
  id: serial("id").primaryKey(),
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
  ssl: boolean("ssl").default(false),
  pageSpeed: integer("page_speed").default(0),
  brokenLinks: integer("broken_links").default(0),
  images: integer("images").default(0),
  callToActionQuality: integer("call_to_action_quality").default(0),
  leadGenerationPotential: integer("lead_generation_potential").default(0),
  conversionOptimisation: integer("conversion_optimisation").default(0),
  overallProfessionalism: integer("overall_professionalism").default(0),
  contentQuality: integer("content_quality").default(0),
  trustSignals: integer("trust_signals").default(0),
  technicalStack: json("technical_stack").$type<string[]>(),
  cmsDetection: varchar("cms_detection", { length: 100 }),
  hosting: varchar("hosting", { length: 100 }),
  analyticsDetection: json("analytics_detection").$type<string[]>(),
  schema: boolean("schema").default(false),
  indexing: integer("indexing").default(0),
  performance: integer("performance").default(0),
  estimatedWebsiteAge: integer("estimated_website_age"),
  estimatedLastRedesign: integer("estimated_last_redesign"),
  outdatedTechnologies: json("outdated_technologies").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_analysis_business").on(table.businessId),
]);

// ── Scout Jobs (background search tasks) ──
export const scoutJobs = pgTable("scout_jobs", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, running, paused, completed, failed
  progress: integer("progress").default(0),
  leadsFound: integer("leads_found").default(0),
  totalSources: integer("total_sources").default(8),
  sourcesScanned: integer("sources_scanned").default(0),
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
export const emailDrafts = pgTable("email_drafts", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("cold_email"), // cold_email, linkedin, facebook, followup1, followup2, followup3, proposal
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  analysis: text("analysis"),
  recommendations: text("recommendations"),
  score: integer("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
}, (table) => [
  index("idx_draft_lead").on(table.leadId),
]);

// ── Notes ──
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by", { length: 255 }).default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_note_lead").on(table.leadId),
]);

// ── User Settings ──
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  notifications: boolean("notifications").default(1),
  dailyDigest: boolean("daily_digest").default(1),
  weeklyReport: boolean("weekly_report").default(1),
  kimiApiKey: varchar("kimi_api_key", { length: 500 }),
  kimiEndpoint: varchar("kimi_endpoint", { length: 500 }).default("https://api.moonshot.cn/v1"),
  kimiModel: varchar("kimi_model", { length: 100 }).default("kimi-latest"),
  kimiEnabled: boolean("kimi_enabled").default(false),
  googlePlacesApiKey: varchar("google_places_api_key", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

// ── Local Users (email/password auth) ──
export const localUsers = pgTable("local_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  emailConfirmed: boolean("email_confirmed").default(false),
  confirmationToken: varchar("confirmation_token", { length: 255 }),
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignInAt: timestamp("last_sign_in_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;
