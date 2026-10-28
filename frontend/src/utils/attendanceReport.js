import { formatClassTimeRange } from "./classTime";

// Loads a script once (jsPDF is only needed when a parent downloads a report)
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

// Builds and downloads the parent's attendance report PDF for one tuition
export async function downloadAttendanceReport(card, logs) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // 1. Saraswati Tutorials Branding
  doc.setFillColor(30, 41, 59); // dark slate-800 background for top header banner
  doc.rect(0, 0, 210, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("SARASWATI TUTORIALS", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text("Verified Home Tuitions & Academic Excellence", 14, 25);

  // Print Date
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Report Generated: ${new Date().toLocaleString()}`, 155, 25);

  // 2. Student & Teacher Details Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("STUDENT & TUITION DETAILS", 14, 42);

  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 45, 196, 45);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Student Name:", 14, 52);
  doc.text("Teacher Name:", 14, 58);
  doc.text("Current Cycle:", 14, 64);
  doc.text("Requirement ID:", 110, 52);
  doc.text("Class Schedule:", 110, 58);
  doc.text("Cycle Dates:", 110, 64);

  // Date ranges use an en dash, which the PDF font may lack
  const cycleDates = (card.cycleDateRange || "Active").replace(" – ", " - ");

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(card.studentName, 42, 52);
  doc.text(card.tutorName, 42, 58);
  doc.text(card.currentMonthLabel || `Month ${card.currentPackageCycle || 1}`, 42, 64);
  doc.text(card.requirementId, 138, 52);
  doc.text(card.classSchedule, 138, 58);
  doc.text(cycleDates, 138, 64);

  // 3. Attendance Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 70, 182, 22, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("TOTAL CLASSES", 18, 76);
  doc.text("COMPLETED (DONE)", 62, 76);
  doc.text("MISSED CLASSES", 112, 76);
  doc.text("REMAINING", 158, 76);

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(String(card.totalClasses), 18, 84);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(String(card.completedClasses), 62, 84);
  doc.setTextColor(239, 68, 68); // rose-600
  doc.text(String(card.missedClasses), 112, 84);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(String(card.remainingClasses), 158, 84);

  // 4. Date-wise Attendance Timeline Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text("DATE-WISE CLASS HISTORY LOG", 14, 102);
  doc.line(14, 105, 196, 105);

  // 5. Build Class Log Table
  const tableBody = logs.map((log, index) => {
    const classNumber = logs.length - index;
    const details = log.status === "Done"
      ? `Topics: ${log.topicsCovered}`
      : `Reason: ${log.missedReason === "Other" ? log.customReason : log.missedReason}`;

    // Class time goes under the date (plain hyphen: PDF fonts may lack the en dash)
    const classTime = formatClassTimeRange(log.classStartTime, log.classEndTime).replace(" – ", " - ");
    return [
      `Class ${classNumber} (M${log.packageCycle || 1})`,
      classTime ? `${log.date}\n${classTime}` : log.date,
      log.status === "Done" ? "Done" : "Missed",
      details,
      log.tutorName,
    ];
  });

  doc.autoTable({
    startY: 108,
    head: [["Session", "Date", "Status", "Topics Covered / Missed Reason", "Teacher"]],
    body: tableBody,
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      2: { cellWidth: 20 },
      3: { cellWidth: 84 },
      4: { cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(table) {
      // Color code Status column (column index 2)
      if (table.section === "body" && table.column.index === 2) {
        table.cell.styles.textColor = table.cell.raw === "Done" ? [16, 185, 129] : [239, 68, 68];
        table.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
    styles: { font: "helvetica", fontSize: 8.5 },
  });

  doc.save(`Saraswati_Attendance_${card.studentName.replace(/\s+/g, "_")}.pdf`);
}
