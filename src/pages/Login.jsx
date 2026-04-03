import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaWhatsapp, FaUniversity, FaSearchLocation, FaUserCheck, FaBell, FaGraduationCap, FaEnvelope, FaTimes, FaLock, FaGoogle } from 'react-icons/fa';
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
    const [searchParams] = useSearchParams();
    const { login, loginWithGoogle, isLoading, isAuthenticated } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [authMethod, setAuthMethod] = useState('');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleInitialized, setGoogleInitialized] = useState(false);

    const [emailId, setEmailId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (searchParams.get('signin') === '1') {
            setIsModalOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        const handleOpenSignInModal = () => {
            setIsModalOpen(true);
            setError('');
        };

        window.addEventListener('spllit:open-signin-modal', handleOpenSignInModal);
        return () => {
            window.removeEventListener('spllit:open-signin-modal', handleOpenSignInModal);
        };
    }, []);

    useEffect(() => {
        if (!isModalOpen) return;
        if (googleInitialized) return;

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            setGoogleReady(false);
            return;
        }

        if (window.google?.accounts?.id) {
            setGoogleReady(true);
            return;
        }

        const existingScript = document.getElementById('google-identity-script');
        if (existingScript) {
            if (window.google?.accounts?.id) {
                setGoogleReady(true);
            }
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.id = 'google-identity-script';
        script.async = true;
        script.defer = true;
        script.onload = () => setGoogleReady(true);
        script.onerror = () => setGoogleReady(false);
        document.body.appendChild(script);
    }, [isModalOpen, googleInitialized]);

    useEffect(() => {
        if (authMethod !== 'google' || !isModalOpen) return;
        if (!googleReady || !window.google?.accounts?.id) return;
        if (googleInitialized) return;

        handleGoogleSignIn();
    }, [authMethod, isModalOpen, googleReady, googleInitialized]);

    // Stats Counter Animation
    const [count, setCount] = useState(0);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!authMethod) {
            setError('Please choose Sign in with Google or Sign in with Email.');
            return;
        }

        if (authMethod === 'google') {
            handleGoogleSignIn();
            return;
        }

        try {
            // Handle both regular users and subadmins
            let email;
            if (authMethod === 'google' || emailId.includes('@')) {
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

    const handleGoogleSignIn = () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            setError('Google sign-in is not configured. Please add VITE_GOOGLE_CLIENT_ID.');
            return;
        }

        if (!googleReady || !window.google?.accounts?.id) {
            setError('Google sign-in is still loading. Please wait a moment and try again.');
            return;
        }

        if (googleInitialized) {
            window.google.accounts.id.prompt();
            return;
        }

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
                try {
                    if (!response?.credential) {
                        setError('Google authentication failed. Please try again.');
                        return;
                    }

                    const result = await loginWithGoogle(response.credential);
                    if (result.success) {
                        if (result.user?.role === 'subadmin' || result.user?.isAdmin) {
                            navigate('/admin/dashboard');
                        } else {
                            navigate('/dashboard');
                        }
                    } else {
                        setError(result.error || 'Google login failed.');
                    }
                } catch (error) {
                    setError('Google login failed. Please try again.');
                }
            }
        });

        setGoogleInitialized(true);
        window.google.accounts.id.prompt();
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
                                    Sign In
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
                            className="bg-black border-t sm:border border-white/10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-8 relative shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {/* Drag Indicator for Mobile */}
                            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sm:hidden" />

                            {/* Accent Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-40 bg-accent-green/10 blur-[100px] rounded-full pointer-events-none" />

                            {/* Close Button */}
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-all group"
                            >
                                <FaTimes className="text-gray-400 group-hover:text-white transition-colors" />
                            </button>

                            {/* Header */}
                            <div className="text-center mb-8 relative z-10">
                                <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight uppercase">
                                    SIGN <span className="text-accent-green">IN</span>
                                </h2>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Choose your sign-in method to continue.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            {/* Sign-in Method */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMethod('google');
                                        setError('');
                                    }}
                                    className={`border rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-semibold transition-all ${authMethod === 'google'
                                            ? 'border-accent-green bg-accent-green/10 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <FaGoogle />
                                    Sign in with Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMethod('email');
                                        setError('');
                                    }}
                                    className={`border rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-semibold transition-all ${authMethod === 'email'
                                            ? 'border-accent-green bg-accent-green/10 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <FaEnvelope />
                                    Sign in with Email
                                </button>
                            </div>

                            {/* Sign-in Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {authMethod === 'google' && (
                                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
                                        <p className="text-sm text-gray-300">
                                            Press submit to continue with your Google account popup.
                                        </p>
                                        {!googleReady && (
                                            <p className="text-xs text-gray-500 mt-2">Loading Google Sign-In...</p>
                                        )}
                                    </div>
                                )}

                                {/* Email Input */}
                                {authMethod !== 'google' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-accent-green ml-4 tracking-widest uppercase">
                                        Student Email or Admin Email
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                required={authMethod !== 'google'}
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
                                )}

                                {/* Password Input */}
                                {authMethod !== 'google' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-accent-green ml-4 tracking-widest uppercase">Password</label>
                                    <div className="relative group">
                                        <input
                                            required={authMethod !== 'google'}
                                            type="password"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4.5 focus:border-accent-green/50 outline-none transition-all placeholder:text-gray-700 text-white"
                                        />
                                        <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                    </div>
                                </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-5 bg-gradient-to-r from-accent-green to-emerald-500 text-black font-black text-xl rounded-2xl shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:-translate-y-1 active:scale-95 transition-all mt-4 uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'SIGNING IN...' : authMethod === 'google' ? 'Continue with Google' : 'Submit'}
                                </button>

                                <div className="text-center mt-6">
                                    <p className="text-gray-500 text-sm">Use your existing account to continue.</p>
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
