const express = require("express");
const {
  register,
  login,
  googleAuth,
  googleAuthCallback,
  githubAuth,
  githubAuthCallback,
} = require("../controllers/authController");

const router = express.Router();

// Email/password authentication
router.post("/register", register);
router.post("/login", login);

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);

// GitHub OAuth
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback);

module.exports = router;
