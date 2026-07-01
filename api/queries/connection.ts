import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const sqlite = new Database("./scout.db");
    sqlite.pragma("journal_mode = WAL");
    instance = drizzle(sqlite, { schema: fullSchema });
  }
  return instance;
}

// Auto-create tables on startup using raw SQL
export function initDb() {
  const db = getDb();
  const sqlite = (db as any).$client as Database.Database;

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT,
      name TEXT NOT NULL,
      owner TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      social_links TEXT,
      industry TEXT,
      opening_hours TEXT,
      google_rating REAL,
      review_count INTEGER,
      city TEXT,
      region TEXT,
      postcode TEXT,
      latitude REAL,
      longitude REAL,
      description TEXT,
      has_website INTEGER NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'google_places',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_business_city ON businesses(city);
    CREATE INDEX IF NOT EXISTS idx_business_industry ON businesses(industry);
    CREATE INDEX IF NOT EXISTS idx_business_external ON businesses(external_id);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      stage TEXT NOT NULL DEFAULT 'research',
      overall_score INTEGER DEFAULT 0,
      website_score INTEGER DEFAULT 0,
      seo_score INTEGER DEFAULT 0,
      performance_score INTEGER DEFAULT 0,
      design_score INTEGER DEFAULT 0,
      brand_score INTEGER DEFAULT 0,
      marketing_score INTEGER DEFAULT 0,
      conversion_score INTEGER DEFAULT 0,
      local_presence_score INTEGER DEFAULT 0,
      growth_potential INTEGER DEFAULT 0,
      sales_probability INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'low',
      tags TEXT,
      revenue INTEGER,
      assigned_to TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_lead_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_lead_priority ON leads(priority);

    CREATE TABLE IF NOT EXISTS website_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      modern_appearance INTEGER DEFAULT 0,
      visual_quality INTEGER DEFAULT 0,
      branding INTEGER DEFAULT 0,
      typography INTEGER DEFAULT 0,
      colors INTEGER DEFAULT 0,
      navigation INTEGER DEFAULT 0,
      user_experience INTEGER DEFAULT 0,
      accessibility INTEGER DEFAULT 0,
      core_web_vitals INTEGER DEFAULT 0,
      mobile_responsiveness INTEGER DEFAULT 0,
      seo_score INTEGER DEFAULT 0,
      ssl INTEGER DEFAULT 0,
      page_speed INTEGER DEFAULT 0,
      broken_links INTEGER DEFAULT 0,
      images INTEGER DEFAULT 0,
      call_to_action_quality INTEGER DEFAULT 0,
      lead_generation_potential INTEGER DEFAULT 0,
      conversion_optimisation INTEGER DEFAULT 0,
      overall_professionalism INTEGER DEFAULT 0,
      content_quality INTEGER DEFAULT 0,
      trust_signals INTEGER DEFAULT 0,
      technical_stack TEXT,
      cms_detection TEXT,
      hosting TEXT,
      analytics_detection TEXT,
      schema INTEGER DEFAULT 0,
      indexing INTEGER DEFAULT 0,
      performance INTEGER DEFAULT 0,
      estimated_website_age INTEGER,
      estimated_last_redesign INTEGER,
      outdated_technologies TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_business ON website_analyses(business_id);

    CREATE TABLE IF NOT EXISTS scout_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      leads_found INTEGER DEFAULT 0,
      total_sources INTEGER DEFAULT 8,
      sources_scanned INTEGER DEFAULT 0,
      current_source TEXT,
      location TEXT,
      industry TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_scout_status ON scout_jobs(status);

    CREATE TABLE IF NOT EXISTS email_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'cold_email',
      subject TEXT,
      body TEXT,
      analysis TEXT,
      recommendations TEXT,
      score INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      sent INTEGER DEFAULT 0,
      sent_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_draft_lead ON email_drafts(lead_id);

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_note_lead ON notes(lead_id);

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      company TEXT,
      notifications INTEGER DEFAULT 1,
      daily_digest INTEGER DEFAULT 1,
      weekly_report INTEGER DEFAULT 1,
      kimi_api_key TEXT,
      kimi_endpoint TEXT DEFAULT 'https://api.moonshot.cn/v1',
      kimi_model TEXT DEFAULT 'kimi-latest',
      kimi_enabled INTEGER DEFAULT 0,
      google_places_api_key TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unionId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user' NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      lastSignInAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS local_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user' NOT NULL,
      email_confirmed INTEGER DEFAULT 0,
      confirmation_token TEXT,
      reset_token TEXT,
      reset_token_expiry INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_sign_in_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);

  console.log("[DB] SQLite tables initialized");
  return db;
}
