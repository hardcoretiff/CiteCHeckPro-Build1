import { CourtListenerLookupResult } from '../types';
import { inferAreaOfLaw } from './geminiService';

/**
 * Performs a targeted lookup of a legal citation on the CourtListener API.
 */
export const lookupCitationOnCourtListener = async (
  citation: string,
  apiKey: string
): Promise<CourtListenerLookupResult> => {
  const inferredArea = inferAreaOfLaw(citation);
  
  if (!apiKey || apiKey.trim() === '') {
    return {
      found: false,
      caseName: null,
      citation: null,
      id: null,
      absolute_url: null,
      areaOfLaw: inferredArea,
      error: 'Authority Key missing. Please set your CourtListener Token in Engine Config.'
    };
  }

  const endpoint = 'https://www.courtlistener.com/api/rest/v3/citation-lookup/';
  const cleanKey = apiKey.startsWith('Token ') ? apiKey : `Token ${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': cleanKey
      },
      body: JSON.stringify({ q: citation })
    });

    if (response.status === 401 || response.status === 403) {
      return {
        found: false,
        caseName: null,
        citation: null,
        id: null,
        absolute_url: null,
        areaOfLaw: inferredArea,
        error: 'Authentication failed: The provided CourtListener token is invalid.'
      };
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.count > 0 && data.results && data.results.length > 0) {
      const topResult = data.results[0];
      return {
        found: true,
        caseName: topResult.case_name || topResult.citation_string,
        citation: topResult.citation_string,
        id: topResult.id,
        absolute_url: topResult.absolute_url ? `https://www.courtlistener.com${topResult.absolute_url}` : null,
        areaOfLaw: inferredArea // We always attach inferred area since CL API doesn't usually provide it directly in this endpoint
      };
    }

    return { 
      found: false, 
      caseName: null, 
      citation: null, 
      id: null, 
      absolute_url: null,
      areaOfLaw: inferredArea 
    };

  } catch (error: any) {
    console.error('CourtListener Lookup Failure:', error);
    return {
      found: false,
      caseName: null,
      citation: null,
      id: null,
      absolute_url: null,
      areaOfLaw: inferredArea,
      error: 'Network error communicating with the legal database.'
    };
  }
};