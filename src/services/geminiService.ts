import { GoogleGenAI, Type } from "@google/genai";

const CONCEPTS_SYSTEM_INSTRUCTION = `You are an ELITE academic research assistant for 'CogniCard Academic'. 
Task: Extract exactly 7 high-level, technical concepts or professional terms from the provided text.

Constraints:
1. FOCUS: Ignore common words. Only extract terms critical to the author's specific argument or methodology.
2. DEFINITION: Provide a context-strict definition (Max 15 words). Explain ONLY how it is used here.
3. LANGUAGE: Keep the term in its original language (e.g., Chinese if the text is Chinese).
4. FORMAT: Output ONLY valid JSON. No markdown blocks.`;

const OVERVIEW_SYSTEM_INSTRUCTION = `You are an expert academic synthesizer. Synthesize the provided long academic text into a structural overview.

CRITICAL RULES:
1. TRANSLATE TO PLAIN ENGLISH: Do NOT just copy-paste dense academic jargon (e.g., "heterogeneous expectations", "nonlinear steady-state"). You MUST translate the core meaning into highly accessible, smart-but-simple language. Explain it as if to a smart undergraduate student.
2. CORE THESIS: Exactly ONE concise sentence summarizing the main purpose (Max 25 words).
3. METHODOLOGY: Under 15 words describing the approach simply.
4. TAKEAWAYS: Exactly 3 high-impact conclusions. Each takeaway MUST be under 20 words and easy to read.
5. FORMAT: Output strictly in valid JSON format.`;

const DEEP_DIVE_SYSTEM_INSTRUCTION = `You are an expert academic tutor. Provide a lightning-fast deep dive into a specific concept.

Rules:
1. STRICT CONTEXT: Do not use generic definitions. Define it ONLY as it relates to the provided Original Text.
2. STRUCTURE: Follow the 3-part 'Golden Triangle' logic.
3. BREVITY: Max ONE sentence per section.
4. FORMAT: Output ONLY valid JSON.`;

export interface Concept {
  term: string;
  definition: string;
}

export interface AnalysisResponse {
  concepts: Concept[];
}

export interface DocumentOverview {
  core_thesis: string;
  methodology: string;
  key_takeaways: string[];
}

export interface OverviewResponse {
  overview: DocumentOverview;
}

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface DeepDiveBreakdown {
  keyword: string;
  explanation: string;
}

export interface DeepDiveData {
  breakdown: DeepDiveBreakdown[];
  context_quote: string;
  analogy: string;
}

export interface DeepDiveResponse {
  deep_dive: DeepDiveData;
}

let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function analyzeText(text: string, language: 'English' | 'Chinese' = 'English', image?: ImagePart): Promise<AnalysisResponse> {
  const genAI = getAI();
  
  const contentParts: any[] = [];
  if (text.trim()) contentParts.push({ text: text.trim() });
  if (image) contentParts.push(image);

  if (contentParts.length === 0) throw new Error("No input provided");

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: contentParts }],
    config: {
      systemInstruction: `${CONCEPTS_SYSTEM_INSTRUCTION}\n\nCRITICAL: Please output your response entirely in ${language}.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          concepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
              },
              required: ["term", "definition"],
            },
          },
        },
        required: ["concepts"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  try {
    return JSON.parse(response.text) as AnalysisResponse;
  } catch (e) {
    console.error("Failed to parse AI response:", response.text);
    throw new Error("Invalid response format from AI");
  }
}

export async function analyzeOverview(text: string, language: 'English' | 'Chinese' = 'English', image?: ImagePart): Promise<OverviewResponse> {
  const genAI = getAI();
  
  const contentParts: any[] = [];
  if (text.trim()) contentParts.push({ text: text.trim() });
  if (image) contentParts.push(image);

  if (contentParts.length === 0) throw new Error("No input provided");

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: contentParts }],
    config: {
      systemInstruction: `${OVERVIEW_SYSTEM_INSTRUCTION}\n\nCRITICAL: Please output your response entirely in ${language}.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: {
            type: Type.OBJECT,
            properties: {
              core_thesis: { type: Type.STRING },
              methodology: { type: Type.STRING },
              key_takeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
            },
            required: ["core_thesis", "methodology", "key_takeaways"],
          },
        },
        required: ["overview"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  try {
    return JSON.parse(response.text) as OverviewResponse;
  } catch (e) {
    console.error("Failed to parse AI response:", response.text);
    throw new Error("Invalid response format from AI");
  }
}

export async function analyzeConceptDeepDive(term: string, context: string, language: 'English' | 'Chinese' = 'English'): Promise<DeepDiveResponse> {
  const genAI = getAI();
  
  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { role: "user", parts: [{ text: `Term: ${term}\n\nContext:\n${context}` }] }
    ],
    config: {
      systemInstruction: `${DEEP_DIVE_SYSTEM_INSTRUCTION}\n\nCRITICAL: Please output your response entirely in ${language}.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          deep_dive: {
            type: Type.OBJECT,
            properties: {
              breakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    keyword: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ["keyword", "explanation"],
                },
              },
              context_quote: { type: Type.STRING },
              analogy: { type: Type.STRING },
            },
            required: ["breakdown", "context_quote", "analogy"],
          },
        },
        required: ["deep_dive"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI for deep dive");
  }

  try {
    return JSON.parse(response.text) as DeepDiveResponse;
  } catch (e) {
    console.error("Failed to parse Deep Dive AI response:", response.text);
    throw new Error("Invalid Deep Dive response format from AI");
  }
}

export async function askDocumentQuestion(
  documentText: string,
  selectedImage: ImagePart | null,
  extractedConcepts: Concept[],
  extractedOverview: DocumentOverview | null,
  chatHistory: { role: 'user' | 'assistant', content: string }[],
  userQuestion: string,
  language: 'English' | 'Chinese'
): Promise<string> {
  const genAI = getAI();
  
  const systemInstruction = `You are "CogniCard Academic," an expert academic assistant engaging in a conversational dialogue. Your goal is to help users analyze documents (PDFs, Images, or Text) with extreme precision. The context provided comprises the document text, any uploaded image, and any previously extracted concepts or document overviews. Combine all this information intelligently to answer the user's questions.

CRITICAL INSTRUCTIONS FOR IMAGE/DOCUMENT ANALYSIS & LONG-FORM CONTEXT:
1. Visual Grounding & Mapping: When a user refers to an item by its position or index (e.g., "term 7," "the 5th point," "the bottom card"), you must scan the visual layout and map the request to the corresponding content. Do not say "not mentioned" just because the specific index number isn't explicitly written next to the text.
2. Semantic & Fuzzy Matching: If a user asks about "skills gap" and the document discusses "mismatch between educational outcomes and industry needs," you MUST connect these concepts based on the context.
3. Inference Over Refusal: Never give a hard refusal like "The document does not mention this" unless the topic is completely unrelated. If you cannot find an exact match, use the "Proactive Search" strategy: Say "I couldn't find the exact phrase [Term], but based on the [7th section/relevant area], the document discusses [Related Content]. Is this what you are referring to?"
4. Multi-Modal Synthesis: Treat the image as a structured data source. Analyze titles, lists, and spatial relationships between items. Base your answer on all collected data.
5. Length & Detail: Your answer MUST be extremely concise, strictly under 50 words, unless the user explicitly requests a longer or more detailed response. Distill the absolute essence of the content.
6. Tone & Format: Adopt the persona of a domain expert having a natural conversation with the user. Do not sound like an AI robotic assistant. Explain the core essence clearly using the Feynman technique.
7. NO MARKDOWN: You MUST NOT use any markdown formatting symbols like '#' or '*' in your response. Write in plain conversational text paragraphs only.
8. Language: Output your entire response in the language specified: ${language}.`;

  const contents: any[] = [];
  let initialContextAdded = false;

  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    const parts: any[] = [];
    
    if (msg.role === 'user' && !initialContextAdded) {
       let ctx = `[SYSTEM CONTEXT INJECTED START]\nText Input: ${documentText || "None"}\n`;
       if (extractedConcepts && extractedConcepts.length > 0) {
           ctx += `Summarized Concepts:\n${JSON.stringify(extractedConcepts)}\n`;
       }
       if (extractedOverview) {
           ctx += `Summarized Overview:\n${JSON.stringify(extractedOverview)}\n`;
       }
       ctx += `[SYSTEM CONTEXT INJECTED END]\n\n`;
       
       parts.push({ text: ctx });
       if (selectedImage) {
           parts.push(selectedImage);
       }
       initialContextAdded = true;
    }
    
    parts.push({ text: msg.content });
    contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts });
  }

  const currentUserParts: any[] = [];
  if (!initialContextAdded) {
       let ctx = `[SYSTEM CONTEXT INJECTED START]\nText Input: ${documentText || "None"}\n`;
       if (extractedConcepts && extractedConcepts.length > 0) {
           ctx += `Summarized Concepts:\n${JSON.stringify(extractedConcepts)}\n`;
       }
       if (extractedOverview) {
           ctx += `Summarized Overview:\n${JSON.stringify(extractedOverview)}\n`;
       }
       ctx += `[SYSTEM CONTEXT INJECTED END]\n\n`;
       
       currentUserParts.push({ text: ctx });
       if (selectedImage) {
           currentUserParts.push(selectedImage);
       }
  }
  currentUserParts.push({ text: userQuestion });
  contents.push({ role: 'user', parts: currentUserParts });

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  return response.text || "No response generated.";
}
