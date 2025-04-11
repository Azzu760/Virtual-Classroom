const validateAssignment = (req, res, next) => {
  const { title, dueDate, classroomId } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  if (!dueDate || isNaN(new Date(dueDate))) {
    return res.status(400).json({ error: "Valid due date is required" });
  }

  if (!classroomId) {
    return res.status(400).json({ error: "Classroom ID is required" });
  }

  next();
};

module.exports = validateAssignment;
