const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const validateAssignment = require("../middleware/validateAssignment");
const authMiddleware = require("../middleware/authenticateAssignment");
const upload = require("../middleware/upload");

// Assignment routes
router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  validateAssignment,
  assignmentController.createAssignment
);

router.post(
  "/:id/submissions",
  upload.single("file"),
  assignmentController.submitAssignment
);

router.get("/:id/assignments", assignmentController.getClassroomAssignments);

router.get("/:id/file", assignmentController.downloadAssignmentFile);

// Submission routes
router.get(
  "/:submissionId/file/download",
  assignmentController.downloadSubmissionFile
);

router.get(
  "/:classroomId/students/:userId/assignments",
  assignmentController.getStudentAssignments
);

router.put("/:submissionId/grade", assignmentController.gradeSubmission);

router.get("/:id/submissions", assignmentController.getAssignmentSubmissions);

module.exports = router;
