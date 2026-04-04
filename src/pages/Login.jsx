import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaWhatsapp, FaUniversity, FaSearchLocation, FaUserCheck, FaBell, FaGraduationCap, FaEnvelope, FaTimes, FaLock, FaGoogle } from 'react-icons/fa';
import { getRedirectResult, setPersistence, browserLocalPersistence, signInWithPopup, signInWithRedirect, onAuthStateChanged } from 'firebase/auth';
import useAuthStore from '../store/authStore';
import { firebaseAuth, googleProvider } from '../config/firebase';


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
    const { login, loginWithGoogle, isLoading, isAuthenticated, hasHydrated, user } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [authMethod, setAuthMethod] = useState('');
    const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
    const [isSyncingGoogleUser, setIsSyncingGoogleUser] = useState(false);

    const [emailId, setEmailId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (!hasHydrated || !isAuthenticated) {
            return;
        }

        if (user?.role === 'subadmin' || user?.isAdmin) {
            navigate('/admin/dashboard');
            return;
        }

        navigate('/dashboard');
    }, [hasHydrated, isAuthenticated, navigate, user]);

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
        const handleGoogleRedirectResult = async () => {
            try {
                if (!hasHydrated) {
                    return;
                }

                setIsGoogleRedirecting(true);
                const result = await getRedirectResult(firebaseAuth);
                if (!result?.user) {
                    return;
                }

                const idToken = await result.user.getIdToken(true);
                const authResult = await loginWithGoogle(idToken);
                if (authResult.success) {
                    if (authResult.user?.role === 'subadmin' || authResult.user?.isAdmin) {
                        navigate('/admin/dashboard');
                    } else {
                        navigate('/dashboard');
                    }
                    return;
                }

                setError(authResult.error || 'Google login failed.');
            } catch (error) {
                setError(mapFirebaseAuthError(error));
            } finally {
                setIsGoogleRedirecting(false);
            }
        };

        handleGoogleRedirectResult();
    }, [hasHydrated, loginWithGoogle, navigate]);

    useEffect(() => {
        if (!hasHydrated) {
            return;
        }

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
            if (!firebaseUser || isAuthenticated || isSyncingGoogleUser) {
                return;
            }

            try {
                setIsSyncingGoogleUser(true);
                const idToken = await firebaseUser.getIdToken(true);
                const authResult = await loginWithGoogle(idToken);

                if (authResult.success) {
                    if (authResult.user?.role === 'subadmin' || authResult.user?.isAdmin) {
                        navigate('/admin/dashboard');
                    } else {
                        navigate('/dashboard');
                    }
                }
            } catch (error) {
                setError(mapFirebaseAuthError(error));
            } finally {
                setIsSyncingGoogleUser(false);
            }
        });

        return () => unsubscribe();
    }, [hasHydrated, isAuthenticated, isSyncingGoogleUser, loginWithGoogle, navigate]);

    // Stats Counter Animation
    const [count, setCount] = useState(0);

    useEffect(() => {
        const target = 420;
        const durationMs = 900;
        const frameMs = 16;
        const increment = Math.max(1, Math.ceil(target / (durationMs / frameMs)));

        const timer = setInterval(() => {
            setCount((prev) => {
                const next = prev + increment;
                if (next >= target) {
                    clearInterval(timer);
                    return target;
                }
                return next;
            });
        }, frameMs);

        return () => clearInterval(timer);
    }, []);

    const mapFirebaseAuthError = (error) => {
        const code = error?.code || '';

        if (code === 'auth/unauthorized-domain') {
            return `Google sign-in is not enabled for this domain (${window.location.hostname}). Ask admin to add it in Firebase Authentication -> Settings -> Authorized domains.`;
        }

        if (code === 'auth/operation-not-allowed') {
            return 'Google provider is disabled in Firebase Authentication. Please enable Google sign-in in Firebase console.';
        }

        if (code === 'auth/popup-closed-by-user') {
            return 'Google sign-in popup was closed. Please try again.';
        }

        if (code === 'auth/network-request-failed') {
            return 'Network error during Google sign-in. Check your internet and try again.';
        }

        if (code === 'auth/web-storage-unsupported') {
            return 'Your browser is blocking secure storage required for login. Enable cookies/storage and try again.';
        }

        if (code === 'auth/internal-error') {
            return 'Google redirect setup is incomplete for this domain. Please verify Firebase auth domain and authorized domains.';
        }

        return 'Google login failed. Please try again.';
    };
    
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

    const handleGoogleSignIn = async () => {
        setError('');
        setIsGoogleRedirecting(true);

        try {
            try {
                await setPersistence(firebaseAuth, browserLocalPersistence);
            } catch (persistenceError) {
                console.warn('Falling back to Firebase default auth persistence:', persistenceError);
            }

            googleProvider.setCustomParameters({
                prompt: 'select_account'
            });

            const isLikelyMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);

            if (isLikelyMobile) {
                await signInWithRedirect(firebaseAuth, googleProvider);
                return;
            }

            const result = await signInWithPopup(firebaseAuth, googleProvider);
            const idToken = await result.user.getIdToken(true);
            const authResult = await loginWithGoogle(idToken);

            if (authResult.success) {
                if (authResult.user?.role === 'subadmin' || authResult.user?.isAdmin) {
                    navigate('/admin/dashboard');
                } else {
                    navigate('/dashboard');
                }
                return;
            }

            setError(authResult.error || 'Google login failed.');
        } catch (error) {
            const firebaseErrorCode = error?.code || '';
            const shouldFallbackToRedirect = [
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment'
            ].includes(firebaseErrorCode);

            if (shouldFallbackToRedirect) {
                try {
                    setIsGoogleRedirecting(true);
                    await signInWithRedirect(firebaseAuth, googleProvider);
                    return;
                } catch (redirectError) {
                    setIsGoogleRedirecting(false);
                    setError(mapFirebaseAuthError(redirectError));
                    return;
                }
            }

            setError(mapFirebaseAuthError(error));
        } finally {
            setIsGoogleRedirecting(false);
        }
    };


    return (
        <div className="min-h-screen bg-[#050505] overflow-x-hidden relative font-poppins selection:bg-accent-green selection:text-black">

            {/* Animated Grid Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-accent-green/[0.04] pointer-events-none" />
            <div className="absolute -top-24 -left-16 w-72 h-72 bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-32 right-[-80px] w-64 h-64 bg-cyan-400/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute inset-0 z-0 opacity-20">
                <svg className="w-full h-full" width="100%" height="100%">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-28 md:pt-28 pb-14 sm:pb-20 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20">

                    {/* Left: Content */}
                    <div className="flex-1 text-center lg:text-left w-full max-w-4xl mx-auto lg:mx-0">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="w-full flex flex-col items-center lg:items-start"
                        >
                            {/* TARGET AUDIENCE BADGE - EMPHASIZED */}
                            <div className="inline-block mb-6 sm:mb-8">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-red-600/90 to-red-900/90 rounded-full border border-red-500/30 shadow-[0_0_25px_rgba(220,38,38,0.3)] flex items-center gap-2 sm:gap-3 backdrop-blur-sm"
                                >
                                    <FaGraduationCap className="text-white text-base sm:text-lg md:text-xl" />
                                    <span className="text-white font-bold tracking-wide uppercase text-[10px] sm:text-xs md:text-sm">
                                        Exclusively for IIT Madras Students
                                    </span>
                                </motion.div>
                            </div>

                            <h1 className="text-[2rem] sm:text-5xl md:text-7xl lg:text-8xl font-black text-white mb-4 sm:mb-8 leading-[1.05] tracking-tight">
                                Don't Travel to <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-green via-emerald-400 to-teal-500">
                                    Exam Centers
                                </span> <br className="hidden sm:block" /> Alone.
                            </h1>

                            <p className="text-gray-400 text-sm sm:text-lg lg:text-xl mb-6 sm:mb-10 w-full max-w-[320px] sm:max-w-xl mx-auto lg:mx-0 leading-relaxed px-2 sm:px-0 text-center lg:text-left">
                                Join 400+ verified IITM BS students. Split fares, share notes, and commute safely.
                            </p>

                            <div className="hidden sm:block w-full">
                                <PainPointTicker />
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-center lg:justify-start w-full px-4 sm:px-0">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-8 py-4 sm:py-4.5 bg-accent-green text-black font-black rounded-2xl hover:bg-opacity-90 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 text-base sm:text-lg"
                                >
                                    Sign In
                                </motion.button>

                                <motion.a
                                    whileTap={{ scale: 0.95 }}
                                    href="https://chat.whatsapp.com/H49JywLfKsxAoC8X5wC0yg"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-4 sm:py-4.5 bg-white/5 text-white border border-white/10 font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-base sm:text-lg backdrop-blur-sm"
                                >
                                    <FaWhatsapp className="text-[#25D366]" size={20} />
                                    Join Community
                                </motion.a>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-5 w-full max-w-[360px] sm:hidden">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Safety</p>
                                    <p className="text-xs text-white font-semibold mt-1">Verified IDs</p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Savings</p>
                                    <p className="text-xs text-white font-semibold mt-1">Up to 60%</p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Community</p>
                                    <p className="text-xs text-white font-semibold mt-1">IITM-only</p>
                                </div>
                            </div>

                            <div className="mt-7 sm:mt-12 flex items-center justify-center lg:justify-start gap-4">
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
                    <div className="hidden sm:flex flex-1 justify-center relative">
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
                            className="bg-black border-t sm:border border-white/10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 relative shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
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
                            <div className="text-center mb-7 relative z-10">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight uppercase">
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
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {authMethod === 'google' && (
                                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
                                        <p className="text-sm text-gray-300">
                                            Press submit to continue with Firebase Google sign-in.
                                        </p>
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
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 focus:border-accent-green/50 outline-none transition-all placeholder:text-gray-700 text-white"
                                            />
                                            <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                        </div>
                                        {!emailId.includes('@') && (
                                            <div className="bg-white/10 border border-t-0 sm:border-t sm:border-l-0 border-white/10 rounded-2xl px-4 py-4 text-gray-400 font-medium text-xs flex items-center justify-center whitespace-nowrap">
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
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 focus:border-accent-green/50 outline-none transition-all placeholder:text-gray-700 text-white"
                                        />
                                        <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                    </div>
                                </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading || isGoogleRedirecting || isSyncingGoogleUser}
                                    className="w-full py-4.5 bg-gradient-to-r from-accent-green to-emerald-500 text-black font-black text-lg sm:text-xl rounded-2xl shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:-translate-y-1 active:scale-95 transition-all mt-3 uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading || isGoogleRedirecting || isSyncingGoogleUser ? 'SIGNING IN...' : authMethod === 'google' ? 'Continue with Google' : 'Submit'}
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
