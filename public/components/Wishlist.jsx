const { useState, useEffect } = React;

const getDBValueNormalized = (obj, targetKey) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of Object.keys(obj)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey === cleanTarget) {
      return obj[key];
    }
  }
  return undefined;
};

// Robust Grade Point Resolver
const getCourseGradePoints = (c) => {
  const rawGP = c.grade_points ?? c.gradePoints ?? c.Grade_Points ?? c.GradePoints ?? c['Grade Points'] ?? c.gp;
  if (rawGP !== undefined && rawGP !== null && rawGP !== '') {
    const parsed = parseFloat(rawGP);
    if (!isNaN(parsed)) return parsed;
  }

  const grade = String(c.grade || c.Grade || '').trim().toUpperCase();
  const scale = {
    'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'F': 0.0
  };
  if (scale.hasOwnProperty(grade)) return scale[grade];
  return 4.0;
};

const Wishlist = ({ 
  generateWishlist, 
  activeMode, 
  studentData, 
  completedCourses = [], 
  remainingUnlockedCourses = [], 
  dbStreams = [],
  wishlist = [],
  warnings = [],
  userEmail = ''
}) => {
  const [selectedCurrentCourses, setSelectedCurrentCourses] = useState([]);
  const [isCurrentSaved, setIsCurrentSaved] = useState(false);

  const [optimizerMode, setOptimizerMode] = useState('Graduation Acceleration');
  const [guardType, setGuardType] = useState('day');
  
  const [typeLimits, setTypeLimits] = useState({
    'Program Core': 2,
    'Program Elective': 1,
    'University Core': 1,
    'School Core': 0,
    'Capstone': 0
  });

  const [selectedStreamCourses, setSelectedStreamCourses] = useState([]);
  const [expandedCourseCode, setExpandedCourseCode] = useState(null);
  const [displayedWishlist, setDisplayedWishlist] = useState([]);

  useEffect(() => {
    setDisplayedWishlist(wishlist || []);
  }, [wishlist]);

  const safeCompleted = Array.isArray(completedCourses) ? completedCourses : [];
  const safeUnlocked = Array.isArray(remainingUnlockedCourses) ? remainingUnlockedCourses : [];

  // Filter completed courses where status === 'Completed' and Grade Points < 3.70
  const retakeEligibleCourses = safeCompleted.filter(c => {
    const statusStr = String(c.status || 'Completed').toLowerCase();
    const gp = getCourseGradePoints(c);
    return statusStr === 'completed' && gp < 3.70;
  });

  const sortedUnlocked = [...safeUnlocked].sort((a, b) => {
    const codeA = (a.Course_code || a.course_code || a['Course Code'] || '').toUpperCase();
    const codeB = (b.Course_code || b.course_code || b['Course Code'] || '').toUpperCase();
    return codeA.localeCompare(codeB);
  });

  const getCourseStreamFromDB = (course) => {
    const st = getDBValueNormalized(course, 'streamtype') ?? getDBValueNormalized(course, 'stream');
    if (st !== undefined && st !== null && String(st).toLowerCase() !== 'null' && String(st).trim() !== '') {
      const parsed = parseInt(st, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  };

  const streamMaxLimits = { 1: 2, 2: 3, 3: 3, 4: 2, 5: 1, 6: 2 };
  
  const streamDefinitions = Array.isArray(dbStreams) && dbStreams.length > 0
    ? dbStreams.map(s => {
        const id = parseInt(String(s.Stream_name || s.stream_name || s.id).replace(/\D/g, ''), 10) || 1;
        return {
          id: id,
          title: `${s.Stream_name || ('Stream ' + id)}: ${s.StreamType || s.stream_type || ''}`,
          max: streamMaxLimits[id] || 2
        };
      })
    : [
        { id: 1, title: 'Stream 1: Writing Comprehension', max: 2 },
        { id: 2, title: 'Stream 2: Math and Natural Sciences', max: 3 },
        { id: 3, title: 'Stream 3: Arts and Humanities', max: 3 },
        { id: 4, title: 'Stream 4: Social Sciences', max: 2 },
        { id: 5, title: 'Stream 5: Communities, Seeking Transformation', max: 1 },
        { id: 6, title: 'Stream 6: General Electives', max: 2 }
      ];

  const completedByStream = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  const allTakenCourses = [...safeCompleted, ...selectedCurrentCourses];

  allTakenCourses.forEach(c => {
    const code = (c.code || c.course_code || c.Course_code || c['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
    const sId = getCourseStreamFromDB(c);
    if (sId && completedByStream[sId]) {
      if (!completedByStream[sId].includes(code)) {
        completedByStream[sId].push(code);
      }
    }
  });

  let fulfilledQuotaSlots = 0;
  streamDefinitions.forEach(s => {
    fulfilledQuotaSlots += Math.min((completedByStream[s.id] || []).length, s.max);
  });

  const allStreamsCompleted = fulfilledQuotaSlots >= 13;

  const toggleCurrentCourseSelection = (course) => {
    const code = course.Course_code || course.course_code || course['Course Code'];
    if (selectedCurrentCourses.some(c => (c.Course_code || c.course_code || c['Course Code']) === code)) {
      setSelectedCurrentCourses(selectedCurrentCourses.filter(c => (c.Course_code || c.course_code || c['Course Code']) !== code));
    } else {
      setSelectedCurrentCourses([...selectedCurrentCourses, course]);
    }
  };

  const handleSaveCurrentCourses = async () => {
    if (selectedCurrentCourses.length === 0) {
      alert('Please select at least one course you are taking in the current semester!');
      return;
    }

    const currentCodes = selectedCurrentCourses.map(c => c.Course_code || c.course_code || c['Course Code']);

    try {
      const res = await fetch('/api/save-current-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gsuite: userEmail || (studentData ? studentData.studentName.toLowerCase().replace(/\s+/g, '.') + '@g.bracu.ac.bd' : ''),
          currentCourseCodes: currentCodes
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCurrentSaved(true);
        alert('Current semester courses saved successfully! Future Wishlist Planner is now unlocked below.');
      }
    } catch (e) {
      console.error('Error saving current courses:', e);
      alert('Server error saving current courses.');
    }
  };

  const handleTypeLimitChange = (type, val) => {
    const parsedVal = Math.max(0, parseInt(val) || 0);
    const updatedLimits = { ...typeLimits, [type]: parsedVal };
    const totalCount = Object.values(updatedLimits).reduce((sum, count) => sum + count, 0);

    if (totalCount > 4) {
      alert('The total sum across all course types cannot be more than 4 courses!');
      return;
    }

    setTypeLimits(updatedLimits);
  };

  const totalRequestedCourses = Object.values(typeLimits).reduce((sum, count) => sum + count, 0);

  const toggleStreamCourseSelection = (course, streamMax, currentCompletedCount) => {
    const code = course.Course_code || course.course_code || course['Course Code'];
    const streamId = getCourseStreamFromDB(course);

    const streamSelected = selectedStreamCourses.filter(c => getCourseStreamFromDB(c) === streamId);

    if (selectedStreamCourses.some(c => (c.Course_code || c.course_code || c['Course Code']) === code)) {
      setSelectedStreamCourses(selectedStreamCourses.filter(c => (c.Course_code || c.course_code || c['Course Code']) !== code));
    } else {
      if (currentCompletedCount + streamSelected.length >= streamMax) {
        alert(`Quota for Stream ${streamId} reached (${streamMax} max). Selection redirected to Stream 6.`);
        return;
      }
      setSelectedStreamCourses([...selectedStreamCourses, course]);
    }
  };

  const handleRunWishlistOptimizer = () => {
    if (totalRequestedCourses > 4) {
      alert('Total course count across all types cannot exceed 4!');
      return;
    }

    const remainingForFuture = sortedUnlocked.filter(
      uc => !selectedCurrentCourses.some(sc => (sc.Course_code || sc.course_code || sc['Course Code']) === (uc.Course_code || uc.course_code || uc['Course Code']))
    );

    generateWishlist(remainingForFuture, optimizerMode, guardType, typeLimits, selectedStreamCourses);
  };

  const handleSwapCourse = (originalCode, replacementCourse) => {
    setDisplayedWishlist(prevWishlist => {
      return prevWishlist.map(c => {
        const cCode = c.course_code || c['Course Code'];
        if (cCode === originalCode) {
          return {
            ...replacementCourse,
            replacements: c.replacements ? c.replacements.filter(rc => (rc.course_code || rc['Course Code']) !== (replacementCourse.course_code || replacementCourse['Course Code'])) : []
          };
        }
        return c;
      });
    });
    setExpandedCourseCode(null);
  };

  return (
    <div className="space-y-8">
      {/* PHASE 1: CURRENT SEMESTER ENROLLED COURSES */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-crimson"></span> Phase 1: Select Current Semester Enrolled Courses
            </h2>
            <p className="text-xs text-slate-500 mt-1">Select courses you are taking this semester.</p>
          </div>
          <button 
            onClick={handleSaveCurrentCourses} 
            className="bg-navy hover:bg-navyLight text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md active:scale-95 transition"
          >
            Save Current Enrolled Courses ({selectedCurrentCourses.length} Selected)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
          {sortedUnlocked.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 bg-crisp col-span-3 rounded-xl text-center">
              No unlocked courses available. Please upload your official grade sheet PDF above first.
            </p>
          ) : (
            sortedUnlocked.map((c) => {
              const code = c.Course_code || c.course_code || c['Course Code'];
              const name = c.Course_name || c.course_name || c['Course Name'];
              const credits = c.Credit || c.credits || 3.0;
              const type = c.Course_type || c.course_type || c['Course Type'] || 'Core';
              const isSelected = selectedCurrentCourses.some(sc => (sc.Course_code || sc.course_code || sc['Course Code']) === code);

              return (
                <div 
                  key={code} 
                  onClick={() => toggleCurrentCourseSelection(c)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${isSelected ? 'border-crimson bg-red-50/50 shadow-sm' : 'border-slate-200 bg-crisp hover:border-navy'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-crimson text-sm">{code}</span>
                    <input type="checkbox" checked={isSelected} readOnly className="accent-crimson"/>
                  </div>
                  <p className="text-xs text-navy font-semibold line-clamp-2">{name}</p>
                  <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{type}</span>
                    <span>{credits} Credits</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* PHASE 2: FUTURE SEMESTER WISHLIST PLANNER & STREAM PICKER */}
      {isCurrentSaved && (
        <section className="bg-white p-6 rounded-2xl border-2 border-crimson/30 space-y-6 shadow-md animate-fadeIn">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-crimson"></span> Phase 2: Future Semester Wishlist Planner & Stream Picker
            </h2>
            <p className="text-xs text-slate-500 mt-1">Configure your strategy, choose your preferred University Core streams, and run the optimizer.</p>
          </div>

          <div className="bg-crisp p-5 rounded-xl border border-slate-200 space-y-5">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">1. Optimization Strategy & Clash Guards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Optimization Mode (Student Choice)</label>
                <select 
                  value={optimizerMode} 
                  onChange={e => setOptimizerMode(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white text-navy text-xs border border-slate-300 outline-none focus:border-crimson font-medium"
                >
                  <option value="Graduation Acceleration">Graduation Acceleration (Highest Topology Weight)</option>
                  <option value="Probation Escape">Probation Escape (Least Difficulty Rating)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Exam Clash Guard Type</label>
                <select 
                  value={guardType} 
                  onChange={e => setGuardType(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white text-navy text-xs border border-slate-300 outline-none focus:border-crimson"
                >
                  <option value="day">Day Guard (Conflict on Day Overlap)</option>
                  <option value="time">Time Guard (Conflict on Day & Time Tuple)</option>
                </select>
              </div>
            </div>

            {/* PROBATION ESCAPE RETAKE / REPEAT OPTIONS SECTION (GP < 3.70) */}
            {optimizerMode === 'Probation Escape' && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-2">
                    🔄 Retake / Improvement Options (Completed &amp; Grade Points &lt; 3.70)
                  </h4>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                    {retakeEligibleCourses.length} Courses Found
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  These completed courses have grade points under 3.70. Their database Turnover percentages are shown below to help you prioritize retakes for CGPA recovery:
                </p>

                {retakeEligibleCourses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic bg-white p-3 rounded-lg border border-amber-200 text-center">
                    No completed courses found with grade points below 3.70.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {retakeEligibleCourses.map(c => {
                      const code = c.code || c.course_code || c['Course Code'];
                      const name = c.course_name || c.Course_name || c['Course Name'] || code;
                      const gp = getCourseGradePoints(c);
                      const turnover = getDBValueNormalized(c, 'turnoverpercentage') ?? getDBValueNormalized(c, 'turnover_percentage') ?? c['Turnover percentage'] ?? 'N/A';

                      return (
                        <div key={code} className="bg-white p-3 rounded-lg border border-amber-200 flex justify-between items-center shadow-sm">
                          <div>
                            <span className="font-bold text-navy text-xs">{code}</span>
                            <p className="text-[11px] text-slate-600 line-clamp-1">{name}</p>
                            <span className="text-[10px] text-red-600 font-bold">Grade: {c.grade || 'N/A'} ({gp} GP)</span>
                          </div>
                          <div className="text-right pl-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Turnover %</span>
                            <span className="text-xs font-black text-crimson">{turnover}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Course Type Quota Selector */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-navy uppercase tracking-wider">2. Course Type Quota Selector</h3>
                <span className={`text-xs font-bold ${totalRequestedCourses === 4 ? 'text-crimson' : 'text-slate-600'}`}>
                  Total Requested: {totalRequestedCourses} / 4 Courses Max
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.keys(typeLimits).map(type => (
                  <div key={type} className="bg-white p-3 rounded-lg border border-slate-200">
                    <label className="block text-[11px] font-semibold text-navy truncate mb-1">{type}</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="4"
                      value={typeLimits[type]} 
                      onChange={e => handleTypeLimitChange(type, e.target.value)}
                      className="w-full p-2 rounded bg-crisp text-navy text-xs border border-slate-300 text-center font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* University Core Streams Progress & Selection */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">3. University Core Streams Tracker & Picker</h3>
              
              {allStreamsCompleted ? (
                <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-xs text-green-800 font-bold">
                  All 13 University Core Stream requirements are completed!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {streamDefinitions.map(stream => {
                    const doneList = completedByStream[stream.id] || [];
                    const isFull = doneList.length >= stream.max;
                    
                    const streamUnlocked = sortedUnlocked.filter(c => {
                      const code = (c.Course_code || c.course_code || c['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
                      
                      const isEnrolledCurrent = selectedCurrentCourses.some(sc => {
                        const scCode = (sc.Course_code || sc.course_code || sc['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
                        return scCode === code;
                      });

                      const isCompleted = safeCompleted.some(cc => {
                        const ccCode = (cc.code || cc.course_code || cc.Course_code || cc['Course Code'] || '').toUpperCase().replace(/\s+/g, '');
                        return ccCode === code;
                      });

                      return getCourseStreamFromDB(c) === stream.id && !isEnrolledCurrent && !isCompleted;
                    });

                    return (
                      <div key={stream.id} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-navy">{stream.title}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {isFull ? `Quota Full (${doneList.length}/${stream.max})` : `${doneList.length}/${stream.max} Completed`}
                          </span>
                        </div>

                        {doneList.length > 0 && (
                          <p className="text-[10px] text-slate-500">
                            Completed / Enrolled: <span className="font-semibold text-navy">{doneList.join(', ')}</span>
                          </p>
                        )}

                        {isFull ? (
                          <p className="text-[10px] text-red-600 italic">Quota satisfied. Remaining course choices redirected to Stream 6.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {streamUnlocked.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">No available unlocked courses in this stream.</span>
                            ) : (
                              streamUnlocked.map(c => {
                                const code = c.Course_code || c.course_code || c['Course Code'];
                                const isPicked = selectedStreamCourses.some(sc => (sc.Course_code || sc.course_code || sc['Course Code']) === code);
                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    onClick={() => toggleStreamCourseSelection(c, stream.max, doneList.length)}
                                    className={`text-[10px] px-2 py-1 rounded-md font-bold transition border ${isPicked ? 'bg-crimson text-white border-crimson' : 'bg-crisp text-navy border-slate-300 hover:border-navy'}`}
                                  >
                                    {isPicked ? `✓ ${code}` : `+ ${code}`}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={handleRunWishlistOptimizer} 
                className="bg-crimson hover:bg-crimsonHover text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md active:scale-95 transition"
              >
                Run Future Wishlist Algorithmic Optimizer
              </button>
            </div>
          </div>

          {/* WISHLIST OUTPUT SECTION WITH STRICT GUARD-SPECIFIC REPLACEMENTS */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-navy text-white p-4 rounded-xl shadow-md gap-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Optimal Future Wishlist Sequence ({displayedWishlist.length} Courses Selected)
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">Click any course card below to view available non-clashing replacement options.</p>
              </div>
              <span className="text-xs bg-crimson text-white font-bold px-3 py-1 rounded-full uppercase">
                Mode: {activeMode}
              </span>
            </div>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1">
                <span className="text-xs font-bold text-amber-800 uppercase block">Clash Warnings / Unconfirmed Schedules:</span>
                {warnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-700">{w}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedWishlist.length === 0 ? (
                <p className="text-xs text-gray-500 italic col-span-2 bg-crisp p-6 rounded-xl border border-slate-200 text-center">
                  Click 'Run Future Wishlist Algorithmic Optimizer' above to compute your optimal future course sequence.
                </p>
              ) : (
                displayedWishlist.map((c) => {
                  const code = c.course_code || c['Course Code'];
                  const diffVal = getDBValueNormalized(c, 'difficultyrating') ?? getDBValueNormalized(c, 'dificultyrating') ?? c.difficulty ?? 'N/A';
                  const topoVal = getDBValueNormalized(c, 'topologyweight') ?? c.topoWeight ?? 0;
                  const replacements = c.replacements || [];
                  const isExpanded = expandedCourseCode === code;

                  return (
                    <div 
                      key={code} 
                      className={`bg-white p-4 rounded-xl border-2 transition shadow-sm cursor-pointer ${isExpanded ? 'border-crimson ring-2 ring-crimson/10' : 'border-slate-100 hover:border-navy'}`}
                    >
                      <div onClick={() => setExpandedCourseCode(isExpanded ? null : code)} className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-crimson text-base tracking-wide">{code}</p>
                            <span className="text-[10px] text-slate-400 font-semibold">(Click for Alternatives)</span>
                          </div>
                          <p className="text-xs text-navy font-medium mt-0.5">{c.course_name || c['Course Name']}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{c.course_type || c['Course Type']}</span>
                            {activeMode === 'Graduation Acceleration' ? (
                              <span className="text-[10px] bg-red-50 text-crimson px-2 py-0.5 rounded font-semibold">
                                Topo Weight: {topoVal}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-semibold">
                                Difficulty Rating: {diffVal}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs bg-navy text-white font-bold px-3 py-1 rounded-full">{c.credits || c.Credit || 3.0} Cr</span>
                      </div>

                      {/* EXPANDABLE REPLACEMENT COURSES SECTION */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 bg-crisp p-3 rounded-lg animate-fadeIn">
                          <p className="text-xs font-bold text-navy flex items-center justify-between">
                            <span>🔄 Same Type Replacement Options for {code}:</span>
                            <span className="text-[10px] font-normal text-slate-500">Non-clashing ({guardType === 'day' ? 'Same Exam Day' : 'Same Exam Day & Slot'})</span>
                          </p>

                          {replacements.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic p-2 bg-white rounded border border-slate-200 text-center">
                              No same-type unlocked courses available in the catalog without scheduling clashes.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {replacements.map(rep => {
                                const repCode = rep.course_code || rep['Course Code'];
                                const repName = rep.course_name || rep['Course Name'];
                                const repDiff = getDBValueNormalized(rep, 'difficultyrating') ?? getDBValueNormalized(rep, 'dificultyrating') ?? rep.difficulty ?? 'N/A';
                                const repTopo = getDBValueNormalized(rep, 'topologyweight') ?? rep.topoWeight ?? 0;
                                const repType = rep.course_type || rep['Course Type'] || 'Core';

                                return (
                                  <div key={repCode} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                                    <div>
                                      <span className="font-bold text-crimson">{repCode}</span> - <span className="text-navy">{repName}</span>
                                      <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                                        <span className="bg-slate-100 px-1 rounded">{repType}</span>
                                        <span>Difficulty: {repDiff}</span>
                                        <span>Topo Weight: {repTopo}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSwapCourse(code, rep);
                                      }}
                                      className="bg-navy hover:bg-crimson text-white font-bold text-[10px] px-3 py-1.5 rounded-md transition shadow-sm active:scale-95"
                                    >
                                      Swap with this
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

window.Wishlist = Wishlist;