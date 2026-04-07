import React, { useEffect, useMemo, useState } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';
import { FaArrowRight, FaBolt, FaMapMarkerAlt, FaPause, FaPlay, FaShieldAlt, FaStar, FaUsers, FaWallet, FaCheckCircle } from 'react-icons/fa';

const heroModes = [
    {
        id: 'ride',
        label: 'Ride instantly',
        headline: 'Find the vibe, lock the seat.',
        copy: 'Turn a boring commute into a fast, verified, social ride with real-time matching.',
        stat: 'Under 60 sec',
        accent: 'from-accent-green via-emerald-400 to-cyan-400',
        icon: FaBolt,
        lottieUrl: 'https://assets5.lottiefiles.com/packages/lf20_u4yrau.json'
    },
    {
        id: 'save',
        label: 'Save money',
        headline: 'Split smart, spend less.',
        copy: 'Auto fare splitting and verified riders mean less friction and more savings every single day.',
        stat: 'Up to 60% saved',
        accent: 'from-blue-500 via-cyan-400 to-accent-green',
        icon: FaWallet,
        lottieUrl: 'https://assets9.lottiefiles.com/packages/lf20_m6j5igxb.json'
    },
    {
        id: 'trust',
        label: 'Ride safe',
        headline: 'Verified circle energy.',
        copy: 'Profiles, trust signals, and route clarity keep the whole experience calm, clear, and premium.',
        stat: 'Verified network',
        accent: 'from-violet-500 via-fuchsia-500 to-pink-500',
        icon: FaShieldAlt,
        lottieUrl: 'https://assets9.lottiefiles.com/packages/lf20_ydo1amjm.json'
    }
];

const actionAnimations = {
    primary: 'https://assets5.lottiefiles.com/packages/lf20_u4yrau.json',
    secondary: 'https://assets9.lottiefiles.com/packages/lf20_m6j5igxb.json'
};

const trustCards = [
    { icon: FaUsers, label: 'Early riders', value: '100+' },
    { icon: FaStar, label: 'Trust score', value: '4.9/5' },
    { icon: FaCheckCircle, label: 'Safety first', value: 'Verified' }
];

const Hero = () => {
    const [heroAssets, setHeroAssets] = useState({});
    const [activeMode, setActiveMode] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [primaryHover, setPrimaryHover] = useState(false);
    const [secondaryHover, setSecondaryHover] = useState(false);
    const [allowMotion, setAllowMotion] = useState(true);

    const avatarUrl = useMemo(
        () => 'https://api.dicebear.com/9.x/notionists-neutral/svg?seed=spllit-genz-hero',
        []
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updateMotion = () => setAllowMotion(!mediaQuery.matches);
        updateMotion();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updateMotion);
            return () => mediaQuery.removeEventListener('change', updateMotion);
        }

        mediaQuery.addListener(updateMotion);
        return () => mediaQuery.removeListener(updateMotion);
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadAnimation = async (url, key) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return;
                const data = await response.json();
                if (mounted) {
                    setHeroAssets((prev) => ({ ...prev, [key]: data }));
                }
            } catch {
                // Keep the gradient fallback if the animation is unavailable.
            }
        };

        heroModes.forEach((mode) => loadAnimation(mode.lottieUrl, mode.id));
        loadAnimation(actionAnimations.primary, 'primary-action');
        loadAnimation(actionAnimations.secondary, 'secondary-action');

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!allowMotion || isHovered) return;

        const interval = window.setInterval(() => {
            setActiveMode((prev) => (prev + 1) % heroModes.length);
        }, 4200);

        return () => window.clearInterval(interval);
    }, [allowMotion, isHovered]);

    const active = heroModes[activeMode];
    const ActiveIcon = active.icon;

    return (
        <section className="relative overflow-hidden bg-bg-primary pt-24 sm:pt-28 pb-14 sm:pb-18">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.12),transparent_20%),radial-gradient(circle_at_50%_90%,rgba(168,85,247,0.10),transparent_24%)]" />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-black/10 to-black/35" />

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.92fr] xl:gap-14">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-3xl"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full border border-accent-green/25 bg-accent-green/10 px-4 py-2 mb-6 backdrop-blur-md">
                            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                            <span className="text-[10px] sm:text-xs font-bold tracking-[0.28em] uppercase text-accent-green">Gen Z Ride Command Center</span>
                        </div>

                        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-black leading-[0.95] tracking-tight text-white">
                            Move smart.
                            <span className="block bg-gradient-to-r from-accent-green via-cyan-400 to-accent-lime bg-clip-text text-transparent">
                                Ride together.
                            </span>
                        </h1>

                        <p className="mt-5 max-w-2xl text-base sm:text-lg md:text-xl leading-relaxed text-text-secondary">
                            A campus-first ride experience with clear matching, verified profiles, and a UI that feels fast, simple, and trustworthy.
                        </p>

                        <div className="mt-8 grid gap-3 sm:grid-cols-3">
                            {trustCards.map((card) => {
                                const CardIcon = card.icon;
                                return (
                                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
                                        <div className="flex items-center gap-2 text-accent-green text-xs font-semibold uppercase tracking-[0.2em]">
                                            <CardIcon className="text-sm" />
                                            {card.label}
                                        </div>
                                        <div className="mt-2 text-white text-xl font-black leading-none">{card.value}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-4">
                            <a
                                href="/login?signin=1"
                                onMouseEnter={() => setPrimaryHover(true)}
                                onMouseLeave={() => setPrimaryHover(false)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent-green to-accent-emerald px-7 py-4 font-bold text-black shadow-[0_16px_40px_rgba(16,185,129,0.28)] transition-transform hover:-translate-y-0.5 active:scale-95"
                            >
                                <span className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-black/10">
                                    {heroAssets['primary-action'] ? (
                                        <Lottie animationData={heroAssets['primary-action']} autoplay={allowMotion && primaryHover} loop={allowMotion} className="h-7 w-7" />
                                    ) : (
                                        <FaArrowRight />
                                    )}
                                </span>
                                Start Saving Today
                            </a>
                            <a
                                href="#how-it-works"
                                onMouseEnter={() => setSecondaryHover(true)}
                                onMouseLeave={() => setSecondaryHover(false)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 active:scale-95"
                            >
                                <span className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white/5">
                                    {heroAssets['secondary-action'] ? (
                                        <Lottie animationData={heroAssets['secondary-action']} autoplay={allowMotion && secondaryHover} loop={allowMotion} className="h-7 w-7" />
                                    ) : (
                                        <FaArrowRight />
                                    )}
                                </span>
                                See how it works
                            </a>
                        </div>

                        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">100+ early riders</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Auto split fares</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">UPI-ready flow</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.65, delay: 0.1 }}
                        className="relative"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-accent-green/18 via-cyan-400/10 to-fuchsia-500/12 blur-3xl opacity-70" />
                        <div className="relative rounded-[2rem] border border-white/10 bg-[#0b120d]/92 p-4 sm:p-5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl overflow-hidden">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-green/60 to-transparent" />

                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-text-muted">Live vibe</p>
                                    <p className="mt-1 text-lg sm:text-xl font-bold text-white">{active.label}</p>
                                </div>
                                <button type="button" onClick={() => setActiveMode((prev) => (prev + 1) % heroModes.length)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10">
                                    {allowMotion && !isHovered ? <FaPause /> : <FaPlay />}
                                    {allowMotion && !isHovered ? 'Pause' : 'Cycle'}
                                </button>
                            </div>

                            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="max-w-xl">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-text-secondary">
                                            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                                            {active.stat}
                                        </div>
                                        <h2 className="mt-4 text-2xl sm:text-3xl font-black leading-tight text-white">{active.headline}</h2>
                                        <p className="mt-3 text-sm sm:text-base leading-relaxed text-text-secondary">{active.copy}</p>
                                    </div>

                                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 text-white/90 shadow-lg">
                                        <ActiveIcon className="text-xl text-accent-green" />
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-4 sm:grid-cols-[1.05fr_0.95fr] items-stretch">
                                    <div className="rounded-[1.25rem] border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 sm:p-4 min-h-[260px] flex items-center justify-center">
                                        <div className="mx-auto aspect-square w-full max-w-[260px]">
                                            {heroAssets[active.id] ? (
                                                <Lottie animationData={heroAssets[active.id]} autoplay={allowMotion} loop={allowMotion} className="h-full w-full" />
                                            ) : (
                                                <div className={`h-full w-full rounded-full bg-gradient-to-br ${active.accent} opacity-30 blur-2xl`} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-14 w-14 shrink-0 rounded-full border border-white/15 bg-gradient-to-br from-accent-green/25 via-cyan-400/20 to-blue-500/20 p-1">
                                                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#08110d]">
                                                        <img src={avatarUrl} alt="Spllit avatar" className="h-full w-full object-cover" loading="lazy" />
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Profile vibe</p>
                                                    <p className="truncate text-base font-bold text-white">Verified Gen Z rider</p>
                                                    <p className="text-xs text-text-secondary">Clean identity, easy scanning, no crowded stack.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                                            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Motion logic</p>
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                {heroModes.map((mode, index) => {
                                                    const ModeIcon = mode.icon;
                                                    const isActive = index === activeMode;

                                                    return (
                                                        <button
                                                            key={mode.id}
                                                            type="button"
                                                            onClick={() => setActiveMode(index)}
                                                            className={`rounded-2xl border px-3 py-3 text-left transition-all ${isActive ? 'border-accent-green/40 bg-accent-green/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                                        >
                                                            <ModeIcon className={`text-sm ${isActive ? 'text-accent-green' : 'text-text-secondary'}`} />
                                                            <div className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${isActive ? 'text-white' : 'text-text-muted'}`}>
                                                                {mode.label}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
