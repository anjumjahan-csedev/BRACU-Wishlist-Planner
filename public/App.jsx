const { useState, useEffect } = React;
const { AuthScreen, Header, Onboarding, Wishlist, AdminPanel } = window;

function App() {
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [semester, setSemester] = useState('2nd Semester or Above');
  const [department, setDepartment] = useState('CSE');
  const [pdfFile, setPdfFile] = useState(null);

  const [studentData, setStudentData] = useState(null);
  const [completedCourses, setCompletedCourses] = useState([]);
  const [remainingUnlockedCourses, setRemainingUnlockedCourses] = useState([]);
  const [dbStreams, setDbStreams] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [activeMode, setActiveMode] = useState('Graduation Acceleration');

  useEffect(() => {
    if (isLoggedIn) {
      fetchStreamMetadata();
    }
  }, [isLoggedIn]);

  const fetchStreamMetadata = async () => {
    try {
      const res = await fetch('/api/streams');
      const data = await res.json();
      if (data.success) {
        setDbStreams(data.streams || []);
      }
    } catch (err) {
      console.error('Failed to fetch db streams:', err);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoggedIn(true);
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) {
      alert('Please attach a Grade Sheet PDF first!');
      return;
    }

    const formData = new FormData();
    formData.append('pdfFile', pdfFile);
    formData.append('userEmail', userEmail);

    try {
      const res = await fetch('/api/upload-gradesheet', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setStudentData(data.studentInfo);
        setCompletedCourses(data.completedCourses || []);
        setRemainingUnlockedCourses(data.remainingUnlockedCourses || []);
        if (data.dbStreams) setDbStreams(data.dbStreams);
        alert(`Grade sheet parsed successfully for ${data.studentInfo.studentName}! ${data.completedCourses ? data.completedCourses.length : 0} courses synced.`);
      } else {
        alert(data.error || 'Failed to parse grade sheet');
      }
    } catch (err) {
      alert('Server error uploading PDF.');
    }
  };

  const generateWishlist = async (selectedCourses, mode, guardType, typeLimits, selectedStreamCourses) => {
    try {
      const res = await fetch('/api/generate-wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCurrentCourses: selectedCourses,
          cgpa: studentData ? studentData.cgpa : 3.42,
          mode: mode || activeMode,
          guardType: guardType || 'day',
          typeLimits: typeLimits || {},
          selectedStreamCourses: selectedStreamCourses || []
        })
      });
      const data = await res.json();
      if (data.success) {
        setWishlist(data.recommendedWishlist || []);
        setActiveMode(data.activeMode || mode || 'Graduation Acceleration');
      }
    } catch (err) {
      console.error('Failed generating wishlist:', err);
    }
  };

  if (!isLoggedIn) {
    return (
      <AuthScreen 
        handleLogin={handleLogin} 
        userEmail={userEmail} setUserEmail={setUserEmail} 
        password={password} setPassword={setPassword} 
        role={role} setRole={setRole} 
      />
    );
  }

  if (role === 'Admin') {
    return <AdminPanel userEmail={userEmail} setIsLoggedIn={setIsLoggedIn} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Header userEmail={userEmail} role={role} setIsLoggedIn={setIsLoggedIn} />
      <Onboarding 
        semester={semester} setSemester={setSemester} 
        department={department} setDepartment={setDepartment} 
        setPdfFile={setPdfFile} handlePdfUpload={handlePdfUpload} 
      />
      <Wishlist 
        generateWishlist={generateWishlist} 
        activeMode={activeMode} 
        studentData={studentData} 
        completedCourses={completedCourses} 
        remainingUnlockedCourses={remainingUnlockedCourses} 
        dbStreams={dbStreams}
        wishlist={wishlist} 
        userEmail={userEmail}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);