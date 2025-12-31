
import { GoogleGenAI, Type } from "@google/genai";
import { SchematicData, ComponentType } from "../types";

// FIX: Strictly follow guidelines for API key initialization by using process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const GRID_STEP = 100;

export const generateSchematic = async (prompt: string, currentSchematic?: SchematicData): Promise<SchematicData> => {
  const modelId = "gemini-3-pro-preview";

  const systemInstruction = `
    You are a World-Class EDA (Electronic Design Automation) Architect.
    
    ENGINEERING RULES:
    1. DECOUPLING: Always place 100nF capacitors between VCC and GND pins of ICs.
    2. LOGIC: Use 10k Pull-up/Pull-down resistors for reset pins or open-drain outputs.
    3. POWER: Ensure every circuit has a Voltage Source and a Ground.
    4. TOPOLOGY: Inputs on the left, Power/GND rails top/bottom, processing in center, outputs on right.

    COMPONENT LIBRARY & PINS:
    - Standard Passives: RESISTOR(1,2), CAPACITOR(1,2), INDUCTOR(1,2)
    - Semiconductors: LED(A,K), DIODE(A,K), TRANSISTOR_NPN(B,C,E), MOSFET_N(G,D,S)
    - ICs: Use IC_GENERIC for any complex chip. Provide a 'pins' array in the node.
      Example IC pins: {id: "1", label: "VCC", x: -50, y: -40, orientation: "left"}
    - Power: VOLTAGE_SOURCE(POS, NEG), GROUND(1), REGULATOR(IN, OUT, GND)
    - Connectors: CONNECTOR(1...N), SWITCH(1,2)

    PARAMETRIC GENERATION:
    If a requested component doesn't exist, use IC_GENERIC and define its pins. 
    A typical IC_GENERIC has width=100, height=80-200. Pins are at multiples of 20 units.

    OUTPUT: Provide JSON including 'thoughtProcess' (engineering rationale).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: currentSchematic ? `CURRENT DESIGN: ${JSON.stringify(currentSchematic)}\n\nUSER REQUEST: ${prompt}` : `START NEW DESIGN: ${prompt}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 8000 }, // High budget for complex circuit planning
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thoughtProcess: { type: Type.STRING },
            title: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  gridX: { type: Type.NUMBER },
                  gridY: { type: Type.NUMBER },
                  rotation: { type: Type.NUMBER },
                  pins: { 
                    type: Type.ARRAY, 
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        orientation: { type: Type.STRING }
                      }
                    }
                  }
                },
                required: ["id", "type", "gridX", "gridY"]
              }
            },
            wires: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceId: { type: Type.STRING },
                  sourcePin: { type: Type.STRING },
                  targetId: { type: Type.STRING },
                  targetPin: { type: Type.STRING }
                },
                required: ["sourceId", "sourcePin", "targetId", "targetPin"]
              }
            }
          }
        }
      }
    });

    // FIX: Access response.text directly (property, not a method).
    const data = JSON.parse(response.text || "{}");
    
    return {
      title: data.title || "AI Generated Circuit",
      description: data.thoughtProcess || "",
      nodes: (data.nodes || []).map((n: any) => ({
        ...n,
        x: n.gridX * GRID_STEP,
        y: n.gridY * GRID_STEP,
        rotation: n.rotation || 0,
        type: n.type as ComponentType,
        pins: n.pins // Preserve AI-defined parametric pins
      })),
      wires: (data.wires || []).map((w: any) => ({
        ...w,
        id: `wire_${Math.random().toString(36).substr(2, 9)}`
      }))
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};
