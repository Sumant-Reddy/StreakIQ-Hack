const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listMyAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not defined in your environment.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    console.log("📡 Fetching visible models for your API Key...");
    // Direct REST call using your package client's key parameter context
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (!data.models || data.models.length === 0) {
      console.log("⚠️ Google returned an empty model array. Your API Key is active but lacks service provisioning.");
      return;
    }

    console.log("\n📋 --- YOUR AVAILABLE MODELS ---");
    data.models.forEach(m => {
      console.log(`🔹 Model ID: ${m.name}`);
      console.log(`   Supported Methods: ${m.supportedGenerationMethods.join(', ')}\n`);
    });

  } catch (err) {
    console.error("❌ Failed to contact Model listing service:", err.message);
  }
}

listMyAvailableModels();