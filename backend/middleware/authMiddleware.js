const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Minimal but crucial security check
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });
    if (!userExists) return res.status(401).json({ error: "Unauthorized" });

    // Only attach necessary user data
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  } finally {
    await prisma.$disconnect();
  }
};
