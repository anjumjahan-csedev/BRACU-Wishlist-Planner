// Case and space-insensitive column extractor
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

// Normalize Course Types for Strict Quota Enforcement
function getNormalizedTypeKey(rawType) {
  if (!rawType) return 'Program Core';
  const str = String(rawType).toLowerCase().trim();
  if (str.includes('program core') || str === 'core' || str === 'major core') return 'Program Core';
  if (str.includes('program elective') || str.includes('major elective') || str === 'elective') return 'Program Elective';
  if (str.includes('university core') || str.includes('gened') || str.includes('general education')) return 'University Core';
  if (str.includes('school core')) return 'School Core';
  if (str.includes('capstone')) return 'Capstone';
  return 'Program Core';
}

// =========================================================================
// 1. EXAM CLASH GUARD ENGINE (DAY GUARD VS. TIME GUARD)
// =========================================================================
function checkExamClash(candidateCourse, selectedCourses, examScheduleMap, guardType = 'day') {
  const candCode = (candidateCourse.course_code || candidateCourse.Course_code || candidateCourse['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
  
  const candExam = examScheduleMap[candCode] || {
    day: getDBValueNormalized(candidateCourse, 'examday') ?? getDBValueNormalized(candidateCourse, 'day'),
    slot: getDBValueNormalized(candidateCourse, 'examslot') ?? getDBValueNormalized(candidateCourse, 'slot'),
    flag: getDBValueNormalized(candidateCourse, 'flag') ?? 0
  };

  if (!candExam || candExam.day === undefined || candExam.day === null || String(candExam.day).toLowerCase() === 'null') {
    return { valid: true, hardBlock: false, warnings: [] };
  }

  const candDayStr = String(candExam.day).trim().toLowerCase();
  const candSlotStr = candExam.slot ? String(candExam.slot).trim().toLowerCase() : '';

  const isNotFixed = candDayStr.includes('not fixed') || candDayStr === '' || candDayStr === 'null';
  let warnings = [];
  if (isNotFixed) {
    warnings.push(`[Warning] ${candCode}: Exam schedule is not fixed.`);
    return { valid: true, hardBlock: false, warnings };
  }

  for (let sel of selectedCourses) {
    const selCode = (sel.course_code || sel.Course_code || sel['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
    const selExam = examScheduleMap[selCode] || {
      day: getDBValueNormalized(sel, 'examday') ?? getDBValueNormalized(sel, 'day'),
      slot: getDBValueNormalized(sel, 'examslot') ?? getDBValueNormalized(sel, 'slot'),
      flag: getDBValueNormalized(sel, 'flag') ?? 0
    };

    if (!selExam || selExam.day === undefined || selExam.day === null) continue;

    const selDayStr = String(selExam.day).trim().toLowerCase();
    const selSlotStr = selExam.slot ? String(selExam.slot).trim().toLowerCase() : '';

    const selNotFixed = selDayStr.includes('not fixed') || selDayStr === '' || selDayStr === 'null';
    if (selNotFixed) continue;

    if (guardType === 'day') {
      if (candDayStr === selDayStr) {
        return { valid: false, hardBlock: true, warnings: [] };
      }
    } else if (guardType === 'time') {
      if (candDayStr === selDayStr && candSlotStr && selSlotStr && candSlotStr === selSlotStr) {
        return { valid: false, hardBlock: true, warnings: [] };
      }
    }
  }

  return { valid: true, hardBlock: false, warnings };
}

function getCourseDifficulty(course) {
  const val = getDBValueNormalized(course, 'difficultyrating') ?? 
              getDBValueNormalized(course, 'dificultyrating') ?? 
              getDBValueNormalized(course, 'difficulty');
  if (val !== undefined && val !== null && val !== '') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 2.5;
}

function getCourseTopoWeight(course) {
  const val = getDBValueNormalized(course, 'topologyweight') ?? getDBValueNormalized(course, 'topoweight');
  if (val !== undefined && val !== null && val !== '') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

function getCourseTurnover(course) {
  const val = getDBValueNormalized(course, 'turnoverpercentage') ?? 
              getDBValueNormalized(course, 'turnover_percentage') ?? 
              getDBValueNormalized(course, 'turnover');
  if (val !== undefined && val !== null && val !== '') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 'N/A';
}

function getCourseStreamFromDB(course) {
  const val = getDBValueNormalized(course, 'streamtype') ?? getDBValueNormalized(course, 'stream');
  if (val !== undefined && val !== null && String(val).toLowerCase() !== 'null' && String(val).trim() !== '') {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

// =========================================================================
// 2. OPTIMIZER ENGINE WITH STRICT GUARD-SPECIFIC REPLACEMENT SEARCH
// =========================================================================
function runKnapsackCourseOptimizer(
  remainingCourses, 
  examScheduleMap = {}, 
  cgpa = 3.25, 
  userMode = 'Graduation Acceleration',
  guardType = 'day',
  typeLimits = {},
  selectedStreamCourses = []
) {
  const activeMode = userMode || 'Graduation Acceleration';
  const MAX_TOTAL_COURSES = 4;

  const studentPickedCodes = new Set(
    (selectedStreamCourses || []).map(sc => 
      (sc.Course_code || sc.course_code || sc['Course Code'] || '').toUpperCase().replace(/\s+/g, '')
    )
  );

  const scoredItems = remainingCourses.map(course => {
    const topoWeight = getCourseTopoWeight(course);
    const difficulty = getCourseDifficulty(course);
    const turnover = getCourseTurnover(course);
    const credits = parseFloat(course.Credit || course.credits || course['Credit'] || 3.0);
    const rawType = course['Course Type'] || course.Course_type || course.course_type || 'Program Core';
    const code = course['Course Code'] || course.course_code || course.Course_code;
    const cleanCode = (code || '').toUpperCase().replace(/\s+/g, '');

    let score = 10;
    
    if (studentPickedCodes.has(cleanCode)) {
      score += 10000;
    } else if (activeMode === 'Graduation Acceleration') {
      score += (topoWeight * 100) + (15 - difficulty) * 2;
    } else {
      score += ((20 - difficulty) * 100) + (topoWeight * 2);
    }

    const stream = getCourseStreamFromDB(course);

    return {
      ...course,
      course_code: code,
      course_name: course['Course Name'] || course.course_name || course.Course_name,
      credits: credits,
      course_type: rawType,
      normalized_type: getNormalizedTypeKey(rawType),
      stream,
      w: Math.floor(credits * 10),
      v: Math.max(1, Math.floor(score)),
      topoWeight,
      difficulty,
      turnover
    };
  });

  scoredItems.sort((a, b) => b.v - a.v);

  const selectedCourses = [];
  const selectedCodes = new Set();
  const activeWarnings = [];
  const typeCounts = {};

  for (const candidate of scoredItems) {
    if (selectedCourses.length >= MAX_TOTAL_COURSES) break;

    if (selectedCodes.has(candidate.course_code)) continue;

    const normType = candidate.normalized_type;

    let allowedLimit = 0;
    if (typeLimits) {
      for (const [key, val] of Object.entries(typeLimits)) {
        if (getNormalizedTypeKey(key) === normType) {
          allowedLimit = Number(val);
          break;
        }
      }
    }

    if ((typeCounts[normType] || 0) >= allowedLimit) continue;

    const clashCheck = checkExamClash(candidate, selectedCourses, examScheduleMap, guardType);

    if (clashCheck.valid) {
      selectedCourses.push(candidate);
      selectedCodes.add(candidate.course_code);
      typeCounts[normType] = (typeCounts[normType] || 0) + 1;
      if (clashCheck.warnings.length > 0) {
        activeWarnings.push(...clashCheck.warnings);
      }
    }
  }

  // GENERATE GUARD-SPECIFIC REPLACEMENTS (SAME COURSE TYPE & NON-CLASHING WITH OTHER 3 COURSES)
  const selectedWithReplacements = selectedCourses.map(selected => {
    const otherSelected = selectedCourses.filter(sc => sc.course_code !== selected.course_code);
    const selCode = (selected.course_code || '').replace(/\s+/g, '').toUpperCase();
    const selExam = examScheduleMap[selCode] || {
      day: getDBValueNormalized(selected, 'examday') ?? getDBValueNormalized(selected, 'day'),
      slot: getDBValueNormalized(selected, 'examslot') ?? getDBValueNormalized(selected, 'slot')
    };
    const selDay = selExam && selExam.day !== undefined ? String(selExam.day).trim().toLowerCase() : '';
    const selSlot = selExam && selExam.slot !== undefined ? String(selExam.slot).trim().toLowerCase() : '';

    // Find non-clashing courses of the SAME course type
    let replacementCandidates = scoredItems.filter(cand => {
      if (cand.course_code === selected.course_code) return false;
      if (selectedCodes.has(cand.course_code)) return false;
      if (cand.normalized_type !== selected.normalized_type) return false;

      const clashCheck = checkExamClash(cand, otherSelected, examScheduleMap, guardType);
      return clashCheck.valid;
    });

    // Rank replacements by closeness to the replaced course's exam schedule
    replacementCandidates.sort((a, b) => {
      const aCode = (a.course_code || '').replace(/\s+/g, '').toUpperCase();
      const bCode = (b.course_code || '').replace(/\s+/g, '').toUpperCase();
      const aExam = examScheduleMap[aCode] || {};
      const bExam = examScheduleMap[bCode] || {};

      const aDay = aExam.day !== undefined ? String(aExam.day).trim().toLowerCase() : '';
      const bDay = bExam.day !== undefined ? String(bExam.day).trim().toLowerCase() : '';
      const aSlot = aExam.slot !== undefined ? String(aExam.slot).trim().toLowerCase() : '';
      const bSlot = bExam.slot !== undefined ? String(bExam.slot).trim().toLowerCase() : '';

      if (guardType === 'day') {
        // DAY GUARD: Prioritize courses on the EXACT SAME EXAM DAY
        const aMatch = (aDay === selDay && selDay !== '') ? 2 : 0;
        const bMatch = (bDay === selDay && selDay !== '') ? 2 : 0;
        return bMatch - aMatch;
      } else {
        // TIME GUARD: Prioritize courses on the EXACT SAME DAY AND TIME SLOT
        const aFullMatch = (aDay === selDay && aSlot === selSlot && selDay !== '') ? 3 : (aDay === selDay ? 1 : 0);
        const bFullMatch = (bDay === selDay && bSlot === selSlot && selDay !== '') ? 3 : (bDay === selDay ? 1 : 0);
        return bFullMatch - aFullMatch;
      }
    });

    return {
      ...selected,
      replacements: replacementCandidates.slice(0, 4)
    };
  });

  return {
    selectedCourses: selectedWithReplacements,
    activeMode,
    maxCredits: 12.0,
    warnings: Array.from(new Set(activeWarnings))
  };
}

module.exports = {
  checkExamClash,
  runKnapsackCourseOptimizer
};