const express = require("express");
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  googleAuthCallback,
  githubAuth,
  githubAuthCallback,
} = require("../controllers/authController");

// Validation middleware
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.errors[0].message,
    });
  }
};

// Routes
router.post("/register", register);
router.post("/login", login);
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback);

module.exports = router;
