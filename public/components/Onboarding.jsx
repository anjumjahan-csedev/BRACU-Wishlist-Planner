const Onboarding = ({ semester, setSemester, department, setDepartment, setPdfFile, handlePdfUpload }) => {
  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
      <h2 className="text-base font-bold text-navy border-b border-slate-200 pb-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-crimson"></span> 1. Academic Onboarding
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-navy">Semester Status</label>
          <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 outline-none focus:border-crimson">
            <option value="1st Semester">1st Semester (Fresher)</option>
            <option value="2nd Semester or Above">2nd Semester or Above</option>
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

        {semester !== '1st Semester' && (
          <div>
            <label className="block text-xs font-semibold mb-1 text-navy">Upload Grade Sheet (PDF)</label>
            <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} className="block w-full text-xs text-navy border border-slate-300 rounded-lg bg-crisp p-1.5"/>
            <button onClick={handlePdfUpload} className="mt-2 text-xs bg-crimson text-white font-bold px-4 py-1.5 rounded-lg hover:bg-crimsonHover transition">Parse PDF</button>
          </div>
        )}
      </div>
    </section>
  );
};
window.Onboarding = Onboarding;