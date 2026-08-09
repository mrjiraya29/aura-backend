const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../db");

const router = express.Router();

const VALID_GENDERS = ["female", "male", "other"];

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, gender: user.gender };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, gender } = req.body || {};
    if (!name || !email || !password || !gender) {
      return res.status(400).json({ error: "Name, email, password, and gender are all required." });
    }
    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: "Gender must be female, male, or other." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash, gender },
    });

    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: "Email or password not recognized." });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Email or password not recognized." });
    }
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

module.exports = { router, publicUser };
