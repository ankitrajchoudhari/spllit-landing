import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaHandshake, FaCreditCard, FaCar } from 'react-icons/fa';

const steps = [
    {
        id: '01',
        icon: FaMapMarkerAlt,
        title: 'Drop Your Route',
        description: 'Enter pickup and drop once, and Spllit finds the ride pattern around you.',
        badge: 'Input'
    },
    {
        id: '02',
        icon: FaHandshake,
        title: 'Get Matched Fast',
        description: 'Connect with verified riders heading in the same direction and time window.',
        badge: 'Match'
    },
    {
        id: '03',
        icon: FaCreditCard,
        title: 'Auto Split Fare',
        description: 'The app calculates each share and handles settlement without awkward reminders.',
        badge: 'Payment'
    },
    {
        id: '04',
        icon: FaCar,
        title: 'Ride and Repeat',
        description: 'Track your savings, keep your commute smooth, and make it a daily habit.',
        badge: 'Commute'
    }
];

const triggerConfetti = async () => {
    try {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default;
        const duration = 2200;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 26, spread: 280, ticks: 60, zIndex: 0 };

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }

            const particleCount = 42 * (timeLeft / duration);

            confetti({
                ...defaults,
                particleCount,
                origin: { x: 0.2, y: 0.25 }
            });

            confetti({
                ...defaults,
                particleCount,
                origin: { x: 0.8, y: 0.25 }
            });
        }, 240);
    } catch (_error) {
        // Ignore visual-only failures so flow remains smooth on weak networks.
    }
};

const HowItWorks = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (activeStep === steps.length - 1) {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }
            triggerConfetti();
        }
    }, [activeStep]);

    const progress = ((activeStep + 1) / steps.length) * 100;

    return (
        <section id="how-it-works" className="py-20 sm:py-24 bg-bg-secondary relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-accent-green/10 blur-[140px] rounded-full" />
                <div className="absolute -bottom-20 right-0 w-72 h-72 bg-accent-emerald/10 blur-3xl rounded-full" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-green/25 bg-accent-green/10 backdrop-blur-md mb-6"
                    >
                        <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                        <span className="text-[11px] font-bold tracking-[0.28em] text-accent-green uppercase">How It Works</span>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 tracking-tight"
                    >
                        Four taps from route to ride.
                    </motion.h2>
                    <p className="text-text-secondary text-base sm:text-lg">
                        {isMobile ? 'Tap any card to preview each step.' : 'Hover or tap each step to see the full flow.'}
                    </p>
                </div>

                <div className="max-w-6xl mx-auto rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-6 lg:p-8">
                    <div className="relative mb-6 sm:mb-8">
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                                initial={{ width: '0%' }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                                className="h-full rounded-full bg-gradient-to-r from-accent-green via-accent-emerald to-accent-lime"
                            />
                        </div>
                    </div>

                    <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isActive = activeStep === index;
                            const isComplete = index <= activeStep;

                            return (
                                <motion.button
                                    key={step.id}
                                    type="button"
                                    whileHover={{ y: -3 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setActiveStep(index)}
                                    className={`text-left rounded-2xl border transition-all duration-300 p-4 sm:p-5 ${isActive
                                        ? 'border-accent-green/45 bg-gradient-to-br from-accent-green/16 to-white/5 shadow-[0_12px_28px_rgba(16,185,129,0.2)]'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent-green">Step {step.id}</span>
                                        <span className={`text-[10px] px-2 py-1 rounded-full border ${isComplete ? 'border-accent-green/40 bg-accent-green/20 text-accent-green' : 'border-white/15 text-white/60'}`}>
                                            {step.badge}
                                        </span>
                                    </div>

                                    <div className={`mt-3 w-12 h-12 rounded-xl border flex items-center justify-center ${isComplete ? 'border-accent-green/40 bg-accent-green/20 text-accent-green' : 'border-white/15 bg-black/20 text-white/65'}`}>
                                        <Icon className="text-lg" />
                                    </div>

                                    <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
                                    <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.description}</p>
                                </motion.button>
                            );
                        })}
                    </div>

                    <motion.div
                        key={steps[activeStep].id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-5 sm:mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
                    >
                        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent-green">Now Active</p>
                        <h4 className="mt-2 text-xl font-bold text-white">{steps[activeStep].title}</h4>
                        <p className="mt-2 text-sm sm:text-base text-text-secondary leading-relaxed">{steps[activeStep].description}</p>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
