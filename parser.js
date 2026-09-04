const pdfParse = require('pdf-parse');

async function parseBRACGradeSheet(pdfBuffer) {
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  // 1. Dynamic Metadata Extraction
  const idMatch = text.match(/Student\s*ID\s*[:\s]*(\d+)/i);
  const nameMatch = text.match(/Student\s*Name\s*[:\s]*([A-Za-z\s\.]+)|Name\s*[:\s]*([A-Za-z\s\.]+)/i);

  let rawName = "";
  if (nameMatch) {
    rawName = (nameMatch[1] || nameMatch[2] || "").trim();
  }
  const cleanName = rawName.replace(/UNDERGRADUATE\s*PROGRAM/gi, '').trim();

  // CGPA & Credits Extraction
  const cgpaMatches = [...text.matchAll(/CGPA\s*[:\s]*(\d+\.\d+)/gi)];
  const latestCgpa = cgpaMatches.length > 0 ? parseFloat(cgpaMatches[cgpaMatches.length - 1][1]) : 0.00;

  const cumEarnedMatches = [...text.matchAll(/Cumulative[\s\S]*?Credits\s*Earned\s*[:\s]*(\d+\.\d+)/gi)];
  const cumEarned = cumEarnedMatches.length > 0 ? parseFloat(cumEarnedMatches[cumEarnedMatches.length - 1][1]) : 0.00;

  const cumAttemptedMatches = [...text.matchAll(/Cumulative[\s\S]*?Credits\s*Attempted\s*[:\s]*(\d+\.\d+)/gi)];
  const cumAttempted = cumAttemptedMatches.length > 0 ? parseFloat(cumAttemptedMatches[cumAttemptedMatches.length - 1][1]) : cumEarned;

  const semesterHeaderMatches = [...text.matchAll(/Semester\s*[:\s]*([A-Za-z0-9\s]+)/gi)];
  const firstSemester = semesterHeaderMatches.length > 0 ? semesterHeaderMatches[0][1].trim() : "";
  const recentSemester = semesterHeaderMatches.length > 0 ? semesterHeaderMatches[semesterHeaderMatches.length - 1][1].trim() : "";

  const studentInfo = {
    studentId: idMatch ? idMatch[1].trim() : "",
    studentName: cleanName,
    cgpa: latestCgpa,
    cumulativeCreditsEarned: cumEarned,
    cumulativeCreditsAttempted: cumAttempted,
    firstSemester,
    recentSemester
  };

  // 2. Course Parsing (Only parses AFTER the first Semester header to avoid header addresses like Kha 224)
  const parsedCourses = [];
  const completedCodesSet = new Set();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentSemester = "";
  let parsingCourses = false; 
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/Semester\s*:/i.test(line)) {
      parsingCourses = true; // Start scanning courses now
      const parts = line.split(":");
      if (parts.length > 1) {
        currentSemester = parts[1].trim();
      }
      i++;
      continue;
    }

    if (parsingCourses) {
      const codeMatch = line.match(/\b([A-Z]{2,4}\s*\d{3}[A-Z\*]?)\b/i);
      if (codeMatch) {
        const code = codeMatch[1].replace(/\s+/g, '').replace('*', '').toUpperCase();

        let windowText = line;
        for (let w = 1; w <= 5 && (i + w) < lines.length; w++) {
          windowText += " " + lines[i + w];
        }

        const gradeMatch = windowText.match(/\b(A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|F|P)\b/i);
        const decimals = windowText.match(/\b([0-4]\.\d{2})\b/g) || [];

        const grade = gradeMatch ? gradeMatch[1].toUpperCase() : "N/A";
        const gradePoints = decimals.length > 0 ? parseFloat(decimals[decimals.length - 1]) : 0.00;

        let title = "Course Title";
        let cleanTitle = windowText.replace(codeMatch[0], '').trim();
        cleanTitle = cleanTitle.replace(/\b(3\.00|1\.50|1\.00|4\.00|A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|F|P|[0-4]\.\d{2}).*/gi, '').trim();
        cleanTitle = cleanTitle.replace(/Credits Earned|Grade|Points/gi, '').trim();
        if (cleanTitle.length > 2) {
          title = cleanTitle.replace(/\s+/g, ' ');
        }

        if (!parsedCourses.some(c => c.code === code && c.semester === currentSemester)) {
          parsedCourses.push({
            code,
            title,
            credits: 3.00,
            grade,
            gradePoints,
            semester: currentSemester
          });
          completedCodesSet.add(code);
        }
      }
    }
    i++;
  }

  return {
    studentInfo,
    parsedCourses,
    completedCodes: Array.from(completedCodesSet)
  };
}

module.exports = { parseBRACGradeSheet };