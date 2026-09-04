const Header = ({ userEmail, role, setIsLoggedIn }) => {
  return (
    <header className="bg-navy p-5 rounded-2xl flex justify-between items-center shadow-lg text-white">
      <div>
        <h1 className="text-2xl font-black tracking-wider text-white">WISH <span className="text-crimson">TRACK</span></h1>
        <p className="text-xs text-slate-300">Logged in as: <span className="text-white font-semibold">{userEmail}</span> ({role})</p>
      </div>
      <button onClick={() => setIsLoggedIn(false)} className="bg-white/10 text-white border border-white/20 text-xs font-bold px-4 py-2 rounded-lg hover:bg-crimson hover:border-crimson transition duration-150">
        Sign Out
      </button>
    </header>
  );
};
window.Header = Header;