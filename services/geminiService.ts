import { GoogleGenAI } from '@google/genai';

export const analyzeSiteContext = async (pageText: string, mediaCount: number, mediaType: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Cannot perform AI analysis.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using Flash for low latency
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Analyze the following text content extracted from a webpage.
        The user has just scraped ${mediaCount} ${mediaType} files from this site.
        
        Provide a very brief (max 2 sentences) summary of what these media files likely represent based on the text context.
        Are they product images, portfolio photos, memes, technical diagrams, or random assets?
        
        Text Content Sample:
        ${pageText.slice(0, 2000)}
      `,
    });

    return response.text || "Could not analyze content.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "AI analysis currently unavailable.";
  }
};
