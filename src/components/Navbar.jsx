import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaArrowLeft } from 'react-icons/fa';

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

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

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? 'bg-bg-primary/80 backdrop-blur-xl border-b border-accent-green/10 py-3 shadow-lg'
                    : 'bg-transparent py-6'
                    }`}
            >
                <div className="container mx-auto px-6">
                    <div className="flex items-center justify-between">
                        {/* Logo & Back Button */}
                        <div className="flex items-center gap-2 md:gap-4">
                            {!isHome && (
                                <button
                                    onClick={() => navigate(-1)}
                                    className="p-1.5 md:p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-colors border border-white/10 group flex items-center justify-center"
                                    title="Go Back"
                                >
                                    <FaArrowLeft className="text-xs md:text-base group-hover:-translate-x-0.5 transition-transform" />
                                </button>
                            )}

                            <Link to="/" className="flex items-center gap-3 group">
                                <span className="text-2xl font-bold text-white tracking-tight">
                                    spllit<span className="text-accent-green">.</span>
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-1">
                            <NavLink to="/about">About Us</NavLink>
                            <NavLink to="/how-it-works">How It Works</NavLink>
                            <NavLink to="/features">Features</NavLink>
                            <NavLink to="/pricing">Pricing</NavLink>

                            <div className="w-px h-6 bg-white/10 mx-4"></div>

                            <button
                                onClick={() => navigate('/login?signin=1')}
                                className="bg-gradient-to-r from-accent-green to-accent-emerald text-white px-6 py-2.5 rounded-xl font-semibold hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all transform hover:-translate-y-0.5 active:scale-95"
                            >
                                Sign In
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden text-white p-2 text-2xl"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
                        </button>
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
                            className="md:hidden bg-bg-secondary/95 backdrop-blur-xl border-b border-accent-green/20 overflow-hidden"
                        >
                            <div className="container mx-auto px-6 py-6 flex flex-col gap-2">
                                <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>Home</MobileNavLink>
                                <MobileNavLink to="/about" onClick={() => setMobileMenuOpen(false)}>About Us</MobileNavLink>
                                <MobileNavLink to="/how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</MobileNavLink>
                                <MobileNavLink to="/features" onClick={() => setMobileMenuOpen(false)}>Features</MobileNavLink>
                                <MobileNavLink to="/pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</MobileNavLink>
                                <MobileNavLink to="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</MobileNavLink>
                                <div className="h-px bg-white/10 my-2"></div>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        navigate('/login?signin=1');
                                    }}
                                    className="bg-gradient-to-r from-accent-green to-accent-emerald text-white px-6 py-3 rounded-xl font-semibold w-full"
                                >
                                    Sign In
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </>
    );
};

const NavLink = ({ to, children }) => {
    return (
        <Link to={to} className="px-4 py-2 text-text-secondary hover:text-white transition-colors font-medium rounded-lg hover:bg-white/5">
            {children}
        </Link>
    );
};

const MobileNavLink = ({ to, onClick, children }) => (
    <Link
        to={to}
        onClick={onClick}
        className="px-4 py-3 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium"
    >
        {children}
    </Link>
);

export default Navbar;
