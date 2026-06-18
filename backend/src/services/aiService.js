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

async function callGeminiModel(ai, modelName, messages, { temperature, max_tokens, disableThinking }) {
  const generationConfig = { temperature, maxOutputTokens: max_tokens };
  if (disableThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const geminiModel = ai.getGenerativeModel({ model: modelName, generationConfig });
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');
  const chat = geminiModel.startChat({
    systemInstruction: systemMsg?.content ? { parts: [{ text: systemMsg.content }] } : undefined,
    history: userMsgs.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  });
  const lastMsg = userMsgs[userMsgs.length - 1]?.content || '';
  const result = await chat.sendMessage(lastMsg);
  return result.response.text();
}

// Gemini models to try in order — newer first, fall back to stable versions
const GEMINI_MODELS = ['gemini-2.5-flash'];

async function callLLM(messages, { model, temperature = 0.7, max_tokens = 2000, disableThinking = false } = {}) {
  // 1. Try Gemini (primary) — attempt models in order until one succeeds
  const ai = getGenAI();
  if (ai) {
    const modelsToTry = model ? [model] : GEMINI_MODELS;
    for (const geminiModel of modelsToTry) {
      try {
        return await callGeminiModel(ai, geminiModel, messages, { temperature, max_tokens, disableThinking });
      } catch (err) {
        logger.warn(`Gemini model "${geminiModel}" failed`, { error: err.message || err.toString() });
      }
    }
    logger.warn('All Gemini models failed, trying next provider');
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
      logger.warn('OpenAI LLM failed, trying fallback', { error: err.message || err.toString() });
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
      logger.warn('Anthropic LLM failed', { error: err.message || err.toString() });
    }
  }

  logger.warn('No AI provider configured — using mock response');
  return generateMockResponse(messages);
}

const MOCK_QUESTIONS = [
  { text: 'What is the 4C framework used in diamond evaluation?', type: 'MCQ', difficulty: 'EASY', options: ['Cut, Color, Clarity, Carat', 'Cost, Color, Cut, Carat', 'Color, Clarity, Cost, Carat', 'Cut, Clarity, Cost, Color'], correctAnswer: 'Cut, Color, Clarity, Carat', explanation: 'The 4Cs—Cut, Color, Clarity, and Carat weight—are the global standard for evaluating diamond quality.', points: 10 },
  { text: 'Which diamond cut is considered the most brilliant?', type: 'MCQ', difficulty: 'MEDIUM', options: ['Princess Cut', 'Round Brilliant', 'Emerald Cut', 'Pear Cut'], correctAnswer: 'Round Brilliant', explanation: 'Round Brilliant has 58 facets optimized for maximum light reflection, making it the brightest cut.', points: 10 },
  { text: 'A higher carat weight always means a better-looking diamond.', type: 'TRUE_FALSE', difficulty: 'EASY', options: ['True', 'False'], correctAnswer: 'False', explanation: 'Cut quality has a larger impact on a diamond\'s brilliance than carat weight. A well-cut smaller stone can outshine a poorly cut larger one.', points: 10 },
  { text: 'A customer at CaratLane asks why a 0.8ct SI1 diamond looks dull compared to a 0.5ct VS2. What is most likely the reason?', type: 'SCENARIO', difficulty: 'HARD', options: ['The SI1 has more inclusions visible to the naked eye', 'The cut grade of the 0.8ct may be Poor or Fair', 'Carat weight reduces clarity', 'The VS2 was treated for brightness'], correctAnswer: 'The cut grade of the 0.8ct may be Poor or Fair', explanation: 'Cut is the most important C for brilliance. A poorly cut larger diamond reflects less light than an excellently cut smaller one.', points: 10 },
  { text: 'What does IGI stand for in diamond certification?', type: 'MCQ', difficulty: 'EASY', options: ['International Gemological Institute', 'India Gems Index', 'International Gold Index', 'Institute of Gemological Inspection'], correctAnswer: 'International Gemological Institute', explanation: 'IGI (International Gemological Institute) is one of the world\'s leading diamond grading labs, widely used for CaratLane certified diamonds.', points: 10 },
  { text: 'Which gold purity is most commonly used for jewelry in India?', type: 'MCQ', difficulty: 'MEDIUM', options: ['24 Karat', '22 Karat', '18 Karat', '14 Karat'], correctAnswer: '22 Karat', explanation: '22 Karat gold (91.6% pure) is the most popular for traditional Indian jewelry due to its balance of purity and durability.', points: 10 },
  { text: 'A customer is comparing CaratLane prices to a competitor. What is the best approach?', type: 'SCENARIO', difficulty: 'MEDIUM', options: ['Match the competitor price immediately', 'Focus on CaratLane\'s quality certifications, warranty, and try-at-home service', 'Tell the customer the competitor uses fake diamonds', 'Offer an unapproved discount'], correctAnswer: 'Focus on CaratLane\'s quality certifications, warranty, and try-at-home service', explanation: 'Value selling—highlighting certifications, services, and brand trust—is more effective than price matching and avoids margin erosion.', points: 10 },
  { text: 'In diamond grading, D-F colors are classified as colorless.', type: 'TRUE_FALSE', difficulty: 'MEDIUM', options: ['True', 'False'], correctAnswer: 'True', explanation: 'On the GIA/IGI color scale, D-F are Colorless, G-J are Near Colorless, and K+ have visible yellow tones.', points: 10 },
  { text: 'What does BIS Hallmark signify on gold jewelry?', type: 'MCQ', difficulty: 'HARD', options: ['Bureau of Indian Standards purity certification', 'Best Indian Silverwork certification', 'Brand Identity Symbol', 'Basic Import Standard'], correctAnswer: 'Bureau of Indian Standards purity certification', explanation: 'BIS Hallmark certifies the purity of gold in India. It is mandatory for selling gold jewelry above 2 grams since 2021.', points: 10 },
  { text: 'What technique helps increase average transaction value in jewelry retail?', type: 'MCQ', difficulty: 'MEDIUM', options: ['Upselling and cross-selling', 'Offering maximum discounts', 'Showing only the lowest priced items', 'Rushing the customer decision'], correctAnswer: 'Upselling and cross-selling', explanation: 'Upselling (suggesting a better product) and cross-selling (suggesting complementary items like earrings with a necklace) are proven techniques to increase basket value.', points: 10 },
];

// Extract the raw content section from a quiz/flashcard prompt
function extractContentFromPrompt(prompt) {
  const contentMatch = prompt.match(/Content:\s*([\s\S]*?)(?:Requirements:|Return ONLY|Return JSON|$)/);
  return contentMatch ? contentMatch[1].trim() : '';
}

// Split content into usable sentences (length-filtered, stop-word stripped)
function usableSentences(text) {
  return text
    .replace(/\n+/g, ' ')
    .split(/[.!?\r]+/)
    .map(s => s.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(s => s.length > 30 && s.length < 400 && s.split(' ').length >= 5);
}

// Build content-aware MCQ/TRUE_FALSE questions from sentence list
function buildQuestionsFromSentences(sentences, count) {
  const STOP = new Set(['the','and','or','is','are','was','were','this','that','with','from','have','will','been','they','them','their','about','when','where','what','which','these','those','then','than','also','some','such','into','over','after','before','under','between','through','during','each','every','other','both','few','more','most','only','just','because','while','though','although','however','therefore','thus','hence','so','but','not','for','to','of','in','on','at','by','up','an','a']);
  const diffs = ['EASY', 'MEDIUM', 'HARD'];
  const qs = [];
  for (let i = 0; i < Math.min(count, sentences.length * 3); i++) {
    const sentence = sentences[i % sentences.length];
    const isTrue = i % 4 !== 3;
    if (!isTrue) {
      qs.push({ text: `True or False: ${sentence}`, type: 'TRUE_FALSE', difficulty: diffs[i % 3], options: ['True', 'False'], correctAnswer: 'True', explanation: `This is stated in the module: "${sentence}"`, points: 10 });
    } else {
      const meaningful = sentence.split(' ').filter(w => w.length > 4 && !STOP.has(w.toLowerCase()));
      if (meaningful.length < 2) continue;
      const keyTerm = meaningful[Math.min(Math.floor(meaningful.length * 0.5), meaningful.length - 1)];
      const d1 = meaningful[0] !== keyTerm ? meaningful[0] : meaningful[meaningful.length - 1] || 'N/A';
      const d2 = meaningful[meaningful.length - 1] !== keyTerm ? meaningful[meaningful.length - 1] : meaningful[1] || 'Not applicable';
      const blank = sentence.replace(new RegExp(`\\b${keyTerm}\\b`), '___').substring(0, 140);
      qs.push({ text: `Fill in the blank: "${blank}"`, type: 'MCQ', difficulty: diffs[i % 3], options: [keyTerm, d1, d2, 'None of the above'], correctAnswer: keyTerm, explanation: `From the material: "${sentence}"`, points: 10 });
    }
    if (qs.length === count) break;
  }
  return qs;
}

function generateMockResponse(messages) {
  const lastMsg = messages[messages.length - 1]?.content || '';
  // Check flashcard BEFORE quiz — flashcard prompts include "question/term" which would trigger the quiz branch
  if (lastMsg.includes('flashcard') || lastMsg.match(/Create \d+ flashcard/)) {
    const countMatch = lastMsg.match(/Create (\d+) flashcard/);
    const count = countMatch ? Math.min(parseInt(countMatch[1]), 20) : 5;
    const content = extractContentFromPrompt(lastMsg) || lastMsg;
    const titleMatch = lastMsg.match(/for "([^"]+)"/);
    const moduleTitle = titleMatch ? titleMatch[1] : 'this module';
    const sentences = usableSentences(content);
    const flashcards = sentences.slice(0, count).map((s, i) => {
      const words = s.split(' ').filter(w => w.length > 4 && !/^(this|that|there|their|these|those|which|where|about)$/i.test(w));
      const keyVerb = s.match(/\b(navigate|search|view|scan|tap|open|align|select|enter|record|flag|click|check|verify|confirm|follow|create|update|delete)\b/i);
      if (keyVerb) {
        return { front: `How do you ${keyVerb[1].toLowerCase()} in ${moduleTitle}?`, back: s };
      }
      const term = words[1] || words[0] || moduleTitle;
      return { front: `What is "${term}" in the context of ${moduleTitle}?`, back: s };
    });
    // Pad with defaults if needed
    const defaults = [
      { front: 'What are the 4Cs of diamonds?', back: 'Cut, Color, Clarity, Carat weight — the global standard for evaluating diamond quality.' },
      { front: 'What is BIS Hallmark?', back: 'Bureau of Indian Standards certification ensuring gold jewelry meets declared purity standards.' },
      { front: 'What is the most brilliant diamond cut?', back: 'Round Brilliant — 58 facets optimized for maximum light return and sparkle.' },
    ];
    let di = 0;
    while (flashcards.length < count) { flashcards.push(defaults[di++ % defaults.length]); }
    return JSON.stringify({ flashcards: flashcards.slice(0, count) });
  }
  if (lastMsg.includes('quiz') || lastMsg.match(/Generate \d+ quiz/)) {
    const countMatch = lastMsg.match(/Generate (\d+) quiz/);
    const count = countMatch ? Math.min(parseInt(countMatch[1]), 20) : 5;
    const content = extractContentFromPrompt(lastMsg);
    const sentences = usableSentences(content);
    let questions = sentences.length >= 2 ? buildQuestionsFromSentences(sentences, count) : [];
    let mockIdx = 0;
    while (questions.length < count) {
      questions.push(MOCK_QUESTIONS[mockIdx % MOCK_QUESTIONS.length]);
      mockIdx++;
    }
    return JSON.stringify({ questions: questions.slice(0, count) });
  }
  if (lastMsg.includes('summary') || lastMsg.includes('summarize')) {
    const content = extractContentFromPrompt(lastMsg);
    const sentences = usableSentences(content);
    if (sentences.length >= 3) {
      return sentences.slice(0, 5).map(s => `• ${s}`).join('\n');
    }
    return '• Covers essential training knowledge for CaratLane associates\n• Focuses on practical application and skill development\n• Includes key procedures, tools, and best practices\n• Provides step-by-step guidance for daily operations\n• Reinforces compliance and customer excellence standards';
  }
  return 'Based on the course material, here is a comprehensive response to your question.';
}

async function ragAnswer({ question, context, sources = [], userId, courseTitle = '' }) {
  const hasContext = context && context.trim().length > 50;

  const systemPrompt = hasContext
    ? `You are YAMI, an AI learning companion for CaratLane jewelry retail training.
Your answers are grounded in the provided knowledge base context below.
Be concise, practical, and use examples relevant to jewelry retail.
Always respond in the same language as the user's question.`
    : `You are YAMI, an AI learning companion for CaratLane, India's leading jewelry brand.
You are an expert in: diamond grading (4Cs — cut, color, clarity, carat), jewelry types (solitaire, halo, eternity), gold and platinum, CaratLane products and services, retail selling techniques, customer handling, upselling, certifications (GIA/IGI/BIS), and jewelry care.
Answer confidently from your training knowledge. Be practical and specific to jewelry retail context.
Always respond in the same language as the user's question.`;

  const userPrompt = hasContext
    ? `Context from CaratLane knowledge base:\n${context}\n\nQuestion: ${question}`
    : `Question: ${question}`;

  const answer = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.5, max_tokens: 1000, disableThinking: true });

  return { answer, sources, sourceSection: sources.length ? `\nSources: ${sources.join(', ')}` : '' };
}

async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text.substring(0, 8000);
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.substring(0, 8000);
  }
  return buffer.toString('utf-8').substring(0, 8000);
}

async function generateQuiz({ content, contentType, difficulty = 'MEDIUM', count = 10, courseTitle = '' }) {
  const isMixed = difficulty === 'MIXED';
  const difficultyLine = isMixed
    ? `- Generate EXACTLY 3 EASY, 4 MEDIUM, and 3 HARD questions (total 10). Label each with the correct difficulty in the "difficulty" field.`
    : `- Difficulty: ${difficulty} for all questions`;
  const totalCount = isMixed ? 10 : count;

  const prompt = `You are an expert educational content creator for CaratLane, a jewelry retail company.

Generate ${totalCount} quiz questions based on this ${contentType} content about "${courseTitle}".

Content:
${content.substring(0, 4000)}

Requirements:
- Mix of MCQ (60%), True/False (20%), and Scenario-based (20%) questions
${difficultyLine}
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
    // Keyword-based scoring fallback — same logic as the frontend's offlineScore()
    const consultantMsgs = transcript.filter(t => t.role === 'consultant');
    const allText = consultantMsgs.map(m => m.content.toLowerCase()).join(' ');
    const productKws = ['diamond', 'carat', 'clarity', 'cut', 'color', 'certificate', 'igi', 'gia', 'solitaire', 'setting', 'quality', 'si ', 'vs ', 'vvs'];
    const upsellKws = ['also', 'additionally', 'complement', 'pair', 'matching', 'warranty', 'care plan', 'upgrade', 'premium', 'cross-sell'];
    const productHits = productKws.filter(k => allText.includes(k)).length;
    const upsellHits = upsellKws.filter(k => allText.includes(k)).length;
    const avgWords = consultantMsgs.length
      ? consultantMsgs.reduce((s, m) => s + m.content.split(/\s+/).length, 0) / consultantMsgs.length
      : 0;
    const productScore = Math.min(95, 50 + productHits * 5);
    const upsellScore = Math.min(90, 45 + upsellHits * 7);
    const communicationScore = Math.min(90, Math.max(40, 40 + Math.round(avgWords * 1.5)));
    const confidenceScore = Math.min(88, 50 + consultantMsgs.length * 4);
    const overallScore = Math.round((productScore + upsellScore + communicationScore + confidenceScore) / 4);
    return {
      productScore, confidenceScore, communicationScore, upsellScore, overallScore,
      feedback: 'Scored using keyword analysis. Add a valid Gemini API key for detailed AI feedback.',
      strengths: [
        ...(productScore >= 70 ? ['Good product knowledge demonstrated'] : []),
        ...(communicationScore >= 65 ? ['Clear and detailed responses'] : []),
      ],
      improvements: [
        ...(productScore < 70 ? ['Mention product specifics: cut, clarity, certification (IGI/GIA)'] : []),
        ...(upsellScore < 65 ? ['Introduce complementary products or care/warranty plans'] : []),
        ...(communicationScore < 65 ? ['Expand responses with more detail and context'] : []),
      ],
    };
  }
}

async function generateRoleplayResponse({ scenario, transcript, customerPersona }) {
  // Format conversation as plain text — avoids Gemini's strict user→model alternation
  // requirement that breaks when the customer (model role) speaks first.
  const conversationLines = transcript
    .map(t => `${t.role === 'customer' ? 'Customer' : 'Consultant'}: ${t.content}`)
    .join('\n');

  const messages = [
    { role: 'system', content: 'You are a customer in a jewelry store roleplay. Output only the customer\'s next spoken line. No labels, no quotes, no explanation.' },
    { role: 'user', content: `You are roleplaying as a ${customerPersona || 'realistic'} customer at CaratLane, India's leading jewelry brand.
Scenario: ${scenario}

Rules:
- Stay fully in character as the customer
- Ask realistic jewelry shopping questions (pricing, quality, certifications, customization)
- Be slightly challenging but fair — push back occasionally on price, ask for justification
- Give SHORT responses (1-3 sentences only)
- React naturally and directly to what the consultant just said

${conversationLines ? `Conversation so far:\n${conversationLines}\n` : ''}
Customer (your next line only, no labels or quotation marks):` },
  ];

  // Try each provider directly — do NOT use callLLM() because it catches all errors
  // and returns a generic mock string, which would bypass the script fallback below.
  const ai = getGenAI();
  if (ai) {
    for (const modelName of GEMINI_MODELS) {
      try {
        return await callGeminiModel(ai, modelName, messages, { temperature: 0.85, max_tokens: 300, disableThinking: true });
      } catch (_) { /* try next model */ }
    }
  }

  const openai = getOpenAI();
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, temperature: 0.85, max_tokens: 300 });
      return resp.choices[0].message.content;
    } catch (_) { /* fall through */ }
  }

  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');
      const resp = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: systemMsg?.content, messages: userMsgs });
      return resp.content[0].text;
    } catch (_) { /* fall through */ }
  }

  // Script fallback — reliable even when no AI provider is available
  const scenarioLower = (scenario || '').toLowerCase();
  // Map scenario descriptions to script keys — scenario text doesn't always contain the key word
  const SCENARIO_KEYWORD_MAP = {
    upgrade:     ['upgrade', '0.5ct', 'solitaire upgrade', 'compares'],
    gifting:     ['gift set', 'corporate', 'employee', 'engraving', 'bulk', 'gifting'],
    engagement:  ['engagement', 'first purchase', 'first time', 'nervous', 'first-time'],
    anniversary: ['anniversary', 'wedding'],
  };
  const scriptKey = Object.keys(SCENARIO_KEYWORD_MAP).find(k =>
    SCENARIO_KEYWORD_MAP[k].some(kw => scenarioLower.includes(kw))
  ) || 'anniversary';
  const lines = ROLEPLAY_SCRIPTS[scriptKey];
  const customerTurns = transcript.filter(t => t.role === 'customer').length;
  logger.warn(`All LLM providers failed — using scripted line for "${scriptKey}", turn ${customerTurns}`);
  return lines[customerTurns % lines.length];
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
  extractTextFromBuffer,
};
