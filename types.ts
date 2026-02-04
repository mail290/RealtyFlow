
export enum AppLanguage {
  NO = 'no',
  EN = 'en',
  ES = 'es',
  DE = 'de',
  RU = 'ru',
  FR = 'fr'
}

export enum LeadStatus {
  NEW = 'NEW',
  QUALIFIED = 'QUALIFIED',
  VIEWING = 'VIEWING',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST'
}

export enum MarketTheme {
  PRICING = 'pricing',
  INFRASTRUCTURE = 'infrastructure',
  LEGAL = 'legal',
  GENERAL = 'general'
}

export interface MarketAnalysis {
  id: string;
  date: string;
  location: string;
  theme: MarketTheme;
  title: string;
  text: string;
  sources: { title: string; url: string }[];
}

export interface MarketSchedule {
  enabled: boolean;
  frequency: 'weekly' | 'monthly';
  dayOfWeek: number; // 1 = Monday
  nextTheme: MarketTheme;
  lastRun?: string;
}

export interface NurtureStep {
  id: string;
  day: number;
  type: 'Email' | 'WhatsApp' | 'Call';
  subject: string;
  status: 'Pending' | 'Sent' | 'Completed';
  content?: string;
}

export interface ViewingItem {
  id: string;
  propertyTitle: string;
  propertyLocation: string;
  time: string;
  contactPerson: string;
  contactPhone: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Delayed';
  notes?: string;
  mapsUrl?: string;
}

export interface CallLog {
  id: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
}

export interface EmailMessage {
  id: string;
  date: string;
  from: string;
  subject: string;
  body: string;
  isIncoming: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  value: number;
  sentiment: number;
  urgency: number;
  intent: number;
  lastActivity: string;
  summary?: string;
  personalityType?: string;
  imageUrl?: string; 
  brandId?: string;
  viewingPlan?: ViewingItem[];
  callLogs?: CallLog[];
  nurtureSequence?: NurtureStep[];
  emails?: EmailMessage[];
  requirements?: {
    budget?: number;
    location?: string;
    style?: string;
    bedrooms?: number;
    bathrooms?: number;
    minArea?: number;
    maxPrice?: number;
    propertyType?: string;
  };
}

export interface Property {
  id: string;
  external_id?: string;
  title: string;
  price: number;
  location: string;
  region?: string;
  property_type?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  plot_size?: number;
  terrace_size?: number;
  imageUrl: string;
  gallery?: string[];
  status: 'Available' | 'Sold' | 'Under Offer';
  description?: string;
  developer?: string;
  commission?: number;
  dropbox_url?: string;
  website_url?: string;
  agent_notes?: string;
}

export interface BrandVisualStyles {
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
}

export interface IntegrationSettings {
  facebookActive: boolean;
  instagramActive: boolean;
  linkedinActive: boolean;
  tiktokActive: boolean;
  youtubeActive: boolean;
  pinterestActive: boolean;
  emailSyncActive: boolean;
  metaApiKey?: string;
  linkedinApiKey?: string;
  tiktokApiKey?: string;
  youtubeApiKey?: string;
  pinterestApiKey?: string;
  emailAppPassword?: string;
}

export interface Brand {
  id: string;
  name: string;
  type: string;
  description: string;
  tone: string;
  logo?: string;
  email: string;
  phone: string;
  phone2?: string;
  website: string;
  visualStyles?: BrandVisualStyles;
  integrations?: IntegrationSettings;
}

export interface AutomationSettings {
  marketPulseEnabled: boolean;
  brandIdentityGuardEnabled: boolean;
  socialSyncEnabled: boolean;
  leadNurtureEnabled: boolean;
  language?: AppLanguage;
}

export interface AdvisorProfile {
  name: string;
  imageUrl?: string;
  phone?: string;
  phone2?: string;
  location: string;
  secondaryLocation?: string;
  signature?: string;
  expertise: string[];
}
