require("dotenv").config({ override: true });
const express = require("express");
const cors = require("cors");
const { router: authRouter, publicUser } = require("./routes/auth");
const { router: chatRouter } = require("./routes/chat");
const { requireAuth } = require("./middleware/auth");
const { prisma } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-machine tools (curl/postman send no Origin) and configured origins.
      // "null" covers opening the frontend as a local file:// page.
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS: " + origin));
    },
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`Aura backend listening on http://localhost:${PORT}`);
});
