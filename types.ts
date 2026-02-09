export interface CitationSource {
  uri: string;
  title: string;
}

export type LegalStatus = 'good' | 'overruled' | 'caution' | 'superseded' | 'unknown' | 'verified' | 'retracted' | 'not_found';

export interface Citation {
  id: string;
  originalText: string;
  startIndex: number;
  endIndex: number;
  status: 'pending' | 'checking' | 'valid' | 'hallucination' | 'error';
  citationType?: 'legal' | 'unknown';
  legalStatus?: LegalStatus;
  areaOfLaw?: string; 
  supersedingCase?: {
    name: string;
    citation: string;
    uri?: string;
  };
  caseName?: string; 
  confidence?: number;
  reason?: string;
  sources?: CitationSource[];
  courtListenerId?: number;
  isCourtListenerVerified?: boolean;
}

export interface VerificationResponse {
  isValid: boolean;
  citationType: 'legal';
  caseName: string | null;
  areaOfLaw?: string;
  reason: string;
  confidence?: number;
  legalStatus?: LegalStatus;
  supersedingCase?: {
    name: string;
    citation: string;
    uri?: string;
  };
  sources?: CitationSource[];
  courtListenerId?: number;
}

export interface CourtListenerLookupResult {
  found: boolean;
  caseName: string | null;
  citation: string | null;
  id: number | null;
  absolute_url: string | null;
  areaOfLaw?: string;
  error?: string;
}

export interface HistoricalEvent {
  year: string;
  caseName: string;
  summary: string;
  citation?: string;
}

export interface HistoricalContextData {
  query: string;
  era: string;
  topic: string;
  brief: string;
  keyForces: string[];
  relatedCases: string[];
  timeline: HistoricalEvent[];
}

export interface AnalysisStats {
  total: number;
  valid: number;
  invalid: number;
  pending: number;
}

export interface ReportJournalEntry {
  id: string;
  timestamp: number;
  documentTitle: string;
  stats: AnalysisStats;
  findings: Array<{
    text: string;
    status: string;
    citationType?: string;
    caseName?: string;
    legalStatus?: string;
    areaOfLaw?: string;
  }>;
  status: string;
  thumbnail?: string;
}

export type CitationFilter = 'all' | 'issues' | 'valid' | 'superseded';
export type SortOption = 'original' | 'name' | 'status' | 'confidence';
export type VerificationMode = 'standard' | 'research';

export type ViewState = 'library' | 'editor' | 'recent' | 'starred' | 'settings' | 'historical' | 'precedent' | 'bluebook' | 'casefinder';