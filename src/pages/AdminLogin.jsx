import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaLock, FaEnvelope, FaShieldAlt } from 'react-icons/fa';
import useAdminStore from '../store/adminStore';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, isAuthenticated } = useAdminStore();
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  useEffect(() => {
    if (isAuthenticated) navigate('/admin/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedCredentials = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password
    };
    const result = await login(normalizedCredentials);
    if (result.success) navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
        <div className="bg-bg-secondary border border-white/10 rounded-3xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-green/10 rounded-2xl mb-4">
              <FaShieldAlt className="text-accent-green text-3xl" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>
            <p className="text-gray-400 text-sm">Authorized access only</p>
          </div>
          
          {/* Info box for subadmins */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-xs sm:text-sm">
              <span className="font-bold">Note:</span> Both master admin and subadmins can login here. 
              Alternatively, subadmins can use the{' '}
              <button onClick={() => navigate('/login')} className="underline hover:text-blue-300">
                regular login page
              </button>.
            </p>
          </div>
          
          {error && (<div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>)}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Admin Email</label>
              <div className="relative mt-2">
                <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" required placeholder="ankit@spllit.app" value={credentials.email} onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-accent-green/50 text-white placeholder-gray-600" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Password</label>
              <div className="relative mt-2">
                <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="password" required placeholder="••••••••" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-accent-green/50 text-white placeholder-gray-600" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-4 bg-accent-green text-black font-bold rounded-2xl hover:bg-accent-green/90 transition-all disabled:opacity-50">{isLoading ? 'Logging in...' : 'Login as Admin'}</button>
          </form>
          <div className="mt-6 text-center"><button onClick={() => navigate('/login')} className="text-sm text-gray-500 hover:text-white transition-colors">← Back to User Login</button></div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
