const AuthScreen = ({ handleLogin, userEmail, setUserEmail, password, setPassword, role, setRole }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-crisp">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-navy tracking-wider">WISH <span className="text-crimson">TRACK</span></h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">From wishlist to graduation</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-navy">Email Address</label>
            <input type="email" required placeholder={role === 'Admin' ? 'admin@example.com' : 'student@g.bracu.ac.bd'}
              value={userEmail} onChange={e => setUserEmail(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 focus:border-crimson focus:ring-1 focus:ring-crimson outline-none transition"/>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-navy">Password</label>
            <input type="password" required placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 focus:border-crimson focus:ring-1 focus:ring-crimson outline-none transition"/>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-navy">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-crisp text-navy text-sm border border-slate-300 font-bold outline-none focus:border-crimson">
              <option value="Student">Student User</option>
              <option value="Admin">Admin (System Manager)</option>
            </select>
          </div>

          <button type="submit" className="w-full bg-crimson text-white font-bold py-3 rounded-lg shadow-md hover:bg-crimsonHover active:scale-[0.99] transition duration-150 tracking-wide uppercase text-xs">
            Sign In to WishTrack
          </button>
        </form>
      </div>
    </div>
  );
};
window.AuthScreen = AuthScreen;