import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaWhatsapp, FaUniversity, FaSearchLocation, FaUserCheck, FaBell, FaGraduationCap, FaEnvelope, FaPhone, FaUserAlt, FaTimes, FaLock } from 'react-icons/fa';
import useAuthStore from '../store/authStore';


// --- Premium Phone Mockup with "Live Match" Simulation ---
const PhoneMockup = () => {
    // Automate a "notification" popping up
    const [showNotif, setShowNotif] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setShowNotif(true);
            setTimeout(() => setShowNotif(false), 4000);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-[320px] h-[640px] bg-[#0a0a0a] rounded-[3.5rem] border-[8px] border-[#1a1a1a] shadow-2xl overflow-hidden ring-4 ring-white/5">
            {/* Dynamic Island / Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-full z-30 flex items-center justify-center p-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-auto mr-2" />
            </div>

            {/* Screen Content */}
            <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black relative flex flex-col p-6 pt-16">

                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h4 className="text-white font-bold text-lg">Hello, Ankit 👋</h4>
                        <p className="text-xs text-gray-500">BS Degree • Year 2</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
                    </div>
                </div>

                {/* Main Card: "Searching" */}
                <div className="bg-gray-800/50 rounded-3xl p-6 border border-white/5 mb-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-accent-green/5 group-hover:bg-accent-green/10 transition-colors" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                            <FaSearchLocation className="text-xl" />
                        </div>
                        <span className="text-xs font-mono text-gray-400 bg-black/40 px-2 py-1 rounded">SCANNING</span>
                    </div>
                    <h5 className="text-gray-200 font-bold">Exam Center Search</h5>
                    <p className="text-xs text-gray-500 mt-1">Finding students near T. Nagar...</p>

                    {/* Radar Animation */}
                    <div className="mt-6 flex justify-center py-4 relative">
                        <div className="w-20 h-20 border border-white/10 rounded-full animate-ping absolute" />
                        <div className="w-10 h-10 bg-accent-green rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10" />
                        <div className="absolute -right-2 top-0 w-6 h-6 bg-purple-500 rounded-full border-2 border-gray-900 animate-bounce" />
                    </div>
                </div>

                {/* "Live Notification" Popup */}
                <AnimatePresence>
                    {showNotif && (
                        <motion.div
                            initial={{ y: -100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -100, opacity: 0 }}
                            className="absolute top-14 left-4 right-4 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl z-20 shadow-xl flex gap-3"
                        >
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black">
                                <FaUserCheck />
                            </div>
                            <div>
                                <h6 className="text-white font-bold text-sm">Match Found!</h6>
                                <p className="text-xs text-gray-300">Rahul is going to Ion Digital Zone.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Navigation Mock */}
                <div className="mt-auto flex justify-between px-4 py-4 text-2xl text-gray-600">
                    <div className="text-accent-green"><FaUniversity /></div>
                    <div><FaSearchLocation /></div>
                    <div><FaBell /></div>
                </div>
            </div>
        </div>
    );
};

// --- Scrolling Pain Points Ticker ---
const PainPointTicker = () => (
    <div className="w-full overflow-hidden bg-white/5 border-y border-white/5 py-3 mb-12">
        <motion.div
            className="flex whitespace-nowrap gap-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
            {[
                "🚕 Cab fare ₹800? Split it.",
                "😓 Traveling alone is boring.",
                "📍 Exam center 20km away?",
                "🤝 Meet your batchmates.",
                "💸 Save 60% on travel.",
                "🚕 Cab fare ₹800? Split it.",
                "😓 Traveling alone is boring.",
                "📍 Exam center 20km away?",
            ].map((text, i) => (
                <span key={i} className="text-gray-400 font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-accent-green rounded-full" /> {text}
                </span>
            ))}
        </motion.div>
    </div>
);

const Login = () => {
    const navigate = useNavigate();
    const { login, isLoading, isAuthenticated } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });

    const [emailId, setEmailId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    // Stats Counter Animation
    const [count, setCount] = useState(0);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            // Handle both regular users and subadmins
            let email;
            if (emailId.includes('@')) {
                // If email already has @, use it as is (for subadmins)
                email = emailId;
            } else {
                // For regular users, append @study.iitm.ac.in
                email = `${emailId}@study.iitm.ac.in`;
            }

            const credentials = {
                email: email,
                password: password
            };

            const result = await login(credentials);

            if (result.success) {
                // Check if user is a subadmin and redirect accordingly
                if (result.user?.role === 'subadmin' || result.user?.isAdmin) {
                    navigate('/admin/dashboard');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(result.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('Login failed. Please try again.');
        }
    };


    return (
        <div className="min-h-screen bg-[#050505] overflow-hidden relative font-poppins selection:bg-accent-green selection:text-black">

            {/* Animated Grid Background */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            <div className="absolute inset-0 z-0 opacity-30">
                <svg className="w-full h-full" width="100%" height="100%">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>



            <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-20">

                    {/* Left: Content */}
                    <div className="flex-1 text-center lg:text-left w-full max-w-full overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="w-full flex flex-col items-center lg:items-start"
                        >
                            {/* TARGET AUDIENCE BADGE - EMPHASIZED */}
                            <div className="inline-block mb-6">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="px-3 md:px-6 py-1.5 md:py-2 bg-gradient-to-r from-red-600 to-red-900 rounded-full border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-2 md:gap-3"
                                >
                                    <FaGraduationCap className="text-white text-base md:text-xl" />
                                    <span className="text-white font-bold tracking-wide uppercase text-[10px] md:text-sm">
                                        Exclusively for IIT Madras BS Students
                                    </span>
                                </motion.div>
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white mb-4 sm:mb-6 leading-[1.1] tracking-tight">
                                Don't Travel to <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-green via-emerald-400 to-teal-500">
                                    Exam Centers
                                </span> <br className="hidden sm:block" /> Alone.
                            </h1>

                            <p className="text-gray-400 text-base sm:text-lg lg:text-xl mb-8 sm:mb-10 w-full max-w-[280px] sm:max-w-xl mx-auto lg:mx-0 leading-relaxed px-2 sm:px-0 text-center lg:text-left">
                                Join 400+ verified IITM BS students. Split fares, share notes, and commute safely.
                            </p>

                            <PainPointTicker />

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-center lg:justify-start w-full px-4 sm:px-0">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-8 py-4.5 bg-accent-green text-black font-black rounded-2xl hover:bg-opacity-90 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 text-lg"
                                >
                                    Login to Connect
                                </motion.button>

                                <motion.a
                                    whileTap={{ scale: 0.95 }}
                                    href="https://chat.whatsapp.com/H49JywLfKsxAoC8X5wC0yg"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-4.5 bg-white/5 text-white border border-white/10 font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-lg backdrop-blur-sm"
                                >
                                    <FaWhatsapp className="text-[#25D366]" size={20} />
                                    Join Community
                                </motion.a>
                            </div>

                            <div className="mt-12 flex items-center justify-center lg:justify-start gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gray-800 overflow-hidden">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="student" />
                                        </div>
                                    ))}
                                    <div className="w-10 h-10 rounded-full border-2 border-black bg-accent-green flex items-center justify-center text-black font-bold text-xs">
                                        +420
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-bold text-lg leading-none">{count}+</p>
                                    <p className="text-gray-500 text-xs">BS Students Joined</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right: Interactive Component */}
                    <div className="flex-1 flex justify-center relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                            className="relative"
                        >
                            {/* Glow Effects behind phone */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-green/20 rounded-full blur-[120px] pointer-events-none" />

                            <PhoneMockup />

                            {/* Floating Badge */}
                            <motion.div
                                animate={{ y: [-10, 10, -10] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -bottom-10 -right-10 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl max-w-[200px]"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <FaUniversity className="text-yellow-500" />
                                    <span className="text-xs font-bold text-white">IIT Madras Verified</span>
                                </div>
                                <p className="text-[10px] text-gray-400">Exclusive network for BS Degree students.</p>
                            </motion.div>
                        </motion.div>
                    </div>

                </div>
            </div>
            {/* Login Popup Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="bg-[#0f0f0f] border-t sm:border border-white/10 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 md:p-12 relative shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {/* Drag Indicator for Mobile */}
                            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sm:hidden" />

                            {/* Accent Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-40 bg-accent-green/10 blur-[100px] rounded-full" />

                            {/* Close Button */}
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-all group"
                            >
                                <FaTimes className="text-gray-400 group-hover:text-white transition-colors" />
                            </button>

                            {/* Header */}
                            <div className="text-center mb-10 relative z-10">
                                <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight uppercase">
                                    WELCOME <span className="text-accent-green">BACK</span>
                                </h2>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Login to find your <span className="text-accent-green font-bold text-sm">ride matches</span>.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            {/* Login Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Email Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-accent-green ml-4 tracking-widest uppercase">Student Email or Admin Email</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                required
                                                type="text"
                                                placeholder="Roll No (e.g. 25f36563058) or email@spllit.app"
                                                value={emailId}
                                                onChange={(e) => setEmailId(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4.5 focus:border-accent-green/50 outline-none transition-all placeholder:text-gray-700 text-white"
                                            />
                                            <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        </div>
                                        {!emailId.includes('@') && (
                                            <div className="bg-white/10 border border-t-0 sm:border-t sm:border-l-0 border-white/10 rounded-2xl px-4 py-4.5 text-gray-400 font-medium text-xs flex items-center justify-center whitespace-nowrap">
                                                @study.iitm.ac.in
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-accent-green ml-4 tracking-widest uppercase">Password</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            type="password"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4.5 focus:border-accent-green/50 outline-none transition-all placeholder:text-gray-700 text-white"
                                        />
                                        <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-5 bg-gradient-to-r from-accent-green to-emerald-500 text-black font-black text-xl rounded-2xl shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:-translate-y-1 active:scale-95 transition-all mt-4 uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'LOGGING IN...' : 'Login to Connect'}
                                </button>

                                <div className="text-center mt-6">
                                    <p className="text-gray-500 text-sm">
                                        Don't have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsModalOpen(false);
                                                // Open signup modal (you may need to pass this from parent)
                                            }}
                                            className="text-accent-green font-bold hover:underline"
                                        >
                                            Sign Up
                                        </button>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/admin/login')}
                                        className="text-xs text-gray-600 hover:text-accent-green transition-colors mt-3"
                                    >
                                        Admin Login →
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;
