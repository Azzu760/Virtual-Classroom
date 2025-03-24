const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");
const querystring = require("querystring");
const { z } = require("zod");

// Register a new user
const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  role: z.enum(["student", "teacher", "parent"]),
});

exports.register = async (req, res) => {
  try {
    // Validate the request body using Zod
    const validationResult = registerSchema.safeParse(req.body);

    // If validation fails, return the error
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.errors[0].message,
      });
    }

    const { name, email, password, role } = validationResult.data;

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user in the database
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
    });

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: "User registered successfully",
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
    res.status(500).json({ success: false, error: "Registration failed" });
  }
};

// Login with email and password
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

exports.login = async (req, res) => {
  try {
    // Validate the request body using Zod
    const validationResult = loginSchema.safeParse(req.body);

    // If validation fails, return the error
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.errors[0].message,
      });
    }

    const { email, password } = validationResult.data;

    // Find the user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Compare the provided password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" }
    );

    // Return success response
    res.status(200).json({
      success: true,
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
    res.status(500).json({ success: false, error: "Login failed" });
  }
};

// Redirect to Google OAuth page
exports.googleAuth = (req, res) => {
  try {
    const params = querystring.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "profile email",
      access_type: "offline",
      prompt: "consent", // Ensures user is always asked for permission
    });

    const googleAuthURL = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.redirect(googleAuthURL);
  } catch (error) {
    console.error("Google OAuth redirect error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to initiate Google OAuth" });
  }
};

// Handle Google OAuth callback
exports.googleAuthCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Authorization code missing" });
  }

  try {
    // Exchange the authorization code for access & refresh tokens
    const tokenResponse = await axios.request({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });

    const { access_token } = tokenResponse.data;

    // Fetch user profile data from Google
    const { data: userData } = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // Check if user exists in the database
    let user = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          role: "student",
          password: await bcrypt.hash(
            crypto.randomBytes(32).toString("hex"),
            10 // Secure hashed random password
          ),
        },
      });
    }

    // Generate a JWT token for authentication
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" }
    );

    // Redirect user to frontend with JWT token
    res.redirect(`http://localhost:3000?token=${token}`);
  } catch (error) {
    console.error(
      "Google OAuth callback error:",
      error.response?.data || error
    );
    res
      .status(500)
      .json({ success: false, error: "Google authentication failed" });
  }
};

// Redirect to GitHub OAuth page
exports.githubAuth = (req, res) => {
  try {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=user:email`;
    res.redirect(githubAuthUrl);
  } catch (error) {
    console.error("GitHub OAuth redirect error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to initiate GitHub OAuth" });
  }
};

// Handle GitHub OAuth callback
exports.githubAuthCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Authorization code missing" });
  }

  try {
    // Exchange the code for an access token
    const { data } = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    // Fetch user data from GitHub
    const { data: userData } = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    // Fetch user's email (GitHub API requires an additional request)
    const { data: emails } = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: { Authorization: `Bearer ${data.access_token}` },
      }
    );

    // Find the primary email (GitHub sometimes hides emails)
    const primaryEmail = emails.find(
      (email) => email.primary && email.verified
    )?.email;

    if (!primaryEmail) {
      return res.status(400).json({
        success: false,
        error: "Email not found. Please ensure your GitHub email is public.",
      });
    }

    // Check if the user already exists in the database
    let user = await prisma.user.findUnique({
      where: { email: primaryEmail },
    });

    if (!user) {
      // Create a new user if they don't exist
      user = await prisma.user.create({
        data: {
          name: userData.name || userData.login, // Use GitHub username if name is not available
          email: primaryEmail,
          role: "student", // Default role
          password: await bcrypt.hash(
            crypto.randomBytes(32).toString("hex"),
            10
          ), // Secure hashed random password
        },
      });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      {
        expiresIn: "1h",
      }
    );

    // Redirect the user back to the frontend with the token
    res.redirect(`http://localhost:3000?token=${token}`);
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    res
      .status(500)
      .json({ success: false, error: "GitHub authentication failed" });
  }
};
