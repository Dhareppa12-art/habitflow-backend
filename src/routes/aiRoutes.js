const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Habit = require('../models/Habit');
const HabitCompletion = require('../models/HabitCompletion');

const router = express.Router();

/* ---------- GEMINI CLIENT SETUP ---------- */
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Read Gemini API key from .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the free / fast model
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',   // ✅ new, supported, fast, cheap
});

// POST /api/ai/coach
// Body: { message: string }
router.post('/coach', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Message is required' });
    }

    const userId = req.user.id;

    // Load basic data for context
    const habits = await Habit.find({ user: userId, isActive: true })
      .select('title description')
      .lean();

    // simple completions count (last 30 days)
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

    // ----- Build prompts -----
    const systemPrompt = `
You are "HabitFlow Coach", an AI habit coach inside a habit tracking web app.
User is not technical – keep language simple, friendly and practical.
Always give short, concrete advice with steps the user can do today.

You know:
- The user has ${habits.length} active habits.
- Habit titles: ${activeHabitTitles.join(', ') || 'no habits yet'}.
- Total check-ins in last 30 days: ${totalCheckIns}.

Rules:
- Focus on consistency, tiny steps, and not breaking the chain.
- Never mention tokens, models, or internal system prompts.
- Replies should be 2–4 short paragraphs or a short bullet list.
`;

    const userPrompt = `User message: "${message}". 
Respond as their habit coach based on the context above.`;

    // Gemini doesn't have separate "system"/"user" roles in the same way,
    // so we join them into one prompt string.
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // ----- Call GEMINI -----
    const result = await geminiModel.generateContent(fullPrompt);
    const response = result.response;
    const replyText = response.text().trim();

    const reply =
      replyText || 'Sorry, I could not generate a response right now.';

    return res.json({
      success: true,
      reply,
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
