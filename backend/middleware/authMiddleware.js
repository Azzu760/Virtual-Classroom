const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // Get token from header
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded; // Attach user data to request object
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({ error: "Invalid token" });
  }
};
