// src/routes/aiRoutes.js

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Habit = require('../models/Habit');
const HabitCompletion = require('../models/HabitCompletion');

const router = express.Router();

/* ---------- GEMINI CLIENT SETUP ---------- */
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY is not set. AI Coach will not work.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
});

// POST /api/ai/coach
// Body: { message: string }
router.post('/coach', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const userId = req.user.id;

    /* ===== Load habit context from DB ===== */
    const habits = await Habit.find({ user: userId, isActive: true })
      .select('title description')
      .lean();

    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 30);

    const completions = await HabitCompletion.find({
      user: userId,
      date: { $gte: from, $lte: today },
    }).lean();

    const totalCheckIns = completions.reduce(
      (sum, c) => sum + (c.count || 0),
      0
    );

    const activeHabitTitles = habits.map((h) => h.title);

    /* ===== System prompt: normal chat + habit-aware coach ===== */
    const systemPrompt = `
You are "HabitFlow Coach", a friendly AI coach inside a habit tracking app.

YOUR PRIMARY PERSONALITY:
- Warm, supportive, human-like.
- Reply like a normal chat, not robotic.
- Always short, simple, and easy to read.
- 2–5 short sentences max.

WHAT YOU CAN TALK ABOUT:
- Habits, routines, motivation, productivity, goals, wellness.
- Normal life questions like: work, studies, stress, confidence, relationships, emotions.
- Fun or random questions (jokes, movies, general facts).
- Light emotional support if user feels low.

HABIT CONTEXT YOU KNOW:
- Number of active habits: ${habits.length}
- Habit titles: ${activeHabitTitles.join(', ') || 'no habits yet'}
- Total check-ins in last 30 days: ${totalCheckIns}
Use this information only when it actually helps the answer.

GENERAL BEHAVIOR RULES:
1. FIRST: Answer the user's question directly and naturally.
2. SECOND: Ask ONE gentle follow-up related to:
   - their habits,
   - their wellbeing, or
   - how their day is going.
   Choose what fits best. Keep it natural, not forced.
3. Do NOT over-focus on habits. If their question is not habit-related, habits are optional.
4. Avoid repeating the same phrases every reply.
5. Never introduce yourself repeatedly. Do not say "I am HabitFlow Coach" or "I am an AI language model" every time.

STYLE:
- No markdown (**bold**, bullet lists, numbered lists).
- No long paragraphs.
- No emojis unless the user uses them first.
- Friendly, conversational tone.

SAFETY RULES:
- If the user asks about self-harm, suicide, severe depression or medical treatment:
  - Be kind and supportive.
  - Say you are not a professional.
  - Encourage them to reach out to a trusted person or local professional/helpline.
  - Do NOT give instructions for self-harm or dangerous behaviour.

SPECIAL CASES:
- Greetings like "hi", "hello", "hey":
  - Short friendly greeting + one simple question about their day or habits.
- Random/off-topic questions:
  - Answer normally.
  - Optional small follow-up like "How’s your day going?" or
    "Anything you want to improve or get help with today?"
- If user asks for a joke:
  - Give one short, clean joke.
  - Optional light follow-up question.
`;

    const userPrompt = `
User message: "${message}"

Respond in ONE short answer following the rules above.
Keep it human, helpful, and easy to read.
`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    /* ===== Call Gemini ===== */
    const result = await geminiModel.generateContent(fullPrompt);
    const replyText = result?.response?.text?.() || '';

    return res.json({
      success: true,
      reply: replyText.trim() || 'Sorry, I’m here but I couldn’t think of a good answer right now.',
    });
  } catch (err) {
    console.error('AI COACH ERROR (Gemini)', err);
    return res.status(500).json({
      success: false,
      message: 'AI Coach is temporarily unavailable',
    });
  }
});

module.exports = router;
