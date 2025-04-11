const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const validateRequest = (req, requiredFields = []) => {
  for (const field of requiredFields) {
    if (!req.body[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

const handlePrismaError = (res, error) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Internal server error" });
};

exports.getMaterials = async (req, res) => {
  try {
    const { classroomId } = req.query;
    if (!classroomId) throw new Error("Classroom ID required");

    const materials = await prisma.material.findMany({
      where: { classroomId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        url: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
      },
    });

    res.json(materials);
  } catch (error) {
    handlePrismaError(res, error);
  } finally {
    await prisma.$disconnect();
  }
};

exports.createMaterial = async (req, res) => {
  try {
    validateRequest(req, ["title", "type", "classroomId", "userId"]);

    const materialData = {
      title: req.body.title,
      type: req.body.type,
      classroomId: req.body.classroomId,
      userId: req.body.userId,
      ...(req.body.description && { description: req.body.description }),
    };

    if (req.body.type === "link") {
      if (!req.body.url) throw new Error("URL is required for link type");
      materialData.url = req.body.url;
    } else if (req.body.type === "file") {
      if (!req.file) throw new Error("File is required for file type");
      materialData.fileName = req.file.originalname;
      materialData.fileType = req.file.mimetype;
      materialData.fileSize = req.file.size;
      materialData.fileData = req.file.buffer;
    }

    const material = await prisma.material.create({ data: materialData });

    res.status(201).json({
      id: material.id,
      title: material.title,
      type: material.type,
      createdAt: material.createdAt,
    });
  } catch (error) {
    handlePrismaError(res, error);
  } finally {
    await prisma.$disconnect();
  }
};

exports.downloadMaterial = async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      select: { fileData: true, fileName: true, fileType: true },
    });

    if (!material?.fileData) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileBuffer = Buffer.isBuffer(material.fileData)
      ? material.fileData
      : Buffer.from(material.fileData?.data || material.fileData);

    res.setHeader(
      "Content-Type",
      material.fileType || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${material.fileName || "material"}"`
    );
    return res.send(fileBuffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Download failed" });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    await prisma.material.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    handlePrismaError(res, error);
  } finally {
    await prisma.$disconnect();
  }
};
