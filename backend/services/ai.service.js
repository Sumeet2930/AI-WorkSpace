import { GoogleGenerativeAI } from "@google/generative-ai"
import fetch from 'node-fetch'


const generationConfig = {
    responseMimeType: "application/json",
    temperature: 0.4,
}

const systemInstruction = `You are an expert in MERN and Development. You have an experience of 10 years in the development. You always write code in modular and break the code in the possible way and follow best practices, You use understandable comments in the code, you create files as needed, you write code while maintaining the working of previous code. You always follow the best practices of the development You never miss the edge cases and always write code that is scalable and maintainable, In your code you always handle the errors and exceptions.
    
    Examples: 

    <example>
 
    response: {

    "text": "this is you fileTree structure of the express server",
    "fileTree": {
        "app.js": {
            file: {
                contents: "
                const express = require('express');

                const app = express();


                app.get('/', (req, res) => {
                    res.send('Hello World!');
                });


                app.listen(3000, () => {
                    console.log('Server is running on port 3000');
                })
                "
            
        },
    },

        "package.json": {
            file: {
                contents: "

                {
                    "name": "temp-server",
                    "version": "1.0.0",
                    "main": "index.js",
                    "scripts": {
                        "test": "echo \"Error: no test specified\" && exit 1"
                    },
                    "keywords": [],
                    "author": "",
                    "license": "ISC",
                    "description": "",
                    "dependencies": {
                        "express": "^4.21.2"
                    }
}

                
                "
                
                

            },

        },

    },
    "buildCommand": {
        mainItem: "npm",
            commands: [ "install" ]
    },

    "startCommand": {
        mainItem: "node",
            commands: [ "app.js" ]
    }
}

    user:Create an express application 
   
    </example>


    
       <example>

       user:Hello 
       response:{
       "text":"Hello, How can I help you today?"
       }
       
       </example>
    
 IMPORTANT : don't use file name like routes/index.js
       
       
    `

let resolvedModelId = null

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

function pickBestModelId(models) {
    // Prefer fast chat-capable models.
    const candidates = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => normalizeModelId(m.name))
        .filter(Boolean)

    const preferredOrder = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro',
        'gemini-pro',
    ]

    for (const pref of preferredOrder) {
        const hit = candidates.find(c => c === pref || c.startsWith(pref + '-'))
        if (hit) return hit
    }

    return candidates[0] || null
}

async function getModel() {
    const apiKey = process.env.GOOGLE_AI_KEY
    if (!apiKey) {
        throw new Error('GOOGLE_AI_KEY is not set')
    }

    const envModel = normalizeModelId(process.env.GEMINI_MODEL)
    const genAI = new GoogleGenerativeAI(apiKey)

    if (envModel) {
        return genAI.getGenerativeModel({
            model: envModel,
            generationConfig,
            systemInstruction,
        })
    }

    if (!resolvedModelId) {
        const models = await listAvailableModels(apiKey)
        resolvedModelId = pickBestModelId(models)
        if (!resolvedModelId) {
            throw new Error('No available model supports generateContent. Check ListModels output / API access.')
        }
        console.log('Resolved Gemini model:', resolvedModelId)
    }

    return genAI.getGenerativeModel({
        model: resolvedModelId,
        generationConfig,
        systemInstruction,
    })
}

export const generateResult = async (prompt) => {

    const model = await getModel()
    const result = await model.generateContent(prompt)
    return result.response.text()
}