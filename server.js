const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const db = require('./db');
const { parseBRACGradeSheet } = require('./parser');
const { runKnapsackCourseOptimizer } = require('./algorithms');

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

function getDBValueNormalized(obj, targetKey) {
  if (!obj || typeof obj !== 'object') return undefined;
  const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of Object.keys(obj)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey === cleanTarget) {
      return obj[key];
    }
  }
  return undefined;
}

app.get('/api/streams', async (req, res) => {
  try {
    const [streams] = await db.execute('SELECT * FROM stream');
    res.json({ success: true, streams });
  } catch (err) {
    console.error('Error fetching streams:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload-gradesheet', async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!req.files || !req.files.pdfFile) {
      return res.status(400).json({ error: 'Grade sheet PDF file is required.' });
    }

    const { studentInfo, parsedCourses, completedCodes } = await parseBRACGradeSheet(req.files.pdfFile.data);

    const activeGsuite = userEmail && userEmail.length > 0 
      ? userEmail 
      : `${studentInfo.studentName.toLowerCase().replace(/\s+/g, '.')}@g.bracu.ac.bd`;

    try {
      await db.execute(
        `INSERT INTO User (Name, Email, Password, role) VALUES (?, ?, 'password123', 'Student')
         ON DUPLICATE KEY UPDATE Name = VALUES(Name)`,
        [studentInfo.studentName, activeGsuite]
      );

      await db.execute(
        `INSERT INTO Student (
          Student_ID, \`G-Suite\`, CGPA, Graduation_acceleration, Probation_escape, 
          Program_code, First_admitted_semester, Recent_completed_semester,
          Cumulative_credit_attended, Cumulative_credit_earned, StudentType
        ) VALUES (?, ?, ?, 1, 0, 'BSCSE', ?, ?, ?, ?, 'Undergraduate')
        ON DUPLICATE KEY UPDATE 
          CGPA = VALUES(CGPA), 
          Recent_completed_semester = VALUES(Recent_completed_semester),
          Cumulative_credit_attended = VALUES(Cumulative_credit_attended),
          Cumulative_credit_earned = VALUES(Cumulative_credit_earned)`,
        [
          studentInfo.studentId, activeGsuite, studentInfo.cgpa,
          studentInfo.firstSemester, studentInfo.recentSemester,
          studentInfo.cumulativeCreditsAttempted, studentInfo.cumulativeCreditsEarned
        ]
      );
    } catch (dbErr) {
      console.error("User/Student DB sync warning:", dbErr.message);
    }

    await db.execute(`DELETE FROM student_courses WHERE gsuite = ? AND status = 'Completed'`, [activeGsuite]);
    for (const c of parsedCourses) {
      try {
        await db.execute(
          `REPLACE INTO student_courses (gsuite, course_code, status, grade, grade_points, semester)
           VALUES (?, ?, 'Completed', ?, ?, ?)`,
          [activeGsuite, c.code, c.grade, c.gradePoints, c.semester]
        );
      } catch (cErr) {
        console.error(`Error inserting course ${c.code}:`, cErr.message);
      }
    }

    const [rawMasterCourses] = await db.execute('SELECT * FROM cse_database___sheet1');
    const [prereqRows] = await db.execute('SELECT * FROM Prerequisite_of');
    const [streamRows] = await db.execute('SELECT * FROM stream');

    const prereqMap = {};
    prereqRows.forEach(p => {
      const base = p.Base_course_code || p.course_code || p.Course_code;
      const req = p.Prerequisite_course_code || p.prereq_course_code || p.Prerequisite;
      if (base) {
        const cleanBase = base.replace(/\s+/g, '').toUpperCase();
        if (!prereqMap[cleanBase]) prereqMap[cleanBase] = [];
        if (req && req.trim().toLowerCase() !== 'null' && req.trim() !== '') {
          prereqMap[cleanBase].push(req.replace(/\s+/g, '').toUpperCase());
        }
      }
    });

    const enrichedCompletedCourses = parsedCourses.map(p => {
      const cleanCode = (p.code || '').replace(/\s+/g, '').toUpperCase();
      const dbMatch = rawMasterCourses.find(m => {
        const dbCode = (m['Course Code'] || m.Course_code || m.course_code || '').replace(/\s+/g, '').toUpperCase();
        return dbCode === cleanCode;
      });

      const diffDB = dbMatch ? (getDBValueNormalized(dbMatch, 'difficultyrating') ?? getDBValueNormalized(dbMatch, 'dificultyrating')) : null;
      const topoDB = dbMatch ? getDBValueNormalized(dbMatch, 'topologyweight') : null;
      const turnoverDB = dbMatch ? (getDBValueNormalized(dbMatch, 'turnoverpercentage') ?? getDBValueNormalized(dbMatch, 'turnover_percentage')) : null;

      return {
        ...p,
        ...(dbMatch || {}),
        course_code: p.code,
        'Course Code': p.code,
        status: 'Completed',
        'Course Type': dbMatch ? (dbMatch['Course Type'] || dbMatch.Course_type) : 'Core',
        'Stream Type': dbMatch ? getDBValueNormalized(dbMatch, 'streamtype') : null,
        'Difficulty rating': diffDB !== null ? diffDB : 2.5,
        'Topology weight': topoDB !== null ? topoDB : 0,
        'Turnover percentage': turnoverDB !== null ? turnoverDB : 'N/A'
      };
    });

    const remainingUnlockedCourses = rawMasterCourses.filter(c => {
      const code = (c.Course_code || c.course_code || c['Course Code'] || '').replace(/\s+/g, '').toUpperCase();
      if (!code || completedCodes.includes(code)) return false;

      const reqs = prereqMap[code] || [];
      return reqs.length === 0 || reqs.every(r => completedCodes.includes(r));
    });

    remainingUnlockedCourses.sort((a, b) => {
      const codeA = (a.Course_code || a.course_code || a['Course Code'] || '').toUpperCase();
      const codeB = (b.Course_code || b.course_code || b['Course Code'] || '').toUpperCase();
      return codeA.localeCompare(codeB);
    });

    res.json({
      success: true,
      studentInfo,
      completedCourses: enrichedCompletedCourses,
      remainingUnlockedCourses,
      dbStreams: streamRows
    });

  } catch (err) {
    console.error('Grade sheet parsing error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save-current-courses', async (req, res) => {
  try {
    const { gsuite, currentCourseCodes } = req.body;
    if (!currentCourseCodes || currentCourseCodes.length === 0) {
      return res.status(400).json({ error: 'No courses selected.' });
    }

    for (const code of currentCourseCodes) {
      await db.execute(
        `REPLACE INTO student_courses (gsuite, course_code, status, grade, grade_points, semester)
         VALUES (?, ?, 'Enrolled_Current', 'N/A', 0.00, 'Current Semester')`,
        [gsuite, code]
      );
    }
    res.json({ success: true, message: 'Enrolled successfully!' });
  } catch (err) {
    console.error('Error saving current courses:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-wishlist', async (req, res) => {
  try {
    const { selectedCurrentCourses, cgpa, mode, guardType, typeLimits, selectedStreamCourses } = req.body;

    const [rawMasterCourses] = await db.execute('SELECT * FROM cse_database___sheet1');
    let examRows = [];
    try {
      [examRows] = await db.execute('SELECT * FROM exam');
    } catch (e) {
      console.log('Exam table error:', e.message);
    }
    
    const examScheduleMap = {};

    rawMasterCourses.forEach(c => {
      const code = (c['Course Code'] || c.Course_code || c.course_code || '').replace(/\s+/g, '').toUpperCase();
      const day = getDBValueNormalized(c, 'examday') ?? getDBValueNormalized(c, 'day');
      const slot = getDBValueNormalized(c, 'examslot') ?? getDBValueNormalized(c, 'slot');
      if (code && day) {
        examScheduleMap[code] = { day, slot, flag: 0 };
      }
    });

    examRows.forEach(e => {
      const code = (e.Course_code || e.course_code || e['Course Code'] || '').replace(/\s+/g, '').toUpperCase();
      const day = e.Exam_day ?? e.day;
      const slot = e.ExamSlot ?? e.slot;
      const flag = e.Flag ?? 0;
      if (code) {
        examScheduleMap[code] = { day, slot, flag };
      }
    });

    const enrichedCandidates = (selectedCurrentCourses || []).map(c => {
      const cleanCode = (c.Course_code || c.course_code || c['Course Code'] || c.code || '').replace(/\s+/g, '').toUpperCase();
      const dbMatch = rawMasterCourses.find(m => {
        const dbCode = (m['Course Code'] || m.Course_code || m.course_code || '').replace(/\s+/g, '').toUpperCase();
        return dbCode === cleanCode;
      });

      const diffDB = dbMatch ? (getDBValueNormalized(dbMatch, 'difficultyrating') ?? getDBValueNormalized(dbMatch, 'dificultyrating')) : null;
      const topoDB = dbMatch ? getDBValueNormalized(dbMatch, 'topologyweight') : null;

      return {
        ...c,
        ...(dbMatch || {}),
        'Difficulty rating': diffDB !== null ? diffDB : 2.5,
        'Topology weight': topoDB !== null ? topoDB : 0
      };
    });

    const result = runKnapsackCourseOptimizer(
      enrichedCandidates,
      examScheduleMap,
      cgpa || 3.42,
      mode || 'Graduation Acceleration',
      guardType || 'day',
      typeLimits || {},
      selectedStreamCourses || []
    );

    res.json({
      success: true,
      recommendedWishlist: result.selectedCourses,
      activeMode: result.activeMode,
      maxCredits: result.maxCredits,
      warnings: result.warnings
    });
  } catch (err) {
    console.error('Wishlist error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));