const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

let openaiClient;
let anthropicClient;

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

async function callLLM(messages, { model = 'gpt-4o-mini', temperature = 0.7, max_tokens = 2000 } = {}) {
  const openai = getOpenAI();
  if (openai) {
    const resp = await openai.chat.completions.create({ model, messages, temperature, max_tokens });
    return resp.choices[0].message.content;
  }

  const anthropic = getAnthropic();
  if (anthropic) {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens,
      system: systemMsg?.content,
      messages: userMsgs,
    });
    return resp.content[0].text;
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
        {
          text: 'Conflict-free diamonds are also known as?',
          type: 'MCQ',
          difficulty: 'EASY',
          options: ['Blood diamonds', 'Kimberley Process diamonds', 'Synthetic diamonds', 'Natural diamonds'],
          correctAnswer: 'Kimberley Process diamonds',
          explanation: 'The Kimberley Process Certification Scheme certifies diamonds as conflict-free.',
          points: 10,
        },
      ],
    });
  }
  if (lastMsg.includes('summary') || lastMsg.includes('summarize')) {
    return 'This content covers key concepts essential for understanding the topic. The material is structured to build foundational knowledge progressively, with practical examples to reinforce learning.';
  }
  return 'Based on the course material, here is a comprehensive response to your question. The key concepts covered include best practices and industry standards relevant to your role.';
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
      productScore: 75,
      confidenceScore: 70,
      communicationScore: 80,
      upsellScore: 65,
      overallScore: 72,
      feedback: 'Good effort! Focus on product knowledge and upselling techniques.',
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

  return callLLM(messages, { temperature: 0.8, max_tokens: 200 });
}

module.exports = {
  generateQuiz,
  generateSummary,
  generateFlashcards,
  answerQuestion,
  generateManagerInsight,
  scoreRoleplay,
  generateRoleplayResponse,
  callLLM,
};
