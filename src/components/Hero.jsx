import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaTimes, FaChevronRight, FaWhatsapp, FaBolt, FaShieldAlt, FaWallet } from 'react-icons/fa';

const TypewriterText = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, 15);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, onComplete]);

    return <span>{displayedText}</span>;
}

const CinematicTitle = () => (
    <div className="mb-8 sm:mb-10 relative z-20">
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-green/30 bg-accent-green/10 px-4 py-1.5 mb-6"
        >
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.24em] uppercase text-accent-green">Campus Commute OS</span>
        </motion.div>
        <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-2"
        >
            Split Rides.
            <br />
            Keep the Vibe.
        </motion.h1>
        <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative inline-block"
        >
            <span className="absolute -inset-4 bg-gradient-to-r from-accent-green/20 via-accent-emerald/20 to-accent-lime/20 blur-3xl opacity-50 animate-pulse" />
            <span className="relative font-display bg-gradient-to-r from-accent-green via-accent-emerald to-accent-lime bg-clip-text text-transparent text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight filter drop-shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                Shared Transit, Rewired
            </span>
        </motion.div>
    </div>
);

const statCards = [
    {
        icon: FaBolt,
        title: 'Fast Match',
        value: '< 60 sec',
        description: 'Find nearby riders in moments'
    },
    {
        icon: FaWallet,
        title: 'Average Savings',
        value: 'Up to 60%',
        description: 'Auto split fares without confusion'
    },
    {
        icon: FaShieldAlt,
        title: 'Verified Circle',
        value: '100%',
        description: 'Safer rides with trusted profiles'
    }
];

const Hero = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [chatStep, setChatStep] = useState(0);
    const chatContainerRef = useRef(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatStep]);

    const handleStartEngine = () => {
        setChatOpen(true);
        setChatStep(1);
    };

    const chatMessages = [
        {
            id: 1,
            text: "System initialized. Welcome to Spllit AI. 🤖",
            delay: 0
        },
        {
            id: 2,
            text: "I'm analyzing your commute patterns... 🔄",
            delay: 1500
        },
        {
            id: 3,
            text: "Optimization complete! I can save you 60% on travel costs by matching you with verified professionals. 💼",
            delay: 3500
        },
        {
            id: 4,
            text: "Ready to join the revolution? Stay updated by joining our WhatsApp community!",
            delay: 6000,
            whatsapp: true
        }
    ];

    return (
        <section className="relative min-h-[100dvh] w-full overflow-hidden bg-bg-primary flex items-center justify-center pt-28 sm:pt-32 pb-16">
            {/* Gradient Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(132,204,22,0.10),transparent_24%),radial-gradient(circle_at_50%_85%,rgba(52,211,153,0.12),transparent_35%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center flex flex-col items-center justify-center min-h-[70vh]">
                <AnimatePresence mode="wait">
                    {!chatOpen ? (
                        <motion.div
                            key="hero-content"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }} // Zoom into the matrix effect
                            transition={{ duration: 0.5 }}
                            className="w-full max-w-6xl flex flex-col items-center"
                        >
                            <CinematicTitle />

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="text-text-secondary text-base sm:text-lg md:text-xl max-w-3xl mx-auto mb-10 sm:mb-12 leading-relaxed px-2 sm:px-0"
                            >
                                Experience verified ride-sharing with automated fare splitting, instant settlements, and zero awkward money talks.
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.75 }}
                                className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12 w-full px-4"
                            >
                                <a
                                    href="/login?signin=1"
                                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-gradient-to-r from-accent-green to-accent-emerald text-black font-bold shadow-[0_12px_35px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:scale-95 transition-all text-base sm:text-lg"
                                >
                                    Start Saving Today
                                </a>
                                <button
                                    onClick={handleStartEngine}
                                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-white/20 bg-white/5 text-white font-semibold hover:bg-white/10 active:scale-95 transition-all text-base sm:text-lg backdrop-blur-md"
                                >
                                    See How Spllit Works
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9 }}
                                className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full mb-8"
                            >
                                {statCards.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <article
                                            key={item.title}
                                            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4 text-left"
                                        >
                                            <div className="flex items-center gap-2 text-accent-green mb-2">
                                                <Icon className="text-sm" />
                                                <span className="text-[10px] uppercase tracking-[0.22em] font-bold">{item.title}</span>
                                            </div>
                                            <p className="text-white font-black text-xl sm:text-2xl leading-none">{item.value}</p>
                                            <p className="mt-2 text-xs text-text-secondary">{item.description}</p>
                                        </article>
                                    );
                                })}
                            </motion.div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chat-interface"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-2xl relative z-20 px-4"
                        >
                            <div className="relative bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden flex flex-col max-h-[85vh] md:max-h-[600px] shadow-[0_0_50px_rgba(16,185,129,0.1)]">

                                {/* Fixed Header Status Bar */}
                                <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-md border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1 h-3 items-end">
                                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1 bg-accent-green rounded-full" />
                                            <motion.div animate={{ height: [6, 16, 6] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1 bg-accent-emerald rounded-full" />
                                            <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 1.8, delay: 0.4 }} className="w-1 bg-accent-green rounded-full" />
                                        </div>
                                        <span className="text-[10px] md:text-xs font-mono text-accent-green/80 tracking-[0.2em] uppercase">Intelligence Core</span>
                                    </div>
                                    <button
                                        onClick={() => setChatOpen(false)}
                                        className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white transition-colors border border-white/5 bg-white/5"
                                        aria-label="Close Chat"
                                    >
                                        <FaTimes size={18} />
                                    </button>
                                </div>

                                {/* Scrollable Message Area */}
                                <div
                                    ref={chatContainerRef}
                                    className="flex-1 overflow-y-auto p-6 space-y-8 relative scroll-smooth no-scrollbar"
                                    style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
                                >
                                    {/* Avatar Glow Effect */}
                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-48 pointer-events-none opacity-20 -z-10">
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-accent-green to-accent-emerald blur-3xl animate-pulse" />
                                    </div>

                                    {chatMessages.map((msg, index) => (
                                        <div
                                            key={msg.id}
                                            className={`${chatStep >= index + 1 ? 'block' : 'hidden'} transition-opacity duration-500`}
                                            style={{ opacity: Math.max(0.4, 1 - (chatStep - (index + 1)) * 0.3) }}
                                        >
                                            <motion.div
                                                initial={{ opacity: 0, x: -20, y: 10 }}
                                                animate={{ opacity: 1, x: 0, y: 0 }}
                                                className="flex gap-4 items-start"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-green/20 to-accent-emerald/20 border border-accent-green/30 flex items-center justify-center flex-shrink-0">
                                                    <FaRobot className="text-accent-green text-lg" />
                                                </div>
                                                <div className="flex-1 max-w-[85%]">
                                                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-4 md:p-5 rounded-2xl rounded-tl-none border border-white/10 text-base md:text-lg leading-relaxed shadow-lg relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-accent-green to-transparent opacity-50" />
                                                        {chatStep >= index + 1 && (
                                                            <TypewriterText
                                                                text={msg.text}
                                                                onComplete={() => {
                                                                    if (index < chatMessages.length - 1) {
                                                                        setTimeout(() => setChatStep(index + 2), 1000);
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </div>

                                                    {msg.whatsapp && chatStep >= index + 1 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 1.5 }}
                                                            className="mt-6 flex flex-col gap-4"
                                                        >
                                                            <a
                                                                href="https://chat.whatsapp.com/H49JywLfKsxAoC8X5wC0yg"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold shadow-[0_10px_20px_rgba(37,211,102,0.3)] hover:shadow-[0_15px_30px_rgba(37,211,102,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 group w-full justify-center"
                                                            >
                                                                <FaWhatsapp className="text-2xl animate-bounce" />
                                                                <span>Join WhatsApp Community</span>
                                                                <FaChevronRight className="group-hover:translate-x-1 transition-transform ml-auto" />
                                                            </a>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        </div>
                                    ))}

                                    {/* Bottom padding for scroll */}
                                    <div className="h-10" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default Hero;
