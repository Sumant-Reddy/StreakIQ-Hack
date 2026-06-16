const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

let genAI;
let openaiClient;
let anthropicClient;

const getGenAI = () => {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

const getOpenAI = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const getAnthropic = () => {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
};

const ROLEPLAY_SCRIPTS = {
  anniversary: [
    "Good morning! I'm looking for a special diamond ring for my 10th anniversary. I have a budget of around ₹50,000. What would you recommend?",
    "That sounds beautiful! Can you tell me more about the diamond quality? My wife loves yellow gold settings.",
    "What warranty do you provide? And do you offer any customization?",
    "I'm interested! Does this come with a certificate of authenticity?",
  ],
  engagement: [
    "Hi! This is actually my first time buying an engagement ring and I'm a bit nervous. I don't know much about diamonds. Where do I start?",
    "What's the difference between the cuts? I keep hearing about 'round brilliant' online.",
    "My budget is flexible, maybe ₹80,000 to ₹1.2 lakh. What would you suggest in that range?",
    "Does CaratLane offer any kind of try-at-home service?",
  ],
  upgrade: [
    "I currently have a 0.5ct solitaire and I'm looking to upgrade to 1ct. I've been comparing prices online and CaratLane seems to be at a premium. Can you justify the difference?",
    "I saw a similar 1ct SI1, G color on another site for ₹1.8 lakh. What makes yours worth ₹2.2 lakh?",
    "What about the cut grade? That site doesn't mention it.",
    "Fair enough. What's the best 1ct stone you have in the ₹2-2.5 lakh range?",
  ],
  gifting: [
    "Hello, I need 5 gift sets for my top-performing employees. Budget is under ₹10,000 per set. I also need personalized engraving on each piece. Is that possible?",
    "What jewelry pieces work well as corporate gifts? Something gender-neutral preferably.",
    "Can you do bulk orders with a corporate discount? We do this every quarter.",
    "What's the lead time for engraving and bulk dispatch?",
  ],
};

async function callLLM(messages, { model, temperature = 0.7, max_tokens = 2000 } = {}) {
  // 1. Try Gemini (primary)
  const ai = getGenAI();
  if (ai) {
    try {
      const geminiModel = ai.getGenerativeModel({
        model: model || 'gemini-1.5-flash',
        generationConfig: { temperature, maxOutputTokens: max_tokens },
      });
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');

      const chat = geminiModel.startChat({
        systemInstruction: systemMsg?.content,
        history: userMsgs.slice(0, -1).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      });

      const lastMsg = userMsgs[userMsgs.length - 1]?.content || '';
      const result = await chat.sendMessage(lastMsg);
      return result.response.text();
    } catch (err) {
      logger.warn('Gemini LLM failed, trying fallback:', err.message);
    }
  }

  // 2. Try OpenAI
  const openai = getOpenAI();
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens,
      });
      return resp.choices[0].message.content;
    } catch (err) {
      logger.warn('OpenAI LLM failed, trying fallback:', err.message);
    }
  }

  // 3. Try Anthropic
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens,
        system: systemMsg?.content,
        messages: userMsgs,
      });
      return resp.content[0].text;
    } catch (err) {
      logger.warn('Anthropic LLM failed:', err.message);
    }
  }

  logger.warn('No AI provider configured — using mock response');
  return generateMockResponse(messages);
}

function generateMockResponse(messages) {
  const lastMsg = messages[messages.length - 1]?.content || '';
  if (lastMsg.includes('quiz') || lastMsg.includes('question')) {
    return JSON.stringify({
      questions: [
        {
          text: 'What is the 4C framework used in jewelry evaluation?',
          type: 'MCQ',
          difficulty: 'MEDIUM',
          options: ['Cut, Color, Clarity, Carat', 'Cost, Color, Cut, Carat', 'Color, Clarity, Cost, Carat', 'Cut, Clarity, Cost, Color'],
          correctAnswer: 'Cut, Color, Clarity, Carat',
          explanation: 'The 4Cs—Cut, Color, Clarity, and Carat weight—are the standard criteria for evaluating diamond quality.',
          points: 10,
        },
      ],
    });
  }
  if (lastMsg.includes('summary') || lastMsg.includes('summarize')) {
    return 'This content covers key concepts essential for understanding the topic.';
  }
  return 'Based on the course material, here is a comprehensive response to your question.';
}

async function ragAnswer({ question, context, sources = [], userId, courseTitle = '' }) {
  const sourceSection = sources.length
    ? `\nSources used: ${sources.join(', ')}`
    : '';

  const systemPrompt = `You are YAMI, an AI learning companion for CaratLane jewelry retail training.
Your answers are grounded ONLY in the provided knowledge base context.
If the context does not contain enough information to answer the question, say so clearly — do not make up information.
Be concise, practical, and use examples relevant to jewelry retail when helpful.
Always respond in the same language as the user's question.`;

  const userPrompt = `${context ? `Context from CaratLane knowledge base:\n${context}\n\n` : ''}Question: ${question}`;

  const answer = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.5, max_tokens: 1000 });

  return { answer, sources, sourceSection };
}

async function generateQuiz({ content, contentType, difficulty = 'MEDIUM', count = 10, courseTitle = '' }) {
  const prompt = `You are an expert educational content creator for CaratLane, a jewelry retail company.

Generate ${count} quiz questions based on this ${contentType} content about "${courseTitle}".

Content:
${content.substring(0, 4000)}

Requirements:
- Mix of MCQ (60%), True/False (20%), and Scenario-based (20%) questions
- Difficulty: ${difficulty}
- Focus on practical application and retention
- Questions should test understanding, not just memorization
- Include 4 options for MCQ, mark correct answer
- Add clear explanation for each answer

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "text": "question text",
      "type": "MCQ|TRUE_FALSE|SCENARIO",
      "difficulty": "EASY|MEDIUM|HARD",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "exact option text",
      "explanation": "why this is correct",
      "points": 10
    }
  ]
}`;

  const response = await callLLM([
    { role: 'system', content: 'You are an expert quiz generator. Always return valid JSON.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.6, max_tokens: 4000 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return parsed.questions || [];
  } catch (e) {
    logger.error('Failed to parse quiz JSON:', e.message);
    return JSON.parse(generateMockResponse([{ content: 'quiz' }])).questions;
  }
}

async function generateSummary({ content, contentType, courseTitle = '' }) {
  const response = await callLLM([
    { role: 'system', content: 'You are an expert learning content summarizer. Create concise, actionable summaries.' },
    { role: 'user', content: `Summarize this ${contentType} content for "${courseTitle}" in 3-5 key bullet points with practical takeaways:\n\n${content.substring(0, 4000)}` },
  ], { temperature: 0.5, max_tokens: 800 });
  return response;
}

async function generateFlashcards({ content, moduleTitle = '', count = 10 }) {
  const response = await callLLM([
    { role: 'system', content: 'You are a flashcard creator. Return valid JSON only.' },
    { role: 'user', content: `Create ${count} flashcards for "${moduleTitle}".\n\nContent:\n${content.substring(0, 3000)}\n\nReturn JSON: {"flashcards": [{"front": "question/term", "back": "answer/definition"}]}` },
  ], { temperature: 0.6, max_tokens: 2000 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return parsed.flashcards || [];
  } catch {
    return [{ front: 'What are the 4Cs of diamonds?', back: 'Cut, Color, Clarity, Carat weight' }];
  }
}

async function answerQuestion({ question, context, userId, courseTitle = '' }) {
  const response = await callLLM([
    {
      role: 'system',
      content: `You are YAMI, an AI learning companion for CaratLane jewelry retail training.
You help learners understand course material, answer questions, and reinforce knowledge.
Be concise, friendly, and practical. Use examples relevant to jewelry retail.`,
    },
    {
      role: 'user',
      content: `Course: ${courseTitle}\n\nContext from course material:\n${context || 'No specific context provided.'}\n\nLearner question: ${question}`,
    },
  ], { temperature: 0.7, max_tokens: 1000 });
  return response;
}

async function generateManagerInsight({ query, teamData }) {
  const response = await callLLM([
    {
      role: 'system',
      content: `You are an AI Manager Copilot for CaratLane's learning platform.
You analyze team learning data and provide actionable insights.
Be specific, data-driven, and focus on actionable recommendations.`,
    },
    {
      role: 'user',
      content: `Manager Query: ${query}\n\nTeam Learning Data:\n${JSON.stringify(teamData, null, 2)}\n\nProvide a detailed, structured response with specific employee names, metrics, and recommended actions.`,
    },
  ], { temperature: 0.6, max_tokens: 1500 });
  return response;
}

async function scoreRoleplay({ transcript, scenario }) {
  const response = await callLLM([
    {
      role: 'system',
      content: `You are a retail training evaluator for CaratLane. Score roleplay conversations between a jewelry consultant and a customer.
Score on: Product Knowledge (0-100), Confidence (0-100), Communication (0-100), Upselling Ability (0-100).
Return JSON only.`,
    },
    {
      role: 'user',
      content: `Scenario: ${scenario}\n\nTranscript:\n${JSON.stringify(transcript, null, 2)}\n\nReturn JSON: {"productScore": 85, "confidenceScore": 78, "communicationScore": 90, "upsellScore": 72, "overallScore": 81, "feedback": "detailed feedback", "strengths": ["..."], "improvements": ["..."]}`,
    },
  ], { temperature: 0.4, max_tokens: 1200 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch {
    return {
      productScore: 75, confidenceScore: 70, communicationScore: 80, upsellScore: 65,
      overallScore: 72, feedback: 'Good effort! Focus on product knowledge and upselling techniques.',
      strengths: ['Good communication', 'Customer-friendly approach'],
      improvements: ['Deepen product knowledge', 'Practice upselling'],
    };
  }
}

async function generateRoleplayResponse({ scenario, transcript, customerPersona }) {
  const messages = [
    {
      role: 'system',
      content: `You are playing the role of a ${customerPersona} customer at CaratLane jewelry store.
Scenario: ${scenario}
Stay in character. Ask realistic jewelry shopping questions. Be slightly challenging but fair.
Give SHORT responses (1-3 sentences max). React naturally to the consultant's answers.`,
    },
    ...transcript.map(t => ({ role: t.role === 'customer' ? 'assistant' : 'user', content: t.content })),
  ];

  // Try all LLM providers via callLLM; intercept the mock fallback path ourselves
  // so we can return a scenario-aware scripted line instead of a generic sentence.
  const ai = getGenAI();
  const openai = getOpenAI();
  const anthropic = getAnthropic();

  if (ai || openai || anthropic) {
    try {
      return await callLLM(messages, { temperature: 0.8, max_tokens: 200 });
    } catch (_) {
      // all providers failed — fall through to script fallback
    }
  }

  // Script-based fallback: pick the array that matches the scenario id.
  // scenario strings typically contain the id as a word, e.g. "anniversary", "engagement", etc.
  const scenarioLower = (scenario || '').toLowerCase();
  const scriptKey = Object.keys(ROLEPLAY_SCRIPTS).find(k => scenarioLower.includes(k)) || 'anniversary';
  const lines = ROLEPLAY_SCRIPTS[scriptKey];

  // Use the number of customer turns already in the transcript as the turn index.
  const customerTurns = transcript.filter(t => t.role === 'customer').length;
  const line = lines[customerTurns % lines.length];

  logger.warn(`No AI provider available — returning scripted roleplay line for scenario "${scriptKey}", turn ${customerTurns}`);
  return line;
}

module.exports = {
  generateQuiz,
  generateSummary,
  generateFlashcards,
  answerQuestion,
  ragAnswer,
  generateManagerInsight,
  scoreRoleplay,
  generateRoleplayResponse,
  callLLM,
};
