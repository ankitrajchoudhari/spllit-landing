import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaArrowLeft, FaUserCircle, FaEnvelope, FaPhone, FaGraduationCap, FaVenusMars, FaBirthdayCake, FaSave, FaBolt, FaTrophy, FaFireAlt, FaCheckCircle, FaCamera, FaMedal, FaBullseye, FaLock, FaGem } from 'react-icons/fa';
import useAuthStore from '../store/authStore';
import { ridesAPI, matchesAPI } from '../services/api';

const AnnouncementDrops = lazy(() => import('./AnnouncementDrops'));

const extractArrayFromResponse = (response, candidateKeys) => {
    if (Array.isArray(response)) return response;
    for (const key of candidateKeys) {
        if (Array.isArray(response?.[key])) return response[key];
    }
    return [];
};

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: '',
        college: '',
        gender: '',
        dateOfBirth: '',
        phone: '',
        profilePhoto: ''
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
    const [performanceData, setPerformanceData] = useState({
        ridesCreated: 0,
        matchesTotal: 0,
        matchesAccepted: 0,
        matchesCompleted: 0,
        matchesRejected: 0,
        rating: 0,
        activeDaysLast14: 0,
        loadedAt: null
    });
    const [shouldLoadAnnouncements, setShouldLoadAnnouncements] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout, updateProfile, fetchProfile } = useAuthStore();

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const onIdle = () => setShouldLoadAnnouncements(true);

        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(onIdle, { timeout: 1800 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(onIdle, 1200);
        return () => window.clearTimeout(timeoutId);
    }, []);

    const announcementFallback = (
        <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-white/10 bg-white/5"
        />
    );

    const announcementNode = shouldLoadAnnouncements ? (
        <Suspense fallback={announcementFallback}>
            <AnnouncementDrops />
        </Suspense>
    ) : announcementFallback;

    const isHome = location.pathname === '/';
    const hideBackArrowPaths = ['/dashboard', '/admin/dashboard', '/spllit-social'];
    const showBackArrow = !isHome && !hideBackArrowPaths.includes(location.pathname);
    const profileLabel = user?.name?.trim()?.split(' ')?.[0] || 'Profile';
    const authenticatedHomePath = user?.role === 'subadmin' || user?.isAdmin ? '/admin/dashboard' : '/dashboard';
    const logoTarget = isAuthenticated && user ? authenticatedHomePath : '/';
    const performanceCacheKey = user?.id ? `profile-performance-cache-${user.id}` : null;
    const performanceCacheTtlMs = 5 * 60 * 1000;

    const fieldChecks = {
        name: String(profileForm.name || '').trim().length > 0,
        college: String(profileForm.college || '').trim().length > 0,
        gender: String(profileForm.gender || '').trim().length > 0,
        dateOfBirth: String(profileForm.dateOfBirth || '').trim().length > 0,
        phone: String(profileForm.phone || '').trim().length > 0,
        profilePhoto: String(profileForm.profilePhoto || '').trim().length > 0,
        email: String(user?.email || '').trim().length > 0
    };
    const completedFieldCount = Object.values(fieldChecks).filter(Boolean).length;
    const profileCompletionScore =
        (fieldChecks.name ? 15 : 0) +
        (fieldChecks.college ? 15 : 0) +
        (fieldChecks.gender ? 10 : 0) +
        (fieldChecks.dateOfBirth ? 10 : 0) +
        (fieldChecks.phone ? 15 : 0) +
        (fieldChecks.profilePhoto ? 20 : 0) +
        (fieldChecks.email ? 15 : 0);
    const hasPerformanceSignals = performanceData.ridesCreated > 0 || performanceData.matchesTotal > 0 || performanceData.rating > 0;
    const acceptanceRate = performanceData.matchesTotal > 0
        ? Math.round((performanceData.matchesAccepted / performanceData.matchesTotal) * 100)
        : 0;
    const completionRate = performanceData.matchesAccepted > 0
        ? Math.round((performanceData.matchesCompleted / performanceData.matchesAccepted) * 100)
        : 0;
    const activityScore = Math.min(30, performanceData.ridesCreated * 6);
    const acceptanceScore = Math.round(acceptanceRate * 0.25);
    const completionScore = Math.round(completionRate * 0.25);
    const ratingScore = Math.round(Math.max(0, Math.min(100, (performanceData.rating / 5) * 100)) * 0.2);
    const performanceScore = Math.min(100, activityScore + acceptanceScore + completionScore + ratingScore);
    const completionPercent = hasPerformanceSignals
        ? Math.round((profileCompletionScore * 0.45) + (performanceScore * 0.55))
        : Math.min(100, profileCompletionScore);
    const profileLevel = Math.min(10, Math.max(1, Math.ceil(completionPercent / 10)));
    const profileXp = completionPercent * 10;
    const streakDays = hasPerformanceSignals
        ? Math.min(14, Math.max(1, performanceData.activeDaysLast14))
        : Math.min(7, Math.max(1, completedFieldCount + (user?.isOnline ? 1 : 0)));
    const rankTier = completionPercent >= 90
        ? 'Legend'
        : completionPercent >= 75
            ? 'Elite'
            : completionPercent >= 55
                ? 'Pro'
                : completionPercent >= 35
                    ? 'Rookie+'
                    : 'Rookie';
    const currentLevelXpFloor = (profileLevel - 1) * 100;
    const nextLevelXpCap = Math.max(profileLevel * 100, currentLevelXpFloor + 1);
    const levelProgress = Math.max(0, Math.min(100, Math.round(((profileXp - currentLevelXpFloor) / (nextLevelXpCap - currentLevelXpFloor)) * 100)));
    const xpToNextLevel = Math.max(0, nextLevelXpCap - profileXp);
    const missions = [
        { key: 'name', label: 'Set your display name', reward: 120, done: fieldChecks.name },
        { key: 'campus', label: 'Add your college', reward: 140, done: fieldChecks.college },
        { key: 'identity', label: 'Complete gender + DOB', reward: 150, done: fieldChecks.gender && fieldChecks.dateOfBirth },
        { key: 'first-ride', label: 'Create your first ride', reward: 180, done: performanceData.ridesCreated >= 1 },
        { key: 'first-match', label: 'Get first accepted match', reward: 220, done: performanceData.matchesAccepted >= 1 },
        { key: 'phone', label: 'Verify ride contact', reward: 150, done: fieldChecks.phone },
        { key: 'avatar', label: 'Choose avatar style', reward: 180, done: fieldChecks.profilePhoto }
    ];
    const completedMissionCount = missions.filter((mission) => mission.done).length;
    const profileBadges = [
        { key: 'starter', label: 'Starter', unlocked: completedFieldCount >= 2 },
        { key: 'verified', label: 'Verified Vibe', unlocked: Boolean(user?.email) && completedFieldCount >= 4 },
        { key: 'campus', label: 'Campus Connect', unlocked: String(profileForm.college || '').trim().length > 0 },
        { key: 'ready', label: 'Ride Ready', unlocked: completionPercent >= 85 }
    ];
    const achievementCards = [
        { key: 'rookie', label: 'Rookie Setup', hint: 'Reach 40% profile score', unlocked: completionPercent >= 40 },
        { key: 'grinder', label: 'Daily Grinder', hint: 'Keep streak for 7 days', unlocked: streakDays >= 7 },
        { key: 'identity', label: 'Identity Complete', hint: 'Name + gender + DOB', unlocked: fieldChecks.name && fieldChecks.gender && fieldChecks.dateOfBirth },
        { key: 'connector', label: 'Campus Connector', hint: 'Add college + phone', unlocked: fieldChecks.college && fieldChecks.phone },
        { key: 'aesthetic', label: 'Style Locked', hint: 'Pick a profile avatar', unlocked: fieldChecks.profilePhoto },
        { key: 'reliable', label: 'Reliable Rider', hint: '80%+ acceptance rate', unlocked: acceptanceRate >= 80 && performanceData.matchesTotal >= 5 },
        { key: 'legend', label: 'Profile Legend', hint: 'Hit 95% profile score', unlocked: completionPercent >= 95 }
    ];
    const notionFaceCards = useMemo(() => {
        const baseSeed = (profileForm.name || user?.email || 'spllit-user').trim().toLowerCase().replace(/\s+/g, '-');
        const archetypes = [
            'campus',
            'late-night',
            'study-mode',
            'weekend',
            'hustle',
            'chill',
            'creative',
            'sporty'
        ];
        const styles = ['notionists', 'notionists-neutral'];

        return styles.flatMap((style) =>
            archetypes.map((archetype) => {
                const seed = `${baseSeed}-${style}-${archetype}`;
                return {
                    id: seed,
                    label: `${archetype.replace('-', ' ')} ${style === 'notionists' ? 'vibe' : 'alt'}`,
                    url: `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
                };
            })
        );
    }, [profileForm.name, user?.email]);
    const displayName = (profileForm.name || user?.name || 'Spllit Rider').trim();
    const profileInitials = displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((chunk) => chunk[0]?.toUpperCase())
        .join('');
    const selectedFaceLabel = notionFaceCards.find((avatar) => avatar.url === profileForm.profilePhoto)?.label || 'custom avatar';
    const performanceSyncLabel = performanceData.loadedAt
        ? new Date(performanceData.loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Not synced yet';

    const isPublicNavVisible = !isAuthenticated;

    useEffect(() => {
        if (!showProfileModal || !user) return;

        setProfileForm({
            name: user.name || '',
            college: user.college || '',
            gender: user.gender || '',
            dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
            phone: user.phone || '',
            profilePhoto: user.profilePhoto || ''
        });
    }, [showProfileModal, user]);

    const fetchPerformanceData = useCallback(async ({ silent = false } = {}) => {
        if (!isAuthenticated || !user?.id) return;

        if (!silent) {
            setIsLoadingPerformance(true);
        }

        try {
            const [ridesResponse, matchesResponse] = await Promise.all([
                ridesAPI.getMyRides(),
                matchesAPI.getMyMatches()
            ]);

            const rides = extractArrayFromResponse(ridesResponse, ['rides', 'data']);
            const matches = extractArrayFromResponse(matchesResponse, ['matches', 'data']);
            const derivedRidesCreated = rides.filter((ride) => ride?.creator?.id === user.id || ride?.userId === user.id).length;
            const ridesCreated = Math.max(derivedRidesCreated, Number(user?.totalRides) || 0);
            const matchesAccepted = matches.filter((match) => match?.status === 'accepted').length;
            const matchesCompleted = matches.filter((match) => match?.status === 'completed').length;
            const matchesRejected = matches.filter((match) => match?.status === 'rejected').length;

            const twoWeeksAgoMs = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const activeDays = new Set(
                rides
                    .map((ride) => new Date(ride?.createdAt || ride?.departureTime || 0).getTime())
                    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > twoWeeksAgoMs)
                    .map((timestamp) => new Date(timestamp).toISOString().slice(0, 10))
            );

            const nextPerformanceData = {
                ridesCreated,
                matchesTotal: matches.length,
                matchesAccepted,
                matchesCompleted,
                matchesRejected,
                rating: Number(user?.rating) || 0,
                activeDaysLast14: activeDays.size,
                loadedAt: new Date().toISOString()
            };

            setPerformanceData(nextPerformanceData);
            if (performanceCacheKey) {
                localStorage.setItem(
                    performanceCacheKey,
                    JSON.stringify({ timestamp: Date.now(), data: nextPerformanceData })
                );
            }
        } catch {
            setPerformanceData((prev) => {
                const fallbackData = {
                    ...prev,
                    ridesCreated: Math.max(prev.ridesCreated, Number(user?.totalRides) || 0),
                    rating: Number(user?.rating) || prev.rating,
                    loadedAt: new Date().toISOString()
                };

                if (performanceCacheKey) {
                    localStorage.setItem(
                        performanceCacheKey,
                        JSON.stringify({ timestamp: Date.now(), data: fallbackData })
                    );
                }

                return fallbackData;
            });
        } finally {
            if (!silent) {
                setIsLoadingPerformance(false);
            }
        }
    }, [isAuthenticated, user?.id, user?.rating, user?.totalRides, performanceCacheKey]);

    useEffect(() => {
        if (!showProfileModal || !performanceCacheKey) return;

        try {
            const cachedRaw = localStorage.getItem(performanceCacheKey);
            if (!cachedRaw) return;

            const cached = JSON.parse(cachedRaw);
            const isFresh = Date.now() - Number(cached?.timestamp || 0) < performanceCacheTtlMs;
            const cachedData = cached?.data;

            if (!isFresh || !cachedData || typeof cachedData !== 'object') return;

            setPerformanceData((prev) => ({
                ...prev,
                ...cachedData,
                // Keep rating aligned with latest auth state if available.
                rating: Number(user?.rating) || Number(cachedData?.rating) || 0
            }));
        } catch {
            // Ignore malformed cache and continue with API refresh flow.
        }
    }, [showProfileModal, performanceCacheKey, performanceCacheTtlMs, user?.rating]);

    useEffect(() => {
        if (!showProfileModal || !isAuthenticated || !user?.id) {
            return;
        }

        fetchPerformanceData({ silent: false });

        const intervalId = window.setInterval(() => {
            fetchPerformanceData({ silent: true });
        }, 45000);

        const handleFocus = () => {
            fetchPerformanceData({ silent: true });
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [showProfileModal, isAuthenticated, user?.id, fetchPerformanceData]);

    useEffect(() => {
        if (!showProfileModal || !isAuthenticated || !user?.id) return;
        fetchPerformanceData({ silent: true });
    }, [user?.rating, user?.totalRides, user?.updatedAt, showProfileModal, isAuthenticated, user?.id, fetchPerformanceData]);

    const handleProfileClick = () => {
        setShowProfileModal(true);
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsSavingProfile(true);

        try {
            const payload = {
                name: profileForm.name.trim(),
                college: profileForm.college.trim(),
                gender: profileForm.gender,
                phone: profileForm.phone.trim(),
                profilePhoto: profileForm.profilePhoto.trim(),
                dateOfBirth: profileForm.dateOfBirth || null
            };

            const result = await updateProfile(payload);
            if (result.success) {
                await fetchProfile();
                setShowProfileModal(false);
            }
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleLogout = () => {
        setMobileMenuOpen(false);
        setShowProfileModal(false);
        logout();
        navigate('/', { replace: true });
    };

    const handleSignInClick = () => {
        setMobileMenuOpen(false);
        if (location.pathname === '/login') {
            window.dispatchEvent(new CustomEvent('spllit:open-signin-modal'));
            return;
        }
        navigate('/login?signin=1');
    };

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? 'bg-[#07110d]/90 backdrop-blur-2xl border-b border-accent-green/20 py-2 sm:py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
                    : 'bg-transparent py-4 sm:py-5'
                    }`}
            >
                    <div className="container mx-auto px-4 sm:px-6">
                        <div className="flex items-center justify-between gap-4">
                            {/* Logo & Back Button */}
                            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                                {showBackArrow && (
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10 group flex items-center justify-center active:scale-95"
                                        title="Go Back"
                                    >
                                        <FaArrowLeft className="text-xs sm:text-sm group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                )}

                                <Link to={logoTarget} className="flex items-center gap-2 sm:gap-3 group active:scale-95 transition-transform">
                                    <span className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                                        spllit<span className="text-accent-green">.</span>
                                    </span>
                                </Link>
                            </div>

                            {/* Desktop Menu */}
                            <div className="hidden md:flex items-center gap-2">
                                {isPublicNavVisible && (
                                    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-2 py-1 backdrop-blur-xl">
                                        <NavLink to="/about">About Us</NavLink>
                                        <NavLink to="/how-it-works">How It Works</NavLink>
                                        <NavLink to="/features">Features</NavLink>
                                        <NavLink to="/pricing">Pricing</NavLink>
                                    </div>
                                )}

                                {isAuthenticated && user ? (
                                    <div className="flex items-center gap-3">
                                        {announcementNode}
                                        <button
                                            onClick={() => navigate('/spllit-social')}
                                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 px-4 py-2.5 rounded-xl font-semibold transition-all border border-blue-500/20"
                                        >
                                            Spllit Social
                                        </button>
                                        <button
                                            onClick={handleProfileClick}
                                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-semibold transition-all border border-white/10"
                                        >
                                            <FaUserCircle className="text-accent-green text-lg" />
                                            <span>{profileLabel}</span>
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-300 px-4 py-2.5 rounded-xl font-semibold transition-all border border-red-500/20"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        {announcementNode}
                                        <button
                                            onClick={() => navigate('/spllit-social')}
                                            className="px-4 py-2.5 rounded-xl font-semibold transition-all border border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
                                        >
                                            Spllit Social
                                        </button>
                                        <button
                                            onClick={handleSignInClick}
                                            className="bg-gradient-to-r from-accent-green to-accent-emerald text-black px-6 py-2.5 rounded-xl font-semibold hover:shadow-[0_0_26px_rgba(16,185,129,0.45)] transition-all transform hover:-translate-y-0.5 active:scale-95"
                                        >
                                            Sign In
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="md:hidden flex items-center gap-2">
                                {announcementNode}
                                {/* Mobile Menu Button - Styled better for touch */}
                                <button
                                    className="text-white w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 active:bg-white/10 active:scale-95 transition-all"
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                >
                                    {mobileMenuOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    <AnimatePresence>
                        {mobileMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="md:hidden bg-[#07110d]/95 backdrop-blur-2xl border-b border-accent-green/20 overflow-hidden"
                            >
                                <div className="container mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-2">
                                    {!isAuthenticated && (
                                        <>
                                            <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>Home</MobileNavLink>
                                            <MobileNavLink to="/about" onClick={() => setMobileMenuOpen(false)}>About Us</MobileNavLink>
                                            <MobileNavLink to="/how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</MobileNavLink>
                                            <MobileNavLink to="/features" onClick={() => setMobileMenuOpen(false)}>Features</MobileNavLink>
                                            <MobileNavLink to="/pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</MobileNavLink>
                                            <MobileNavLink to="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</MobileNavLink>
                                            <div className="h-px bg-white/10 my-2"></div>
                                        </>
                                    )}
                                    {isAuthenticated && user ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setMobileMenuOpen(false);
                                                    navigate('/spllit-social');
                                                }}
                                                className="bg-blue-500/10 text-blue-300 px-6 py-3 rounded-xl font-semibold w-full border border-blue-500/20"
                                            >
                                                Spllit Social
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setMobileMenuOpen(false);
                                                    handleProfileClick();
                                                }}
                                                className="bg-white/5 text-white px-6 py-3 rounded-xl font-semibold w-full border border-white/10"
                                            >
                                                {profileLabel} Profile
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setMobileMenuOpen(false);
                                                    handleLogout();
                                                }}
                                                className="bg-red-500/10 text-red-300 px-6 py-3 rounded-xl font-semibold w-full border border-red-500/20"
                                            >
                                                Logout
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setMobileMenuOpen(false);
                                                    navigate('/spllit-social');
                                                }}
                                                className="bg-white/5 text-white px-6 py-3 rounded-xl font-semibold w-full border border-white/15"
                                            >
                                                Spllit Social
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleSignInClick();
                                                }}
                                                className="bg-gradient-to-r from-accent-green to-accent-emerald text-black px-6 py-3 rounded-xl font-semibold w-full"
                                            >
                                                Sign In
                                            </button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Profile Modal */}
                    <AnimatePresence>
                        {showProfileModal && isAuthenticated && user && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                                onClick={() => setShowProfileModal(false)}
                            >
                                <motion.div
                                    initial={{ y: 24, scale: 0.96, opacity: 0 }}
                                    animate={{ y: 0, scale: 1, opacity: 1 }}
                                    exit={{ y: 24, scale: 0.96, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full max-w-2xl rounded-3xl border border-white/10 bg-bg-secondary shadow-2xl overflow-hidden"
                                >
                                    <div className="relative px-5 sm:px-6 py-5 border-b border-white/10 overflow-hidden">
                                        <div className="pointer-events-none absolute -top-10 right-8 w-40 h-40 rounded-full bg-accent-green/20 blur-3xl" />
                                        <div className="pointer-events-none absolute top-10 -left-8 w-32 h-32 rounded-full bg-cyan-400/10 blur-3xl" />
                                        <div>
                                            <h3 className="text-xl sm:text-2xl font-bold text-white">Profile Dashboard</h3>
                                            <p className="text-xs sm:text-sm text-gray-400">Level up your profile and unlock badges</p>
                                        </div>
                                        <button
                                            onClick={() => setShowProfileModal(false)}
                                            className="absolute right-5 top-5 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSaveProfile} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 sm:p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                                                <div className="relative mx-auto sm:mx-0">
                                                    <div className="w-28 h-28 rounded-full p-[3px] bg-gradient-to-br from-accent-green via-cyan-400 to-emerald-300 shadow-[0_0_32px_rgba(16,185,129,0.3)]">
                                                        <div className="w-full h-full rounded-full bg-[#07110d] flex items-center justify-center overflow-hidden">
                                                            {profileForm.profilePhoto ? (
                                                                <img
                                                                    src={profileForm.profilePhoto}
                                                                    alt={displayName}
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <span className="text-2xl font-black tracking-wide text-white">{profileInitials || 'SR'}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-[#07110d] bg-accent-green" />
                                                </div>

                                                <div className="flex-1 text-center sm:text-left">
                                                    <p className="text-xl font-black text-white leading-tight">{displayName}</p>
                                                    <p className="text-xs text-gray-400 break-all mt-1">{user.email}</p>
                                                    <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                                                        <span className="px-3 py-1 rounded-full text-xs font-semibold border border-accent-green/35 bg-accent-green/15 text-accent-green">
                                                            Level {profileLevel}
                                                        </span>
                                                        <span className="px-3 py-1 rounded-full text-xs font-semibold border border-amber-300/35 bg-amber-300/10 text-amber-200">
                                                            {rankTier}
                                                        </span>
                                                        <span className="px-3 py-1 rounded-full text-xs font-semibold border border-cyan-400/35 bg-cyan-400/10 text-cyan-300 capitalize">
                                                            {selectedFaceLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <ProfileStatCard icon={FaBolt} title="Level" value={`Lv ${profileLevel}`} tone="emerald" />
                                            <ProfileStatCard icon={FaTrophy} title="XP" value={`${profileXp}`} tone="sky" />
                                            <ProfileStatCard icon={FaFireAlt} title="Streak" value={`${streakDays}d`} tone="orange" />
                                            <ProfileStatCard icon={FaMedal} title="Rank" value={rankTier} tone="violet" />
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Performance Snapshot</p>
                                                <p className="text-xs text-gray-500">{isLoadingPerformance ? 'Syncing...' : `Synced ${performanceSyncLabel}`}</p>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <MetricMini label="Rides" value={performanceData.ridesCreated} />
                                                <MetricMini label="Accepted" value={performanceData.matchesAccepted} />
                                                <MetricMini label="Accept Rate" value={`${acceptanceRate}%`} />
                                                <MetricMini label="Rating" value={performanceData.rating > 0 ? Number(performanceData.rating).toFixed(1) : 'N/A'} />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Level Progress</p>
                                                <p className="text-sm font-semibold text-white">{levelProgress}%</p>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500"
                                                    style={{ width: `${levelProgress}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-3">
                                                {xpToNextLevel === 0 ? 'Max level reached for current profile system.' : `${xpToNextLevel} XP to next level`}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Profile Completion</p>
                                                <p className="text-sm font-semibold text-white">{completionPercent}%</p>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-accent-green to-cyan-400 transition-all duration-500"
                                                    style={{ width: `${completionPercent}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-3">
                                                {completionPercent >= 85 ? 'You are profile-pro. Keep it updated!' : 'Complete a few more details to unlock Ride Ready badge.'}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <FaBullseye className="text-cyan-300" />
                                                    <p className="text-xs uppercase tracking-wider text-gray-400">Missions</p>
                                                </div>
                                                <p className="text-xs text-gray-400">{completedMissionCount}/{missions.length}</p>
                                            </div>
                                            <div className="space-y-2">
                                                {missions.map((mission) => (
                                                    <MissionRow key={mission.key} mission={mission} />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <FaTrophy className="text-amber-300" />
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Badges</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {profileBadges.map((badge) => (
                                                    <ProfileBadgeChip key={badge.key} label={badge.label} unlocked={badge.unlocked} />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <FaGem className="text-fuchsia-300" />
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Achievements</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {achievementCards.map((achievement) => (
                                                    <AchievementCard key={achievement.key} achievement={achievement} />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <p className="text-xs uppercase tracking-wider text-gray-400">Notion Faces</p>
                                                <p className="text-[11px] text-gray-500">Tap to set avatar</p>
                                            </div>
                                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                {notionFaceCards.map((avatar) => (
                                                    <AvatarProfileCard
                                                        key={avatar.id}
                                                        avatar={avatar}
                                                        isSelected={profileForm.profilePhoto === avatar.url}
                                                        onSelect={(url) => setProfileForm({ ...profileForm, profilePhoto: url })}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <ProfileField icon={FaUserCircle} label="Name" value={profileForm.name} onChange={(value) => setProfileForm({ ...profileForm, name: value })} />
                                            <ProfileField icon={FaGraduationCap} label="College" value={profileForm.college} onChange={(value) => setProfileForm({ ...profileForm, college: value })} />
                                            <ProfileField icon={FaVenusMars} label="Gender" value={profileForm.gender} onChange={(value) => setProfileForm({ ...profileForm, gender: value })} placeholder="male / female / other" />
                                            <ProfileField icon={FaBirthdayCake} label="Date of Birth" type="date" value={profileForm.dateOfBirth} onChange={(value) => setProfileForm({ ...profileForm, dateOfBirth: value })} />
                                            <ProfileField icon={FaPhone} label="Phone" value={profileForm.phone} onChange={(value) => setProfileForm({ ...profileForm, phone: value })} placeholder="Your phone number" />
                                            <ProfileField icon={FaEnvelope} label="Profile Photo URL" value={profileForm.profilePhoto} onChange={(value) => setProfileForm({ ...profileForm, profilePhoto: value })} placeholder="https://..." />
                                        </div>

                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                                            <div>
                                            <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Email</p>
                                            <p className="text-white font-semibold break-all">{user.email}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-full border border-white/10 bg-black/20 flex items-center justify-center shrink-0">
                                                {profileForm.profilePhoto ? (
                                                    <img
                                                        src={profileForm.profilePhoto}
                                                        alt="Profile"
                                                        className="w-full h-full object-cover rounded-full"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <FaCamera className="text-accent-green" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setShowProfileModal(false)}
                                                className="px-5 py-3 rounded-xl border border-white/10 text-white bg-white/5 hover:bg-white/10"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSavingProfile}
                                                className="px-5 py-3 rounded-xl bg-accent-green text-black font-bold hover:bg-accent-green/90 disabled:opacity-60 flex items-center justify-center gap-2"
                                            >
                                                <FaSave />
                                                {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </nav>
            </>
        );
    };

const NavLink = ({ to, children }) => {
    return (
        <Link to={to} className="px-3 py-2 text-sm text-text-secondary hover:text-white transition-colors font-semibold rounded-xl hover:bg-white/10">
            {children}
        </Link>
    );
};

const MobileNavLink = ({ to, onClick, children }) => (
    <Link
        to={to}
        onClick={onClick}
        className="px-4 py-3 text-text-secondary hover:text-white hover:bg-white/10 rounded-xl transition-all font-semibold border border-white/5"
    >
        {children}
    </Link>
);

const ProfileStatCard = ({ icon: Icon, title, value, tone }) => {
    const toneClasses = {
        emerald: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
        sky: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
        orange: 'text-orange-300 border-orange-400/30 bg-orange-500/10',
        violet: 'text-violet-300 border-violet-400/30 bg-violet-500/10'
    };

    return (
        <div className={`rounded-2xl border p-3 ${toneClasses[tone] || toneClasses.emerald}`}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white/70">{title}</p>
                <Icon className="text-sm" />
            </div>
            <p className="text-lg font-black mt-2 text-white">{value}</p>
        </div>
    );
};

const ProfileBadgeChip = ({ label, unlocked }) => (
    <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${unlocked
            ? 'border-accent-green/40 bg-accent-green/15 text-accent-green'
            : 'border-white/10 bg-white/5 text-gray-400'
            }`}
    >
        <FaCheckCircle className={unlocked ? 'text-accent-green' : 'text-gray-500'} />
        {label}
    </span>
);

const AvatarProfileCard = ({ avatar, isSelected, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(avatar.url)}
        className={`group rounded-2xl p-2 border transition-all ${isSelected
            ? 'border-accent-green bg-accent-green/15'
            : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/10'
            }`}
        title={`Set ${avatar.label} avatar`}
    >
        <div className={`mx-auto w-full max-w-[56px] aspect-square rounded-full p-[2px] ${isSelected ? 'bg-gradient-to-br from-accent-green to-cyan-300' : 'bg-white/10'}`}>
            <img
                src={avatar.url}
                alt={avatar.label}
                className="w-full h-full rounded-full object-cover bg-[#08120e]"
                loading="lazy"
            />
        </div>
        <span className="block mt-1 text-[10px] text-gray-400 capitalize truncate group-hover:text-white">
            {avatar.label}
        </span>
    </button>
);

const MetricMini = ({ label, value }) => (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-bold text-white mt-1">{value}</p>
    </div>
);

const MissionRow = ({ mission }) => (
    <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${mission.done
            ? 'border-accent-green/30 bg-accent-green/10'
            : 'border-white/10 bg-black/20'
            }`}
    >
        <div className="flex items-center gap-2 min-w-0">
            <FaCheckCircle className={mission.done ? 'text-accent-green' : 'text-gray-500'} />
            <p className={`text-sm truncate ${mission.done ? 'text-white' : 'text-gray-300'}`}>{mission.label}</p>
        </div>
        <span className="text-[11px] font-semibold text-cyan-300 shrink-0">+{mission.reward} XP</span>
    </div>
);

const AchievementCard = ({ achievement }) => (
    <div
        className={`rounded-xl border px-3 py-2 ${achievement.unlocked
            ? 'border-fuchsia-400/30 bg-fuchsia-500/10'
            : 'border-white/10 bg-black/20'
            }`}
    >
        <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${achievement.unlocked ? 'text-fuchsia-200' : 'text-gray-300'}`}>
                {achievement.label}
            </p>
            {achievement.unlocked ? <FaGem className="text-fuchsia-300" /> : <FaLock className="text-gray-500" />}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{achievement.hint}</p>
    </div>
);

const ProfileField = ({ icon: Icon, label, value, onChange, type = 'text', placeholder = '' }) => (
    <label className="block">
        <span className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">{label}</span>
        <div className="mt-2 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus-within:border-accent-green/50 transition-colors">
            <Icon className="text-accent-green" />
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent outline-none text-white placeholder-gray-500"
            />
        </div>
    </label>
);

export default Navbar;
