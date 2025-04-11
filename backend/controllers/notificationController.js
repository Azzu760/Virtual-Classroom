const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// @desc    Get all notifications for a user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
    }

    // First get all dismissed notification IDs for this user
    const dismissedNotifications = await prisma.dismissedNotification.findMany({
      where: { userId },
      select: { notificationId: true, notificationType: true },
    });

    const dismissedIds = new Set(
      dismissedNotifications.map(
        (dn) => `${dn.notificationType}-${dn.notificationId}`
      )
    );

    // Get all classrooms the user is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { classroomId: true },
    });

    const classroomIds = enrollments.map(
      (enrollment) => enrollment.classroomId
    );

    if (classroomIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        unreadCount: 0,
        notifications: [],
      });
    }

    // Fetch all relevant data in parallel
    const [grades, announcements, assignments, materials] = await Promise.all([
      prisma.submission.findMany({
        where: {
          userId,
          status: "GRADED",
          gradedAt: { not: null },
          NOT: {
            id: {
              in: dismissedNotifications
                .filter((dn) => dn.notificationType === "grade")
                .map((dn) => dn.notificationId),
            },
          },
        },
        select: {
          id: true,
          grade: true,
          feedback: true,
          gradedAt: true,
          assignment: {
            select: {
              title: true,
              classroom: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.announcement.findMany({
        where: {
          classroomId: { in: classroomIds },
          datePosted: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          NOT: {
            id: {
              in: dismissedNotifications
                .filter((dn) => dn.notificationType === "announcement")
                .map((dn) => dn.notificationId),
            },
          },
        },
        select: {
          id: true,
          title: true,
          content: true,
          datePosted: true,
          classroom: {
            select: {
              name: true,
            },
          },
        },
      }),

      prisma.assignment.findMany({
        where: {
          classroomId: { in: classroomIds },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          NOT: {
            id: {
              in: dismissedNotifications
                .filter((dn) => dn.notificationType === "assignment")
                .map((dn) => dn.notificationId),
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          createdAt: true,
          classroom: {
            select: {
              name: true,
            },
          },
        },
      }),

      prisma.material.findMany({
        where: {
          classroomId: { in: classroomIds },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          NOT: {
            id: {
              in: dismissedNotifications
                .filter((dn) => dn.notificationType === "material")
                .map((dn) => dn.notificationId),
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          classroom: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    // Format notifications
    const notifications = [];

    grades.forEach((grade) => {
      const notificationKey = `grade-${grade.id}`;
      if (!dismissedIds.has(notificationKey)) {
        notifications.push({
          type: "grade",
          id: grade.id,
          course: grade.assignment.classroom.name,
          assignment: grade.assignment.title,
          score: grade.grade,
          feedback: grade.feedback,
          timestamp: grade.gradedAt,
          isNew: true,
        });
      }
    });

    announcements.forEach((announcement) => {
      const notificationKey = `announcement-${announcement.id}`;
      if (!dismissedIds.has(notificationKey)) {
        notifications.push({
          type: "announcement",
          id: announcement.id,
          course: announcement.classroom.name,
          title: announcement.title,
          content:
            announcement.content.substring(0, 100) +
            (announcement.content.length > 100 ? "..." : ""),
          timestamp: announcement.datePosted,
          isNew: true,
        });
      }
    });

    assignments.forEach((assignment) => {
      const notificationKey = `assignment-${assignment.id}`;
      if (!dismissedIds.has(notificationKey)) {
        notifications.push({
          type: "assignment",
          id: assignment.id,
          course: assignment.classroom.name,
          title: assignment.title,
          description:
            assignment.description?.substring(0, 100) +
            (assignment.description?.length > 100 ? "..." : ""),
          dueDate: assignment.dueDate,
          timestamp: assignment.createdAt,
          isNew: true,
        });
      }
    });

    materials.forEach((material) => {
      const notificationKey = `material-${material.id}`;
      if (!dismissedIds.has(notificationKey)) {
        notifications.push({
          type: "material",
          id: material.id,
          course: material.classroom.name,
          title: material.title,
          description:
            material.description?.substring(0, 100) +
            (material.description?.length > 100 ? "..." : ""),
          timestamp: material.createdAt,
          isNew: true,
        });
      }
    });

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Mark notifications as read
// @route   POST /api/notifications/read
// @access  Private
const markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.query.userId;
    const { notificationIds, type } = req.body;

    if (
      !userId ||
      !notificationIds ||
      !Array.isArray(notificationIds) ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        error: "userId, notificationIds (array), and type are required",
      });
    }

    // Create records in dismissedNotifications table
    await prisma.$transaction(
      notificationIds.map((notificationId) =>
        prisma.dismissedNotification.upsert({
          where: {
            userId_notificationId_notificationType: {
              userId,
              notificationId,
              notificationType: type,
            },
          },
          create: {
            userId,
            notificationId,
            notificationType: type,
            dismissedAt: new Date(),
          },
          update: {},
        })
      )
    );

    res.status(200).json({
      success: true,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notifications as read",
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationsAsRead,
};
