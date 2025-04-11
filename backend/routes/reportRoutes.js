const express = require("express");
const { generateReport } = require("../controllers/reportController");
const router = express.Router();

router.get("/:classroomId", generateReport);

module.exports = router;
