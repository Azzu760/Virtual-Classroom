const express = require("express");
const router = express.Router();
const materialController = require("../controllers/materialController");
const authMiddleware = require("../middleware/authMiddleware");
const uploadMiddleware = require("../middleware/upload");

router.get("/", authMiddleware, materialController.getMaterials);

router.post(
  "/",
  authMiddleware,
  uploadMiddleware.single("file"),
  materialController.createMaterial
);

router.get(
  "/:id/download",
  authMiddleware,
  materialController.downloadMaterial
);

router.delete("/:id", authMiddleware, materialController.deleteMaterial);

module.exports = router;
