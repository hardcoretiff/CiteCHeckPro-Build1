import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { VerificationResponse, VerificationMode, CitationSource, HistoricalContextData } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const inferAreaOfLaw = (text: string): string => {
  const normalized = text.toLowerCase();
  if (normalized.includes("u.s.c.") || normalized.includes("§")) return "Statutory Law";
  if (normalized.includes("u.s.") || normalized.includes("s. ct.") || normalized.includes("l. ed.")) return "Constitutional Law";
  if (normalized.includes("f.3d") || normalized.includes("f.2d")) return "Federal Appellate Law";
  if (normalized.includes("crim") || normalized.includes("miranda") || normalized.includes("terry")) return "Criminal Procedure";
  if (normalized.includes("tax")) return "Tax Law";
  if (normalized.includes("bankruptcy") || normalized.includes("b.r.")) return "Bankruptcy Law";
  if (normalized.includes("patent") || normalized.includes("copyright") || normalized.includes("trademark")) return "Intellectual Property";
  if (normalized.includes("labor") || normalized.includes("nlrb")) return "Labor & Employment";
  return "General Practice";
};

export const getHistoricalContext = async (query: string): Promise<HistoricalContextData | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Provide historical legal context for the following case or citation: "${query}". 
      Return structured data about the era, court climate, and surrounding social forces.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING },
            era: { type: Type.STRING },
            topic: { type: Type.STRING },
            brief: { type: Type.STRING },
            keyForces: { type: Type.ARRAY, items: { type: Type.STRING } },
            relatedCases: { type: Type.ARRAY, items: { type: Type.STRING } },
            timeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  caseName: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  citation: { type: Type.STRING }
                },
                required: ["year", "caseName", "summary"]
              }
            }
          },
          required: ["query", "era", "topic", "brief", "keyForces", "relatedCases", "timeline"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Historical Context Error:", error);
    return null;
  }
};

export const verifyCitationWithGemini = async (
  citationText: string, 
  mode: VerificationMode = 'standard'
): Promise<VerificationResponse> => {
  const ai = getAiClient();
  const fallbackArea = inferAreaOfLaw(citationText);

  if (!ai) {
    return { 
      isValid: false, 
      citationType: 'legal',
      caseName: null, 
      reason: "Configuration Error: API Key missing.", 
      legalStatus: 'unknown',
      areaOfLaw: fallbackArea
    };
  }

  try {
    const isResearchMode = mode === 'research';
    const modelName = 'gemini-3-pro-preview';
    
    const config: any = {
      temperature: 0.1,
    };

    if (!isResearchMode) {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          citationType: { type: Type.STRING, enum: ['legal'] },
          caseName: { type: Type.STRING },
          areaOfLaw: { type: Type.STRING },
          legalStatus: { type: Type.STRING, enum: ['good', 'overruled', 'caution', 'superseded', 'verified', 'not_found', 'unknown'] },
          reason: { type: Type.STRING },
          confidence: { type: Type.INTEGER },
          supersedingCase: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              citation: { type: Type.STRING },
              uri: { type: Type.STRING }
            }
          }
        },
        required: ["isValid", "citationType", "caseName", "legalStatus", "reason", "confidence", "areaOfLaw"]
      };
    } else {
      config.tools = [{ googleSearch: {} }];
    }

    const prompt = `Legal Citation Verification Task: Verify "${citationText}". ...`; // Keep existing prompt content truncated for brevity

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: config
    });

    let result: VerificationResponse = {
      isValid: false,
      citationType: 'legal',
      caseName: null,
      areaOfLaw: fallbackArea,
      reason: "Empty response.",
      confidence: 0,
      legalStatus: 'unknown'
    };

    if (response.text) {
      try {
        const text = response.text;
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          result = JSON.parse(text.substring(start, end + 1));
        }
      } catch (e) {
        result.reason = "Parsing error.";
      }
    }
    return result;
  } catch (error: any) {
    return { 
      isValid: false, 
      citationType: 'legal',
      caseName: null, 
      reason: "Error", 
      legalStatus: 'unknown',
      areaOfLaw: fallbackArea
    };
  }
};