const express = require("express");
const router = express.Router();
const classroomController = require("../controllers/classroomController");

router.get("/", classroomController.getClassrooms);

router.get("/:id", classroomController.getClassroomById);

router.get("/:id/announcements", classroomController.getClassroomAnnouncements);

router.get("/teacher/:teacherId", classroomController.getClassroomsByTeacherId);

router.get(
  "/enrolled/:userId",
  classroomController.getEnrolledClassroomByUserId
);

router.get("/:id/students", classroomController.getStudentsByClassroomId);

router.post("/", classroomController.createClassroom);

router.post("/:id/announcements", classroomController.createAnnouncement);

router.post("/join", classroomController.joinClassroom);

router.patch("/:id/archive", classroomController.archiveClassroom);

router.get(
  "/:classroomId/upcoming-assignments",
  classroomController.getUpcomingDeadlineAssignments
);

router.get(
  "/:userId/deadline-assignments",
  classroomController.getUpcomingAssignmentsByUserId
);

module.exports = router;
