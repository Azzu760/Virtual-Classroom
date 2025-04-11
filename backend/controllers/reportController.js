const { PrismaClient } = require("@prisma/client");
const ExcelJS = require("exceljs");
const prisma = new PrismaClient();

async function getClassroomGradesData(classroomId) {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: {
      assignments: {
        include: {
          submissions: {
            include: {
              user: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!classroom) throw new Error("Classroom not found");

  return {
    students: classroom.enrollments.map((e) => e.user),
    assignments: classroom.assignments,
    classroomInfo: {
      name: classroom.name,
      code: classroom.code,
      subject: classroom.subject,
    },
  };
}

async function generateClassroomGradesReport(classroomId) {
  const { students, assignments } = await getClassroomGradesData(classroomId);
  const workbook = new ExcelJS.Workbook();

  /*** Worksheet 1: Detailed Grade Report ***/
  const worksheet1 = workbook.addWorksheet("Grade Report");

  worksheet1.columns = [
    { header: "Student Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Assignment Title", key: "assignmentTitle", width: 30 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Submission Date", key: "submissionDate", width: 15 },
    { header: "Submission Status", key: "status", width: 20 },
    { header: "Grade", key: "grade", width: 15 },
  ];

  const headerRow1 = worksheet1.getRow(1);
  headerRow1.font = { bold: true };
  headerRow1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  worksheet1.autoFilter = { from: "A1", to: "G1" };

  const studentTotals = new Map();

  students.forEach((student) => {
    let totalGrade = 0;
    assignments.forEach((assignment) => {
      const submission = assignment.submissions.find(
        (s) => s.user.id === student.id
      );
      const status = submission?.status?.replace(/_/g, " ") || "Not Submitted";
      const grade = submission?.grade ?? 0;
      totalGrade += grade;

      worksheet1.addRow({
        name: student.name,
        email: student.email,
        assignmentTitle: assignment.title,
        dueDate: assignment.dueDate.toLocaleDateString(),
        submissionDate: submission?.submittedAt?.toLocaleDateString() || "N/A",
        status: status,
        grade: grade,
      });
    });
    studentTotals.set(student.id, totalGrade);
  });

  worksheet1.addRow([]); // Empty row
  const totalHeader = worksheet1.addRow(["Student Totals"]);
  totalHeader.font = { bold: true };

  students.forEach((student) => {
    const total = studentTotals.get(student.id) || 0;
    worksheet1.addRow({
      name: student.name,
      email: student.email,
      assignmentTitle: "Total Grade",
      grade: total,
    });
  });

  /*** Worksheet 2: Student Summary Report ***/
  const worksheet2 = workbook.addWorksheet("Student Summary");

  // Define headers dynamically
  const headers = [
    "Student Name",
    "Email",
    ...assignments.map((a) => a.title),
    "Total Grade",
  ];
  worksheet2.addRow(headers).font = { bold: true };

  students.forEach((student) => {
    const grades = assignments.map((assignment) => {
      const submission = assignment.submissions.find(
        (s) => s.user.id === student.id
      );
      return submission?.grade ?? 0; // Replace "N/A" with 0
    });

    const total = studentTotals.get(student.id) || 0;

    worksheet2.addRow([student.name, student.email, ...grades, total]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

const generateReport = async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { format } = req.query;

    const { students, assignments, classroomInfo } =
      await getClassroomGradesData(classroomId);

    if (format === "json") {
      const reportData = students.map((student) => {
        const studentAssignments = assignments.map((assignment) => {
          const submission = assignment.submissions.find(
            (s) => s.user.id === student.id
          );
          return {
            assignmentId: assignment.id,
            title: assignment.title,
            dueDate: assignment.dueDate,
            submissionDate: submission?.submittedAt || null,
            status: submission?.status || "NOT_SUBMITTED",
            grade: submission?.grade ?? 0,
          };
        });

        const totalGrade = studentAssignments.reduce(
          (sum, a) => sum + (a.grade ?? 0),
          0
        );

        return {
          student: {
            id: student.id,
            name: student.name,
            email: student.email,
          },
          assignments: studentAssignments,
          totalGrade,
        };
      });

      return res.json({
        classroom: classroomInfo,
        students: reportData,
      });
    }

    const buffer = await generateClassroomGradesReport(classroomId);

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grade-report-${classroomId}.xlsx"`,
    });

    return res.end(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error generating report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

module.exports = {
  generateReport,
};
