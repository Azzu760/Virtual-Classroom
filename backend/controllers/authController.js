require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");
const { z } = require("zod");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_REDIRECT_URI = `${process.env.BACKEND_URL}/api/auth/google/callback`;
const GITHUB_REDIRECT_URI = `${process.env.BACKEND_URL}/api/auth/github/callback`;

// Enhanced validation schemas
const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  email: z.string().email("Invalid email format").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Requires at least one uppercase letter")
    .regex(/[a-z]/, "Requires at least one lowercase letter")
    .regex(/\d/, "Requires at least one number")
    .regex(/[\W_]/, "Requires at least one special character"),
  role: z.enum(["student", "teacher", "parent"]),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Unified response handler
const handleResponse = (res, status, success, data, error) => {
  const response = { success, ...data };
  if (error) response.error = error;
  return res.status(status).json(response);
};

exports.register = async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return handleResponse(
        res,
        400,
        false,
        null,
        validation.error.errors[0].message
      );
    }

    const { name, email, password, role } = validation.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return handleResponse(res, 409, false, null, "User already exists");
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        password: await bcrypt.hash(password, 12),
      },
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
      algorithm: "HS256",
    });

    handleResponse(res, 201, true, {
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    handleResponse(res, 500, false, null, "Registration failed");
  }
};

exports.login = async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return handleResponse(
        res,
        400,
        false,
        null,
        validation.error.errors[0].message
      );
    }

    const { email, password } = validation.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return handleResponse(res, 401, false, null, "Invalid credentials");
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
      algorithm: "HS256",
    });

    handleResponse(res, 200, true, {
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    handleResponse(res, 500, false, null, "Login failed");
  }
};

// Google OAuth
exports.googleAuth = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "profile email",
    access_type: "offline",
    prompt: "consent",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

exports.googleAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error("Missing authorization code");

    const { data: tokens } = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }
    );

    const { data: profile } = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          role: "student",
          password: await bcrypt.hash(
            crypto.randomBytes(32).toString("hex"),
            12
          ),
          provider: "google",
          providerId: profile.id,
        },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
      algorithm: "HS256",
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error("Google OAuth error:", error.response?.data || error);
    res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
  }
};

// GitHub OAuth
exports.githubAuth = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "user:email",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

exports.githubAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error("Missing authorization code");

    const { data: tokens } = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
      },
      { headers: { Accept: "application/json" } }
    );

    const { data: profile } = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const { data: emails } = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    const primaryEmail = emails.find((e) => e.primary && e.verified)?.email;
    if (!primaryEmail) throw new Error("No verified email found");

    let user = await prisma.user.findUnique({ where: { email: primaryEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profile.name || profile.login,
          email: primaryEmail,
          role: "student",
          password: await bcrypt.hash(
            crypto.randomBytes(32).toString("hex"),
            12
          ),
          provider: "github",
          providerId: profile.id.toString(),
        },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
      algorithm: "HS256",
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error("GitHub OAuth error:", error.response?.data || error);
    res.redirect(`${FRONTEND_URL}/login?error=github_auth_failed`);
  }
};
