export interface Business {
  id: string;
  name: string;
  owner: string;
  address: string;
  phone: string;
  email: string;
  website: string | null;
  socialLinks: SocialLinks;
  industry: string;
  openingHours: string;
  googleRating: number;
  reviewCount: number;
  location: Location;
  coordinates: [number, number];
  description: string;
  hasWebsite: boolean;
  createdAt: string;
}

export interface SocialLinks {
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

export interface Location {
  city: string;
  region: string;
  postcode: string;
}

export interface WebsiteAnalysis {
  modernAppearance: number;
  visualQuality: number;
  branding: number;
  typography: number;
  colors: number;
  navigation: number;
  userExperience: number;
  accessibility: number;
  coreWebVitals: number;
  mobileResponsiveness: number;
  seoScore: number;
  ssl: boolean;
  pageSpeed: number;
  brokenLinks: number;
  images: number;
  callToActionQuality: number;
  leadGenerationPotential: number;
  conversionOptimisation: number;
  overallProfessionalism: number;
  contentQuality: number;
  trustSignals: number;
  technicalStack: string[];
  cmsDetection: string | null;
  hosting: string | null;
  analyticsDetection: string[];
  schema: boolean;
  indexing: number;
  performance: number;
  estimatedWebsiteAge: number;
  estimatedLastRedesign: number;
  outdatedTechnologies: string[];
}

export interface AIScore {
  overall: number;
  website: number;
  seo: number;
  performance: number;
  design: number;
  brand: number;
  marketing: number;
  conversion: number;
  localPresence: number;
  growthPotential: number;
  salesProbability: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface WebsiteProposal {
  suggestedColors: string[];
  suggestedBranding: string;
  homepageLayout: string;
  pagesRequired: string[];
  features: string[];
  animations: string[];
  callsToAction: string[];
  trustSections: string[];
  galleryIdeas: string[];
  testimonials: string[];
  bookingSystems: string[];
  contactMethods: string[];
  leadGeneration: string[];
  seoSuggestions: string[];
  accessibilityImprovements: string[];
  performanceRecommendations: string[];
  modernDesignReferences: string[];
  estimatedBuildTime: string;
  estimatedProjectCost: string;
  monthlyMaintenanceEstimate: string;
  hostingRecommendation: string;
}

export interface OutreachContent {
  coldEmail: string;
  linkedinMessage: string;
  facebookMessage: string;
  phoneScript: string;
  followUp1: string;
  followUp2: string;
  followUp3: string;
  proposal: string;
  quotation: string;
  auditReport: string;
}

export interface Lead {
  id: string;
  business: Business;
  analysis: WebsiteAnalysis | null;
  score: AIScore;
  proposal: WebsiteProposal | null;
  outreach: OutreachContent | null;
  status: LeadStatus;
  stage: PipelineStage;
  notes: Note[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  revenue: number | null;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost' | 'archived';

export type PipelineStage = 'research' | 'contacted' | 'negotiation' | 'won' | 'lost';

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface ScoutJob {
  id: string;
  query: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  leadsFound: number;
  totalSources: number;
  sourcesScanned: number;
  currentSource: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface EmailDraft {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  analysis: string;
  recommendations: string;
  score: number;
  proposal: string;
  outreach: string;
  createdAt: string;
  sent: boolean;
  sentAt: string | null;
}

export interface SearchHistory {
  id: string;
  query: string;
  filters: SearchFilters;
  results: number;
  createdAt: string;
}

export interface SearchFilters {
  industry?: string;
  location?: string;
  hasWebsite?: boolean;
  minRating?: number;
  maxRating?: number;
  minScore?: number;
  maxScore?: number;
}

export interface KimiConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  enabled: boolean;
}

export interface UserSettings {
  email: string;
  name: string;
  company: string;
  notifications: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  theme: 'dark' | 'light';
  kimiConfig: KimiConfig;
}
