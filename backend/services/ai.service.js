import { GoogleGenerativeAI } from "@google/generative-ai"
import fetch from 'node-fetch'


const generationConfig = {
    responseMimeType: "application/json",
    temperature: 0.4,
}

const systemInstruction = `You are an expert in MERN and Web Development. You have an experience of 10 years in the development. You always write code in modular and break the code in the possible way and follow best practices. You use understandable comments in the code, you create files as needed, you write code while maintaining the working of previous code. 

    IMPORTANT CONTEXT:
    The user is working in a WebContainer-based browser terminal. This environment supports:
    - Node.js / NPM
    - JavaScript / TypeScript
    - React / Vite / Next.js
    - HTML / CSS
    - TailWind CSS

    CRITICAL RESTRICTION:
    - ONLY write code in the languages listed above.
    - NEVER suggest or use compilers/interpreters for C++, Python, Java, C#, or PHP, as they are NOT available in this environment.
    - If the user asks for a non-web language, politely explain that you are a web developer specialist and provide a JavaScript-based alternative or solution if applicable.
    - Always follow the best practices of development. Never miss edge cases and always write code that is scalable and maintainable.
    - Handle errors and exceptions in your code.
    - Don't use file names like routes/index.js.

    JSON RESPONSE FORMAT:
    You must always respond in the following JSON format:
    {
        "text": "Your feedback or explanation for the user.",
        "fileTree": {
            "fileName": {
                "file": {
                    "contents": "File content goes here"
                }
            }
        },
        "buildCommand": {
            "mainItem": "npm",
            "commands": ["install"]
        },
        "startCommand": {
            "mainItem": "npm",
            "commands": ["start"]
        }
    }

    EXAMPLES:
    User: "Create a basic html file"
    Response:
    {
        "text": "I have created a basic index.html file for you.",
        "fileTree": {
            "index.html": {
                "file": {
                    "contents": "..."
                }
            }
        }
    }
    `

function normalizeModelId(modelNameOrId) {
    if (!modelNameOrId) return null
    // ListModels returns names like "models/gemini-1.5-flash".
    return String(modelNameOrId).replace(/^models\//, '')
}

async function listAvailableModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`ListModels failed: [${res.status} ${res.statusText}] ${text}`)
    }
    const json = await res.json()
    return Array.isArray(json.models) ? json.models : []
}

async function getGenerativeModel(modelId) {
    const apiKey = process.env.GOOGLE_AI_KEY
    const genAI = new GoogleGenerativeAI(apiKey)
    return genAI.getGenerativeModel({
        model: modelId,
        generationConfig,
        systemInstruction,
    })
}

export const generateResult = async (prompt) => {
    const apiKey = process.env.GOOGLE_AI_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_KEY is not set')

    const models = await listAvailableModels(apiKey)
    const candidates = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => normalizeModelId(m.name))
        .filter(Boolean)

    const preferredOrder = [
        normalizeModelId(process.env.GEMINI_MODEL),
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-pro',
    ].filter(Boolean)

    let lastError = null
    for (const pref of preferredOrder) {
        const modelId = candidates.find(c => c === pref || c.startsWith(pref + '-'))
        if (!modelId) continue

        try {
            console.log(`Attempting AI generation with model: ${modelId}`)
            const model = await getGenerativeModel(modelId)
            const result = await model.generateContent(prompt)
            return result.response.text()
        } catch (err) {
            console.error(`AI model ${modelId} failed:`, err.message)
            lastError = err
            // Fallback on 503 (Overloaded) or 429 (Rate Limit) or any error message containing "overloaded"
            const isRetryable = err.message.includes('503') || 
                               err.message.includes('429') || 
                               err.message.toLowerCase().includes('overloaded') ||
                               err.message.toLowerCase().includes('service unavailable')
            
            if (isRetryable) {
                console.log(`Model ${modelId} is overloaded/unavailable, trying next model...`)
                continue
            }
            // For other potentially transitory errors, try the next one too
            continue
        }
    }

    throw lastError || new Error('All AI models failed to generate content')
}