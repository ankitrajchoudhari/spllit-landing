import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaArrowLeft, FaUserCircle, FaEnvelope, FaPhone, FaGraduationCap, FaVenusMars, FaBirthdayCake, FaSave } from 'react-icons/fa';
import useAuthStore from '../store/authStore';
import AnnouncementDrops from './AnnouncementDrops';

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

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isHome = location.pathname === '/';
    const hideBackArrowPaths = ['/dashboard', '/admin/dashboard', '/spllit-social'];
    const showBackArrow = !isHome && !hideBackArrowPaths.includes(location.pathname);
    const profileLabel = user?.name?.trim()?.split(' ')?.[0] || 'Profile';
    const authenticatedHomePath = user?.role === 'subadmin' || user?.isAdmin ? '/admin/dashboard' : '/dashboard';
    const logoTarget = isAuthenticated && user ? authenticatedHomePath : '/';

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
                                        <AnnouncementDrops />
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
                                        <AnnouncementDrops />
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
                                <AnnouncementDrops />
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
                                    <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10">
                                        <div>
                                            <h3 className="text-xl sm:text-2xl font-bold text-white">Profile</h3>
                                            <p className="text-xs sm:text-sm text-gray-400">Edit your personal details</p>
                                        </div>
                                        <button
                                            onClick={() => setShowProfileModal(false)}
                                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSaveProfile} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <ProfileField icon={FaUserCircle} label="Name" value={profileForm.name} onChange={(value) => setProfileForm({ ...profileForm, name: value })} />
                                            <ProfileField icon={FaGraduationCap} label="College" value={profileForm.college} onChange={(value) => setProfileForm({ ...profileForm, college: value })} />
                                            <ProfileField icon={FaVenusMars} label="Gender" value={profileForm.gender} onChange={(value) => setProfileForm({ ...profileForm, gender: value })} placeholder="male / female / other" />
                                            <ProfileField icon={FaBirthdayCake} label="Date of Birth" type="date" value={profileForm.dateOfBirth} onChange={(value) => setProfileForm({ ...profileForm, dateOfBirth: value })} />
                                            <ProfileField icon={FaPhone} label="Phone" value={profileForm.phone} onChange={(value) => setProfileForm({ ...profileForm, phone: value })} placeholder="Your phone number" />
                                            <ProfileField icon={FaEnvelope} label="Profile Photo URL" value={profileForm.profilePhoto} onChange={(value) => setProfileForm({ ...profileForm, profilePhoto: value })} placeholder="https://..." />
                                        </div>

                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                            <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Email</p>
                                            <p className="text-white font-semibold break-all">{user.email}</p>
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
