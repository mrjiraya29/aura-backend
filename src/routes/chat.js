const express = require("express");
const { prisma } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { askGemini } = require("../gemini");

const router = express.Router();

const HISTORY_TURNS = 12;

function personaFor(user) {
  return `You are Aura, a warm, concise voice-first AI companion speaking with ${user.name}. ` +
    `Your replies are read aloud by text-to-speech, so write the way a thoughtful person would actually talk: ` +
    `natural sentences, no markdown, no bullet points, no asterisks, no headers. ` +
    `Keep replies under 60 words unless the user clearly asks for more depth.`;
}

router.get("/history", requireAuth, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json({ messages: messages.map((m) => ({ role: m.role, text: m.text })) });
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message text is required." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const priorMessages = await prisma.message.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
    });
    const history = priorMessages.reverse().map((m) => ({ role: m.role, text: m.text }));

    await prisma.message.create({ data: { userId: req.userId, role: "user", text: message } });

    const reply = await askGemini(personaFor(user), history, message);

    await prisma.message.create({ data: { userId: req.userId, role: "assistant", text: reply } });

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Aura couldn't reach its thoughts just now. Try again in a moment." });
  }
});

module.exports = { router };
