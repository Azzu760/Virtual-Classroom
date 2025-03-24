const express = require("express");
const router = express.Router();
const classroomController = require("../controllers/classroomController");

// GET /api/classrooms - Fetch all classrooms
router.get("/", classroomController.getClassrooms);

// GET /api/classrooms/:id - Fetch a specific classroom by ID
router.get("/:id", classroomController.getClassroomById);

// GET /api/classrooms/:id/announcements - Fetch announcements for a classroom
router.get("/:id/announcements", classroomController.getClassroomAnnouncements);

// GET /api/classrooms/:id/assignments - Fetch assignments for a classroom
router.get("/:id/assignments", classroomController.getClassroomAssignments);

// GET /api/classrooms/teacher/:teacherId - Fetch classrooms by teacher ID
router.get("/teacher/:teacherId", classroomController.getClassroomsByTeacherId);

// GET /api/classrooms/enrolled/:userId - Fetch enrolled classes by user ID
router.get(
  "/enrolled/:userId",
  classroomController.getEnrolledClassroomByUserId
);

// GET /api/classrooms/:id/students - Fetch students enrolled in a classroom
router.get("/:id/students", classroomController.getStudentsByClassroomId);

// POST /api/classrooms - Create a new classroom
router.post("/", classroomController.createClassroom);

// POST /api/classrooms/:id/announcements - Create a new announcement
router.post("/:id/announcements", classroomController.createAnnouncement);

// POST /api/classrooms/:id/assignments - Create a new assignment
router.post("/:id/assignments", classroomController.createAssignment);

// POST /api/assignments/:id/grades - Assign a grade to a student
router.post("/assignments/:id/grades", classroomController.assignGrade);

// POST /api/classrooms/join - Join a classroom using a code
router.post("/join", classroomController.joinClassroom);

// PATCH /api/classrooms/:id/archive - Archive a classroom
router.patch("/:id/archive", classroomController.archiveClassroom);

module.exports = router;
