const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create new assignment
const createAssignment = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.title || !req.body.classroomId) {
      return res
        .status(400)
        .json({ error: "Title and classroom ID are required" });
    }

    const assignmentData = {
      title: req.body.title.trim(),
      description: req.body.description?.trim(),
      dueDate: new Date(req.body.dueDate),
      classroomId: req.body.classroomId,
      userId: req.user.userId,
      status: "published",
    };

    // Only add file fields if file exists
    if (req.file) {
      assignmentData.fileData = req.file.buffer;
      assignmentData.fileName = req.file.originalname;
      assignmentData.fileType = req.file.mimetype;
      assignmentData.fileSize = req.file.size;
    }

    const assignment = await prisma.assignment.create({
      data: assignmentData,
      select: {
        id: true,
        title: true,
        dueDate: true,
        fileName: true,
        description: true,
        status: true,
      },
    });

    return res.status(201).json(assignment);
  } catch (error) {
    console.error("Assignment creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
// Get all assignments for a classroom
const getClassroomAssignments = async (req, res) => {
  const { id } = req.params;

  try {
    const assignments = await prisma.assignment.findMany({
      where: { classroomId: id },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        classroom: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate.toISOString(),
      status: assignment.status,
      fileName: assignment.fileName,
      fileType: assignment.fileType,
      fileSize: assignment.fileSize,
      createdAt: assignment.createdAt.toISOString(),
      classroom: {
        name: assignment.classroom.name,
      },
    }));

    res.json(formattedAssignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
};

// Get all the submissions for the specific assignment
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { id: assignmentId } = req.params;

    // Get submissions and count in parallel
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: { assignmentId },
        select: {
          id: true,
          status: true, // Include status field
          submittedAt: true,
          gradedAt: true,
          grade: true,
          feedback: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.submission.count({ where: { assignmentId } }),
    ]);

    res.json({
      total,
      submissions: submissions.map((s) => ({
        ...s,
        status: s.status, // Explicitly include status
        submittedAt: s.submittedAt.toISOString(),
        gradedAt: s.gradedAt?.toISOString() || null,
        fileInfo: {
          name: s.fileName,
          type: s.fileType,
          size: s.fileSize,
        },
      })),
    });
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    res.status(error.code === "P2023" ? 400 : 500).json({
      error:
        error.code === "P2023"
          ? "Invalid assignment ID"
          : "Failed to fetch submissions",
    });
  }
};

// Submit assignment with file stored in BYTEA
const submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.body.userId;
    const file = req.file;

    // Validate required fields
    if (!assignmentId || !userId || !file) {
      return res.status(400).json({
        error: "Missing required fields",
        received: { assignmentId, userId, fileExists: !!file },
      });
    }

    // Check if assignment exists and is still active
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { dueDate: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Determine if submission is late
    const isLate =
      assignment.dueDate && new Date() > new Date(assignment.dueDate);
    const status = isLate ? "LATE" : "SUBMITTED";

    // Check for existing submission
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        assignmentId,
        userId,
      },
    });

    if (existingSubmission) {
      return res.status(409).json({
        error: "You have already submitted this assignment",
        submissionId: existingSubmission.id,
      });
    }

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        userId,
        fileData: file.buffer,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        status,
        submittedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
          },
        },
      },
    });

    return res.status(201).json({
      ...submission,
      message: isLate
        ? "Assignment submitted successfully (late submission)"
        : "Assignment submitted successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Download assignment file
const downloadAssignmentFile = async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      select: { fileData: true, fileName: true, fileType: true },
    });

    if (!assignment?.fileData) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileBuffer = Buffer.isBuffer(assignment.fileData)
      ? assignment.fileData
      : Buffer.from(assignment.fileData.data || assignment.fileData);

    res.setHeader(
      "Content-Type",
      assignment.fileType || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${assignment.fileName || "assignment"}"`
    );
    return res.send(fileBuffer);
  } catch (error) {
    return res.status(500).json({ error: "Download failed" });
  }
};

// Download submission file
const downloadSubmissionFile = async (req, res) => {
  const { submissionId } = req.params;

  try {
    const { fileData, fileName, fileType, fileSize } =
      await prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
          fileData: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
        },
      });

    if (!fileData) return res.status(404).json({ error: "File not found" });

    res.setHeader("Content-Type", fileType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName || `submission-${submissionId}`}"`
    );
    if (fileSize) res.setHeader("Content-Length", fileSize);

    return res.send(
      Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
    );
  } catch (error) {
    return res.status(500).json({ error: "Download failed" });
  }
};

const gradeSubmission = async (req, res) => {
  const { submissionId } = req.params;
  const { score, feedback } = req.body;

  if (typeof score !== "number" || score < 0 || score > 100) {
    return res.status(400).json({ error: "Invalid score (0-100 required)" });
  }

  try {
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        grade: score,
        feedback: feedback || null,
        gradedAt: new Date(),
        status: "GRADED",
      },
      select: {
        id: true,
        grade: true,
        feedback: true,
      },
    });

    return res.json(submission);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Submission not found" });
    }
    console.error("Grade submission error:", error);
    return res.status(500).json({ error: "Failed to grade submission" });
  }
};

const getStudentAssignments = async (req, res) => {
  const { classroomId, userId } = req.params;

  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        classroomId: classroomId,
        status: "published",
      },
      include: {
        classroom: {
          select: {
            name: true,
          },
        },
        submissions: {
          where: {
            userId: userId,
          },
          select: {
            id: true,
            submittedAt: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
            grade: true,
            feedback: true,
          },
          take: 1,
        },
        grades: {
          where: {
            userId: userId,
          },
          select: {
            id: true,
            score: true,
            feedback: true,
          },
          take: 1,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    const formattedAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate.toISOString(),
      status: assignment.status,
      fileInfo: {
        name: assignment.fileName,
        type: assignment.fileType,
        size: assignment.fileSize,
      },
      createdAt: assignment.createdAt.toISOString(),
      classroom: {
        name: assignment.classroom.name,
      },
      submission: assignment.submissions[0]
        ? {
            id: assignment.submissions[0].id,
            submittedAt: assignment.submissions[0].submittedAt?.toISOString(),
            fileInfo: {
              name: assignment.submissions[0].fileName,
              type: assignment.submissions[0].fileType,
              size: assignment.submissions[0].fileSize,
            },
            status: assignment.submissions[0].status,
            grade: assignment.submissions[0].grade,
            feedback: assignment.submissions[0].feedback,
          }
        : null,
      grade: assignment.grades[0]
        ? {
            id: assignment.grades[0].id,
            score: assignment.grades[0].score,
            feedback: assignment.grades[0].feedback,
          }
        : null,
      isSubmitted: !!assignment.submissions[0],
      isGraded:
        assignment.submissions[0]?.status === "GRADED" ||
        !!assignment.grades[0],
    }));

    res.json(formattedAssignments);
  } catch (error) {
    console.error("Failed to fetch student assignments:", error);
    res.status(500).json({ error: "Failed to fetch student assignments" });
  }
};

module.exports = {
  createAssignment,
  getClassroomAssignments,
  getStudentAssignments,
  submitAssignment,
  downloadAssignmentFile,
  getAssignmentSubmissions,
  downloadSubmissionFile,
  gradeSubmission,
};
