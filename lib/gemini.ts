// @ts-nocheck

import { GoogleGenAI, Chat } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `You are a friendly and helpful AI assistant for the PYJ Point of Sale system. 
Your name is PYJ-AI. You have access to real-time sales and inventory data, which will be provided to you in JSON format with every user message. 
Use this data to answer user questions accurately. 
Format your answers clearly using markdown (e.g., using lists, bold text). If you are asked to provide data, present it in a table or a list. 
Do not mention that you are an AI assistant or that you were given data. Just answer the questions as if you are an integrated part of the POS system.`;

let chatInstance: Chat | null = null;

export function getChat(): Chat {
    if (!chatInstance) {
        chatInstance = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: systemInstruction
            },
        });
    }
    return chatInstance;
}