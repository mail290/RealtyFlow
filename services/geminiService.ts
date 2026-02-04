
import { GoogleGenAI, Type } from "@google/genai";
import { LeadStatus, Lead, Property, MarketTheme, Brand, AdvisorProfile, EmailMessage, BrandVisualStyles, AppLanguage } from "../types";
import { settingsStore } from "./settingsService";

export class GeminiService {
  private getContext(brand?: Brand, profile?: AdvisorProfile) {
    const lang = settingsStore.getLanguage();
    const today = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const languageNames: Record<AppLanguage, string> = {
      [AppLanguage.NO]: "Norwegian",
      [AppLanguage.EN]: "English",
      [AppLanguage.ES]: "Spanish",
      [AppLanguage.DE]: "German",
      [AppLanguage.RU]: "Russian",
      [AppLanguage.FR]: "French"
    };

    let brandingContext = "";
    if (brand) {
      brandingContext = `
        YOU REPRESENT: ${brand.name}. 
        COMPANY TYPE: ${brand.type}.
        TONE: ${brand.tone}.
        DESCRIPTION: ${brand.description}.
        REGIONS: Specialist on Costa Blanca and Costa Calida.
      `;
    }

    let profileContext = "";
    if (profile) {
      profileContext = `
        ADVISOR: ${profile.name}.
        EXPERTISE: ${profile.expertise.join(', ')}.
        SIGNATURE: ${profile.signature}.
      `;
    }

    return `
      DATE: ${today}.
      ROLE: Senior Real Estate Advisor, Founder, Investor and Economist specialized in the Spanish property market for Zen Eco Homes.
      ${brandingContext}
      ${profileContext}
      
      CRITICAL SAFETY INSTRUCTIONS:
      - NEVER title yourself as "Legal Advisor".
      - Never promise legal security or give definitive legal advice.
      - Refer customers to external experts (lawyers/gestors) for legal/tax questions.
      - Focus on value creation, market trends, investment opportunities, and lifestyle.

      LANGUAGE REQUIREMENT:
      - YOU MUST RESPOND EXCLUSIVELY IN: ${languageNames[lang]}.
      - All text, headers, checklists, and calls to action must be in ${languageNames[lang]}.
    `;
  }

  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private cleanJson(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  async getMarketPulse(location: string, theme: MarketTheme = MarketTheme.GENERAL, brand?: Brand, profile?: AdvisorProfile) {
    const ai = this.getClient();
    const prompt = `Create a comprehensive market analysis for ${location}. Theme: ${theme.toUpperCase()}. Include specific info about Costa Blanca and Costa Calida. Analyze from an investor and advisor perspective.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction: this.getContext(brand, profile),
        tools: [{ googleSearch: {} }] 
      },
    });

    return { 
      text: response.text || '', 
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'Source',
        url: c.web?.uri || '#'
      })) || []
    };
  }

  async generateViralAd(brandId: string, objective: string, platform: string) {
    const ai = this.getClient();
    const brand = settingsStore.getBrand(brandId);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create viral ad for ${brand?.name}. Platform: ${platform}. Objective: ${objective}. Focus on new builds in Costa Blanca/Costa Calida. Return JSON with headlines, body text, and strategic hooks. Headlines must promise safety and solutions.`,
        config: {
          systemInstruction: this.getContext(brand),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headlines: { type: Type.ARRAY, items: { type: Type.STRING } },
              bodyOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              viralityScore: { type: Type.NUMBER },
              hooks: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["headlines", "bodyOptions", "viralityScore", "hooks"]
          }
        }
      });
      
      const cleaned = this.cleanJson(response.text || '{}');
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Ad Generation Error:", err);
      throw new Error("Could not generate ad.");
    }
  }

  // Fix: Added extractLeadsFromContent to handle lead data extraction from text notes
  async extractLeadsFromContent(content: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract real estate lead information from the following inquiry notes. Look for name, email, phone, budget (in EUR), location, and specific property requirements. \n\nINQUIRY NOTES:\n${content}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              value: { type: Type.NUMBER, description: "Budget value in EUR" },
              location: { type: Type.STRING },
              summary: { type: Type.STRING },
              personalityType: { type: Type.STRING },
            },
            required: ["name"]
          }
        }
      }
    });
    try {
      const cleaned = this.cleanJson(response.text || '[]');
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Content Lead Extraction Error:", err);
      return [];
    }
  }

  // Fix: Added extractLeadsFromImage to handle lead data extraction from form/business card images
  async extractLeadsFromImage(base64: string, mimeType: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: "Analyze this image of a real estate lead registration form or business card. Extract all contact details and property interests into a structured JSON array of leads." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              value: { type: Type.NUMBER, description: "Budget value in EUR if found" },
              location: { type: Type.STRING },
              summary: { type: Type.STRING },
              personalityType: { type: Type.STRING },
            },
            required: ["name"]
          }
        }
      }
    });
    try {
      const cleaned = this.cleanJson(response.text || '[]');
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Image Lead Extraction Error:", err);
      return [];
    }
  }

  async generateZenEcoGuide(brandId: string) {
    const ai = this.getClient();
    const brand = settingsStore.getBrand(brandId);
    const prompt = `Generate a high-end buyer guide for Spanish real estate. Sell safety, quality, and lifestyle. 
    Include:
    1. 5 catchy titles (promising solutions to uncertainty).
    2. Table of Contents (Dream to Handover, 5-7 chapters).
    3. Content for each chapter with subheaders, "Pro-tips" boxes (traps to avoid), and a "Viewing Checklist".
    4. "Why New Build/Eco?" section.
    5. Sales text for website with hook, 3 bullet points, and CTA.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: this.getContext(brand),
      }
    });
    return response.text || '';
  }

  async generateMarketingImage(prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" = "16:9", baseImage?: string) {
    const ai = this.getClient();
    const parts: any[] = [];
    
    if (baseImage) {
      parts.push({
        inlineData: {
          data: baseImage.includes(',') ? baseImage.split(',')[1] : baseImage,
          mimeType: 'image/png'
        }
      });
      parts.push({ text: `Modify image: ${prompt}. Maintain luxury Mediterranean style.` });
    } else {
      const enhancedPrompt = `High-end architectural photography, luxury new build real estate Spain, Mediterranean style. Subject: ${prompt}`;
      parts.push({ text: enhancedPrompt });
    }
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio } }
      });
      
      const responseParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No image returned.");
    } catch (err: any) {
      throw new Error(err.message || "Generation failed.");
    }
  }

  async analyzeEmailThread(emails: EmailMessage[], lead: Lead) {
    const ai = this.getClient();
    const thread = emails.map(e => `${e.isIncoming ? 'FROM CLIENT' : 'TO CLIENT'} (${e.date}): ${e.body}`).join('\n---\n');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Analyze email thread for "${lead.name}". \n\nTHREAD:\n${thread}`,
        config: {
          systemInstruction: this.getContext(),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              sentimentScore: { type: Type.NUMBER },
              urgencyLevel: { type: Type.STRING },
              suggestedAction: { type: Type.STRING },
              suggestedEmailDraft: { type: Type.STRING }
            },
            required: ["summary", "sentimentScore", "urgencyLevel", "suggestedAction", "suggestedEmailDraft"]
          }
        }
      });
      const cleaned = this.cleanJson(response.text || '{}');
      return JSON.parse(cleaned);
    } catch (err) {
      return null;
    }
  }

  async generateROIReport(data: { location: string; price: number; rent: number; expenses: number; yield: string }, brand?: Brand, profile?: AdvisorProfile) {
    const ai = this.getClient();
    const prompt = `Investment analysis for ${data.location}. Data: Price €${data.price}, Yield ${data.yield}%.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { systemInstruction: this.getContext(brand, profile) },
    });
    return response.text || '';
  }

  async generateCMSContent(contentType: string, topic: string, brandId: string) {
    const ai = this.getClient();
    const brand = settingsStore.getBrand(brandId);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate ${contentType} about: ${topic}.`,
      config: { systemInstruction: this.getContext(brand) },
    });
    return response.text || '';
  }
}

export const gemini = new GeminiService();
