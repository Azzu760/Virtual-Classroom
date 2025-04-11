const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Fetch all classrooms
const getClassrooms = async (req, res) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      include: {
        teacher: true,
        enrollments: true,
      },
    });

    const formattedClassrooms = classrooms.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      subject: classroom.subject,
      createdAt: classroom.createdAt.toISOString(),
      updatedAt: classroom.updatedAt.toISOString(),
      teacherId: classroom.teacherId,
      status: classroom.status || "active",
      students: classroom.enrollments.length,
    }));

    res.json(formattedClassrooms);
  } catch (error) {
    console.error("Failed to fetch classrooms:", error);
    res.status(500).json({ error: "Failed to fetch classrooms" });
  }
};

// Fetch a specific classroom by ID
const getClassroomById = async (req, res) => {
  const { id } = req.params;

  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        teacher: true,
        enrollments: true,
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }

    // Format the classroom object to include subject and teacher name
    const formattedClassroom = {
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      subject: classroom.subject,
      description: classroom.description,
      createdAt: classroom.createdAt.toISOString(),
      updatedAt: classroom.updatedAt.toISOString(),
      teacherId: classroom.teacherId,
      teacherName: classroom.teacher.name,
      status: classroom.status || "active",
      students: classroom.enrollments.length,
    };

    res.json(formattedClassroom);
  } catch (error) {
    console.error("Failed to fetch classroom:", error);
    res.status(500).json({ error: "Failed to fetch classroom" });
  }
};

// Fetch announcements for a classroom
const getClassroomAnnouncements = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    console.error("Classroom ID is missing");
    return res.status(400).json({ error: "Classroom ID is required" });
  }

  try {
    const announcements = await prisma.announcement.findMany({
      where: { classroomId: id },
      include: {
        user: true,
      },
    });

    const formattedAnnouncements = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      datePosted: announcement.datePosted.toISOString(),
      classroomId: announcement.classroomId,
      userId: announcement.userId,
      user: announcement.user,
    }));

    res.json(formattedAnnouncements);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
};

// Fetch classrooms created by a specific teacher
const getClassroomsByTeacherId = async (req, res) => {
  const { teacherId } = req.params;

  try {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId },
    });

    const formattedClassrooms = classrooms.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      description: classroom.description,
      createdAt: classroom.createdAt.toISOString(),
      updatedAt: classroom.updatedAt.toISOString(),
      teacherId: classroom.teacherId,
      status: classroom.status || "active",
    }));

    res.json(formattedClassrooms);
  } catch (error) {
    console.error("Failed to fetch classrooms by teacher:", error);
    res.status(500).json({ error: "Failed to fetch classrooms by teacher" });
  }
};

// Fetch students enrolled in a classroom
const getStudentsByClassroomId = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the classroom details including the teacher
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({
        success: false,
        error: "Classroom not found",
      });
    }

    // Extract teacher details
    const teacher = {
      id: classroom.teacher.id,
      name: classroom.teacher.name,
      email: classroom.teacher.email,
    };

    // Extract student details from enrollments
    const students = classroom.enrollments.map((enrollment) => ({
      id: enrollment.user.id,
      name: enrollment.user.name,
      email: enrollment.user.email,
    }));

    // Return the response with success: true, teacher, and students
    res.status(200).json({
      success: true,
      data: {
        teacher,
        students,
      },
    });
  } catch (error) {
    console.error("Failed to fetch students:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch students",
    });
  }
};
// Create a new classroom
const createClassroom = async (req, res) => {
  const { name, code, subject, teacherId } = req.body;

  try {
    const newClassroom = await prisma.classroom.create({
      data: {
        name,
        code,
        subject,
        teacherId,
        status: "active",
      },
    });

    res.status(201).json(newClassroom);
  } catch (error) {
    console.error("Failed to create classroom:", error);
    res.status(500).json({ error: "Failed to create classroom" });
  }
};

// Create a new announcement
const createAnnouncement = async (req, res) => {
  const { classroomId, title, content, userId } = req.body;

  try {
    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        content,
        classroomId,
        userId,
      },
    });

    res.status(201).json(newAnnouncement);
  } catch (error) {
    console.error("Failed to create announcement:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
};

// Join a classroom using a code
const joinClassroom = async (req, res) => {
  const { code, userId } = req.body;

  try {
    // Find the classroom by code
    const classroom = await prisma.classroom.findUnique({
      where: { code },
    });

    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }

    // Check if the user is already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        classroomId: classroom.id,
        userId,
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: "User is already enrolled" });
    }

    // Enroll the user in the classroom
    await prisma.enrollment.create({
      data: {
        classroomId: classroom.id,
        userId,
      },
    });

    res.status(201).json(classroom); // Return the classroom data
  } catch (error) {
    console.error("Failed to join classroom:", error);
    res.status(500).json({ error: "Failed to join classroom" });
  }
};

// Archive or unarchive a classroom
const archiveClassroom = async (req, res) => {
  const { id } = req.params;
  const { userId, userRole } = req.body;

  try {
    // Find the classroom
    const classroom = await prisma.classroom.findUnique({
      where: { id },
    });

    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }

    // Check if the user is the teacher or a student
    if (userRole === "teacher" && classroom.teacherId !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to archive this classroom" });
    }

    if (userRole === "student") {
      // Check if the student is enrolled in the classroom
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          classroomId: id,
          userId,
        },
      });

      if (!enrollment) {
        return res
          .status(403)
          .json({ error: "Unauthorized to archive this classroom" });
      }
    }

    // Toggle the status
    const updatedClassroom = await prisma.classroom.update({
      where: { id },
      data: {
        status: classroom.status === "active" ? "archived" : "active",
      },
    });

    res.status(200).json(updatedClassroom);
  } catch (error) {
    console.error("Failed to archive classroom:", error);
    res.status(500).json({ error: "Failed to archive classroom" });
  }
};

// Fetch classrooms where the user is enrolled
const getEnrolledClassroomByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    // Find all enrollments for the user
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId,
      },
      include: {
        classroom: {
          include: {
            teacher: {
              select: {
                name: true,
              },
            },
            enrollments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Transform the data
    const classrooms = enrollments.map((enrollment) => ({
      id: enrollment.classroom.id,
      name: enrollment.classroom.name,
      code: enrollment.classroom.code,
      subject: enrollment.classroom.subject,
      status: enrollment.classroom.status || "active",
      createdAt: enrollment.classroom.createdAt.toISOString(),
      updatedAt: enrollment.classroom.updatedAt.toISOString(),
      teacherId: enrollment.classroom.teacherId,
      teacherName: enrollment.classroom.teacher.name,
      students: enrollment.classroom.enrollments.length,
    }));

    // Return the classrooms as a JSON response
    res.status(200).json({
      success: true,
      message: "Enrolled classrooms fetched successfully",
      data: classrooms,
    });
  } catch (error) {
    console.error("Failed to fetch enrolled classrooms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled classrooms",
      error: error.message || "Internal server error",
    });
  }
};

const getUpcomingDeadlineAssignments = async (req, res) => {
  const { classroomId } = req.params;
  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        classroomId: classroomId,
        dueDate: {
          gte: new Date(),
        },
      },
      select: {
        title: true,
        dueDate: true,
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    console.error("Error fetching upcoming deadline assignments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming assignments",
      error: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
};

const getUpcomingAssignmentsByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    // First check if user is a teacher
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let assignments;

    if (user.role === "teacher") {
      // Get assignments created by the teacher
      assignments = await prisma.assignment.findMany({
        where: { userId },
        select: {
          title: true,
          dueDate: true,
          classroom: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      });
    } else {
      // Get assignments from classrooms where student is enrolled
      assignments = await prisma.assignment.findMany({
        where: {
          classroom: {
            enrollments: {
              some: {
                userId,
              },
            },
          },
        },
        select: {
          title: true,
          dueDate: true,
          classroom: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      });
    }

    // Transform the data to match the requested format
    const formattedAssignments = assignments.map((assignment) => ({
      classroomName: assignment.classroom.name,
      assignmentTitle: assignment.title,
      dueDate: assignment.dueDate,
    }));

    res.status(200).json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assignments",
      error: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  getClassrooms,
  getClassroomById,
  getClassroomAnnouncements,
  getClassroomsByTeacherId,
  getEnrolledClassroomByUserId,
  getStudentsByClassroomId,
  createClassroom,
  createAnnouncement,
  joinClassroom,
  archiveClassroom,
  getUpcomingDeadlineAssignments,
  getUpcomingAssignmentsByUserId,
};
