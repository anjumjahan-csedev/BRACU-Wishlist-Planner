const { useState, useEffect } = React;

const AdminPanel = ({ userEmail, setIsLoggedIn }) => {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [prerequisites, setPrerequisites] = useState([]);
  const [exams, setExams] = useState([]);

  // Course form state
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [credits, setCredits] = useState('3.0');
  const [courseType, setCourseType] = useState('Core');
  const [department, setDepartment] = useState('CSE');

  // Prerequisite form state
  const [prereqCourse, setPrereqCourse] = useState('');
  const [requiredPrereq, setRequiredPrereq] = useState('');

  // Exam form state
  const [examCourse, setExamCourse] = useState('');
  const [examDay, setExamDay] = useState('Day 1');
  const [examSlot, setExamSlot] = useState('Slot A');
  const [examFlag, setExamFlag] = useState(0);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'courses') {
        const res = await fetch('/api/admin/courses');
        setCourses(await res.json());
      } else if (activeTab === 'prerequisites') {
        const res = await fetch('/api/admin/prerequisites');
        setPrerequisites(await res.json());
      } else if (activeTab === 'exams') {
        const res = await fetch('/api/admin/exams');
        setExams(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: courseCode, course_name: courseName, credits, course_type, department })
      });
      const data = await res.json();
      if (data.success) {
        alert('Course added successfully!');
        setCourseCode('');
        setCourseName('');
        fetchData();
      } else {
        alert(data.error || 'Failed to add course');
      }
    } catch (err) {
      alert('Server error while adding course.');
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAddPrerequisite = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/prerequisites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: prereqCourse, prereq_course_code: requiredPrereq })
      });
      const data = await res.json();
      if (data.success) {
        alert('Prerequisite added successfully!');
        setPrereqCourse('');
        setRequiredPrereq('');
        fetchData();
      }
    } catch (err) {
      alert('Error adding prerequisite');
    }
  };

  const handleDeletePrerequisite = async (id) => {
    await fetch(`/api/admin/prerequisites/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: examCourse, day: examDay, slot: examSlot, flag: examFlag })
      });
      const data = await res.json();
      if (data.success) {
        alert('Exam schedule added!');
        setExamCourse('');
        fetchData();
      }
    } catch (err) {
      alert('Error adding exam schedule');
    }
  };

  const handleDeleteExam = async (id) => {
    await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-navy text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-2xl font-black tracking-wider">WISH <span className="text-crimson">TRACK</span></h1>
          <p className="text-xs text-slate-300 mt-1">Logged in as: <span className="font-semibold text-crimson">{userEmail}</span> (Admin Control Panel)</p>
        </div>
        <button onClick={() => setIsLoggedIn(false)} className="bg-crimson hover:bg-crimsonHover text-white text-xs font-bold px-4 py-2 rounded-xl transition">
          Sign Out
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('courses')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${activeTab === 'courses' ? 'bg-crimson text-white' : 'bg-white text-navy border border-slate-200 hover:bg-slate-50'}`}>
          Manage Courses
        </button>
        <button onClick={() => setActiveTab('prerequisites')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${activeTab === 'prerequisites' ? 'bg-crimson text-white' : 'bg-white text-navy border border-slate-200 hover:bg-slate-50'}`}>
          Manage Prerequisites
        </button>
        <button onClick={() => setActiveTab('exams')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${activeTab === 'exams' ? 'bg-crimson text-white' : 'bg-white text-navy border border-slate-200 hover:bg-slate-50'}`}>
          Manage Exam Schedule
        </button>
      </div>

      {/* TAB 1: COURSES */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Add New University Course
            </h2>
            <form onSubmit={handleAddCourse} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Course Code</label>
                <input type="text" placeholder="e.g. CSE110" value={courseCode} onChange={e => setCourseCode(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-navy">Course Name</label>
                <input type="text" placeholder="e.g. Programming Language I" value={courseName} onChange={e => setCourseName(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Credits</label>
                <select value={credits} onChange={e => setCredits(e.target.value)} className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson">
                  <option value="3.0">3.0</option>
                  <option value="1.0">1.0</option>
                  <option value="4.0">4.0</option>
                  <option value="0.0">0.0</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Department</label>
                <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson">
                  <option value="CSE">CSE</option>
                  <option value="CS">CS</option>
                  <option value="EEE">EEE</option>
                  <option value="BBS">BBS</option>
                </select>
              </div>
              <button type="submit" className="bg-crimson hover:bg-crimsonHover text-white font-bold text-xs py-3 rounded-xl transition">
                Add Course
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Existing Course Catalog ({courses.length})
            </h2>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-navy">
                <thead className="bg-crisp uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Course Code</th>
                    <th className="p-3">Course Name</th>
                    <th className="p-3">Credits</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Department</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courses.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-crimson">{c.course_code}</td>
                      <td className="p-3 font-medium">{c.course_name}</td>
                      <td className="p-3">{c.credits}</td>
                      <td className="p-3">{c.course_type}</td>
                      <td className="p-3">{c.department}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteCourse(c.id)} className="bg-red-100 text-red-600 font-bold px-3 py-1 rounded-lg hover:bg-red-200 transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PREREQUISITES */}
      {activeTab === 'prerequisites' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Add Course Prerequisite
            </h2>
            <form onSubmit={handleAddPrerequisite} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Course Code</label>
                <input type="text" placeholder="e.g. CSE220" value={prereqCourse} onChange={e => setPrereqCourse(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Required Prerequisite Code</label>
                <input type="text" placeholder="e.g. CSE111" value={requiredPrereq} onChange={e => setRequiredPrereq(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <button type="submit" className="bg-crimson hover:bg-crimsonHover text-white font-bold text-xs py-3 rounded-xl transition">
                Add Prerequisite
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Prerequisite Mapping ({prerequisites.length})
            </h2>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-navy">
                <thead className="bg-crisp uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Course Code</th>
                    <th className="p-3">Requires Prerequisite</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prerequisites.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-crimson">{p.course_code}</td>
                      <td className="p-3 font-semibold text-navy">{p.prereq_course_code}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeletePrerequisite(p.id)} className="bg-red-100 text-red-600 font-bold px-3 py-1 rounded-lg hover:bg-red-200 transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXAM SCHEDULES */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Add Exam Schedule
            </h2>
            <form onSubmit={handleAddExam} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Course Code</label>
                <input type="text" placeholder="e.g. CSE110" value={examCourse} onChange={e => setExamCourse(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Exam Day</label>
                <input type="text" placeholder="e.g. Day 1" value={examDay} onChange={e => setExamDay(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Time Slot</label>
                <input type="text" placeholder="e.g. Slot A" value={examSlot} onChange={e => setExamSlot(e.target.value)} required className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-navy">Clash Flag (0, 1, 2)</label>
                <select value={examFlag} onChange={e => setExamFlag(Number(e.target.value))} className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson">
                  <option value={0}>0 (Fixed & Confirmed)</option>
                  <option value={1}>1 (Not Fixed)</option>
                  <option value={2}>2 (Fixed Day, Unconfirmed Time)</option>
                </select>
              </div>
              <button type="submit" className="bg-crimson hover:bg-crimsonHover text-white font-bold text-xs py-3 rounded-xl transition">
                Add Exam
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> Exam Schedule Database ({exams.length})
            </h2>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-navy">
                <thead className="bg-crisp uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Course Code</th>
                    <th className="p-3">Day</th>
                    <th className="p-3">Slot</th>
                    <th className="p-3">Flag</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-crimson">{e.course_code}</td>
                      <td className="p-3">{e.day}</td>
                      <td className="p-3">{e.slot}</td>
                      <td className="p-3"><span className="px-2 py-1 bg-slate-100 rounded font-bold">Flag {e.flag}</span></td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteExam(e.id)} className="bg-red-100 text-red-600 font-bold px-3 py-1 rounded-lg hover:bg-red-200 transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
window.AdminPanel = AdminPanel;