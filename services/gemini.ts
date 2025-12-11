import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { CURRICULUM_DATA } from '../constants';

// Use Vite's environment variable system
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
  console.error("VITE_GOOGLE_API_KEY not found in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Using the fast and reliable Gemini 1.5 Flash
const MODEL_ID = 'gemini-1.5-flash';

const model = genAI.getGenerativeModel({ model: MODEL_ID });

const getModel = (systemInstruction: string, responseSchema?: any) => {
  return genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction,
    generationConfig: {
      responseMimeType: responseSchema ? 'application/json' : 'text/plain',
      responseSchema
    }
  });
};

export const suggestActivityDetails = async (title: string, grade: string) => {
  const systemInstruction = `
    Ets un mestre expert de primària a Catalunya redactant la programació d'aula.
    El teu objectiu és generar descripcions tècniques i precises per a documents docents.
    Estil: Tècnic, professional, concís. NO t'adrecis a les famílies ni als alumnes.
    Idioma: Català.
  `;

  const prompt = `
    Activitat: "${title}"
    Nivell: ${grade}
    
    Genera una descripció completa que inclogui:
    1. Objectiu didàctic principal.
    2. Dinàmica de treball dels alumnes.
    
    Longitud: 60-80 paraules.
    IMPORTANT: No utilitzis format markdown ni asteriscs (**). Només text pla.
  `;

  try {
    const aiModel = getModel(systemInstruction);
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error generant la descripció: ${errorMessage}`;
  }
};

export const expandActivityContent = async (title: string, shortDescription: string, grade: string) => {
  const systemInstruction = `
    Ets un mestre expert redactant seqüències didàctiques.
    Utilitza terminologia pedagògica actualitzada.
    Estil: Tècnic docent. Text pla sense Markdown.
    Idioma: Català.
  `;

  const prompt = `
    Títol: "${title}"
    Context: "${shortDescription}"
    Nivell: ${grade}

    Genera una seqüència didàctica detallada:
    1. Introducció (Activació de coneixements previs).
    2. Desenvolupament (Instruccions pas a pas).
    3. Tancament (Síntesi i reflexió).
  `;

  try {
    const aiModel = getModel(systemInstruction);
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini expansion error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error detallant l'activitat: ${errorMessage}`;
  }
};

export const suggestEvaluation = async (title: string, description: string, grade: string) => {
  const systemInstruction = `
    Ets un especialista en avaluació per competències.
    Genera indicadors observables i mesurables.
    Format: Text pla (sense negretes ni markdown).
    Idioma: Català.
  `;

  const prompt = `
    Activitat: "${title}"
    Descripció: "${description}"
    Nivell: ${grade}
    
    Proposta tècnica d'avaluació:
    1. Indicadors d'avaluació observables.
    2. Instruments d'avaluació recomanats.
    
    Màxim 150 paraules.
  `;

  try {
    const aiModel = getModel(systemInstruction);
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini evaluation error:", error);
    return "Error generant avaluació.";
  }
};

export const generateRubricHTML = async (title: string, description: string, criteria: string[], grade: string) => {
  const criteriaListString = criteria.length > 0 ? criteria.map(c => `- ${c}`).join('\n') : 'Criteris generals de l\'etapa.';

  const systemInstruction = `
    Ets un expert en disseny web i documentació educativa.
    La teva tasca és generar codi HTML net i específic per ser copiat i enganxat a Google Docs o Word.
    
    REGLES CRÍTIQUES D'HTML:
    1. Utilitza NOMÉS etiquetes <table>, <tr>, <th>, <td>.
    2. NO utilitzis CSS Grid ni Flexbox.
    3. Afegeix estils en línia (inline styles) a la taula per assegurar que les vores es vegin al copiar-ho.
       Exemple: <table style="border-collapse: collapse; width: 100%; border: 1px solid black;">
       Exemple cel·les: <td style="border: 1px solid black; padding: 8px;">
    4. Retorna NOMÉS el codi HTML dins del <body>, sense etiquetes <html> o <head>.
  `;

  const prompt = `
    Crea una Rúbrica d'Avaluació per a:
    - Títol: "${title}"
    - Descripció: "${description}"
    - Nivell: ${grade}
    - Criteris Oficials a avaluar: 
      ${criteriaListString}

    Estructura del document HTML:
    1. Títol (h2).
    2. Breu context de l'activitat (p).
    3. Llista de Criteris (ul/li).
    4. TAULA DE RÚBRICA:
       - Columnes: "Criteri / Saber", "Excel·lent (4)", "Notable (3)", "Satisfactori (2)", "En procés (1)".
       - Files: Genera una fila per a cada criteri o aspecte clau de l'activitat.
       - Contingut: Redacta descriptors progressius per a cada nivell competencial.

    Assegura't que la taula tingui vores visibles (border: 1px solid #000) en l'estil en línia.
  `;

  try {
    const aiModel = getModel(systemInstruction);
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || '';
    // Clean up code blocks if the model returns them despite instructions
    return text.replace(/```html/g, '').replace(/```/g, '').trim();
  } catch (error) {
    console.error("Gemini rubric HTML error:", error);
    return "<p style='color:red'>Error generant el document. Si us plau, comprova la connexió.</p>";
  }
};

export const suggestCurriculumLinks = async (title: string, description: string) => {
  const curriculumContext = CURRICULUM_DATA.map(c => ({
    id: c.id,
    area: c.area,
    text: `${c.saber}: ${c.description}`
  })).map(c => JSON.stringify(c)).join('\n');

  const systemInstruction = `
    You are a curriculum matching specialist for the Catalan education system.
    Your task is to analyze an activity and find the most relevant curriculum items from the provided list.
    Return ONLY valid JSON.
  `;

  const prompt = `
    Activity Title: "${title}"
    Activity Description: "${description}"

    Available Curriculum Items (JSON):
    ${curriculumContext}

    Task: Identify the top 1-3 curriculum items that best match this activity.
    Output: A JSON array of objects with "id" (string) and "reason" (string, in Catalan).
  `;

  const responseSchema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        reason: { type: SchemaType.STRING },
      },
      required: ["id", "reason"],
    }
  };

  try {
    const aiModel = getModel(systemInstruction, responseSchema);
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || '[]';
    return JSON.parse(text) as { id: string; reason: string }[];
  } catch (error) {
    console.error("Gemini matching error:", error);
    return [];
  }
};

export const chatWithCurriculum = async (message: string, history: { role: string, text: string }[]) => {
  const systemInstruction = `
    You are an expert educational planner and consultant specializing in the Catalan curriculum for primary education.
    Your goal is to help teachers plan activities, understand curriculum competencies, and evaluate student progress.
    Tone: Professional, encouraging, and practical. STRICTLY for teachers, never address parents/families.
    Language: Catalan.
    `;

  const chat = genAI.getGenerativeModel({ model: MODEL_ID, systemInstruction }).startChat({
    history: history.map(h => ({
      role: h.role as 'user' | 'model',
      parts: [{ text: h.text }]
    }))
  });

  const result = await chat.sendMessageStream(message);
  return result;
};
