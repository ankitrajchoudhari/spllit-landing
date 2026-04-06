import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaArrowLeft, FaUserCircle, FaEnvelope, FaPhone, FaGraduationCap, FaVenusMars, FaBirthdayCake, FaSave, FaBolt, FaTrophy, FaFireAlt, FaCheckCircle, FaCamera } from 'react-icons/fa';
import useAuthStore from '../store/authStore';

const AnnouncementDrops = lazy(() => import('./AnnouncementDrops'));

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

    const profileFields = [
        profileForm.name,
        profileForm.college,
        profileForm.gender,
        profileForm.dateOfBirth,
        profileForm.phone,
        profileForm.profilePhoto,
        user?.email || ''
    ];
    const completedFieldCount = profileFields.filter((field) => String(field || '').trim().length > 0).length;
    const completionPercent = Math.round((completedFieldCount / profileFields.length) * 100);
    const profileLevel = Math.max(1, Math.ceil(completionPercent / 20));
    const profileXp = completedFieldCount * 120;
    const streakDays = Math.min(14, Math.max(1, completedFieldCount + (user?.isOnline ? 1 : 0)));
    const profileBadges = [
        { key: 'starter', label: 'Starter', unlocked: completedFieldCount >= 2 },
        { key: 'verified', label: 'Verified Vibe', unlocked: Boolean(user?.email) && completedFieldCount >= 4 },
        { key: 'campus', label: 'Campus Connect', unlocked: String(profileForm.college || '').trim().length > 0 },
        { key: 'ready', label: 'Ride Ready', unlocked: completionPercent >= 85 }
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
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <ProfileStatCard icon={FaBolt} title="Level" value={`Lv ${profileLevel}`} tone="emerald" />
                                            <ProfileStatCard icon={FaTrophy} title="XP" value={`${profileXp}`} tone="sky" />
                                            <ProfileStatCard icon={FaFireAlt} title="Streak" value={`${streakDays}d`} tone="orange" />
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
        orange: 'text-orange-300 border-orange-400/30 bg-orange-500/10'
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
        <img
            src={avatar.url}
            alt={avatar.label}
            className="w-full aspect-square rounded-xl object-cover"
            loading="lazy"
        />
        <span className="block mt-1 text-[10px] text-gray-400 capitalize truncate group-hover:text-white">
            {avatar.label}
        </span>
    </button>
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
