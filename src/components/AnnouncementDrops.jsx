import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBullhorn, FaClock, FaImage, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import { announcementsAPI } from '../services/api';

const formatAnnouncementTime = (value) => {
    if (!value) return 'Just now';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

const AnnouncementDrops = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [latestId, setLatestId] = useState(null);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await announcementsAPI.getPublicAnnouncements();
            const items = Array.isArray(response?.announcements) ? response.announcements : [];
            setAnnouncements(items);

            // If there's a new announcement, show a 4-second popup
            if (items.length > 0) {
                const newest = items[0].id;
                if (newest !== latestId) {
                    setLatestId(newest);
                    setShowPopup(true);
                    setTimeout(() => setShowPopup(false), 8000); // 8 seconds to be safe for reading
                }
            }
        } catch (error) {
            console.error('Failed to load public announcements:', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnnouncements();
    }, []);

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open]);

    const latest = announcements[0];

    return (
        <div className="relative">
            {/* 1. Floating Action Button (Compact Icon Only on Mobile) */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpen(true)}
                className="group relative flex items-center gap-2 rounded-full sm:rounded-2xl border border-accent-green/30 bg-[#07110d]/90 p-2 sm:p-4 text-white shadow-[0_8px_32px_rgba(16,185,129,0.3)] backdrop-blur-xl transition-all hover:bg-accent-green/10"
            >
                <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full sm:rounded-xl bg-accent-green/20 border border-accent-green/30 text-accent-green">
                    <FaBullhorn className="text-lg sm:text-2xl" />
                    {announcements.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent-green animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                    )}
                </div>
                <div className="text-left hidden sm:block pr-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green opacity-80 leading-none mb-1">Campus Drops</p>
                    <p className="font-display font-bold text-sm tracking-tight leading-none">Stay Updated</p>
                </div>
            </motion.button>

            {/* 2. Auto-Popup (4-8 seconds) - Improved for visibility and centering */}
            <AnimatePresence>
                {showPopup && latest && !open && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="fixed right-4 sm:absolute sm:right-0 top-32 sm:top-24 z-[100] w-[min(90vw,320px)] rounded-3xl border border-accent-green/30 bg-[#0a0a0a]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-green">Broadcast Alert</span>
                            </div>
                            <button
                                onClick={() => setShowPopup(false)}
                                className="rounded-full bg-white/5 p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <FaTimes size={12} />
                            </button>
                        </div>
                        <div className="mt-4 flex gap-3 cursor-pointer group" onClick={() => { setOpen(true); setShowPopup(false); }}>
                            {latest.imageUrl && (
                                <div className="h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-accent-green/50 transition-colors">
                                    <img src={latest.imageUrl} className="h-full w-full object-cover" alt="drop" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs font-black text-white line-clamp-1 group-hover:text-accent-green transition-colors">{latest.title}</p>
                                <p className="mt-1 text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{latest.message}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setOpen(true); setShowPopup(false); }}
                            className="mt-5 w-full rounded-xl bg-accent-green py-2.5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-accent-emerald transition-colors shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                        >
                            Open Full Feed
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Full Screen Modal (The Feed) */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-xl p-0 sm:p-4"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 100 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 100 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-5xl h-[94vh] sm:h-auto sm:max-h-[92vh] overflow-hidden flex flex-col rounded-t-[2.5rem] sm:rounded-3xl border border-white/10 bg-[#050505] shadow-[0_0_80px_rgba(0,0,0,0.8)]"
                        >
                            {/* Header */}
                            <div className="relative flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-6 sm:px-10 py-6 sm:py-8">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-accent-green text-[10px] sm:text-xs font-black uppercase tracking-[0.4em]">
                                        <FaBullhorn /> Live Campus Drops
                                    </div>
                                    <h3 className="mt-2 font-display text-2xl sm:text-5xl font-black text-white leading-tight tracking-tight">Stay in the Loop<span className="text-accent-green">.</span></h3>
                                    <p className="mt-2 text-xs sm:text-base text-gray-500 max-w-xl">Updates from the admin team regarding rides, meetups, and campus alerts.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-10 pb-16">
                                {announcements.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-24 text-center">
                                        <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-accent-green/20 blur-3xl rounded-full" />
                                            <FaBullhorn className="relative text-6xl text-gray-800" />
                                        </div>
                                        <p className="text-xl font-bold text-white uppercase tracking-widest">Nothing New Yet</p>
                                        <p className="mt-2 text-sm text-gray-500 max-w-xs">Admin updates will land here as soon as they are posted. Stay tuned!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                                        {announcements.map((announcement) => (
                                            <motion.article
                                                key={announcement.id}
                                                layout
                                                className="group overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-500 shadow-2xl flex flex-col"
                                            >
                                                {announcement.imageUrl ? (
                                                    <div className="relative aspect-video sm:aspect-[16/10] overflow-hidden">
                                                        <img
                                                            src={announcement.imageUrl}
                                                            alt={announcement.title}
                                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                        />
                                                        <div className="absolute left-6 top-6 rounded-full bg-accent-green px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-xl">
                                                            Fresh Update
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex aspect-video items-center justify-center bg-white/[0.02] border-b border-white/5">
                                                        <FaImage className="text-5xl text-white/5" />
                                                    </div>
                                                )}

                                                <div className="p-6 sm:p-8 flex-1 flex flex-col">
                                                    <div className="mb-6 flex flex-wrap items-center gap-4 text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">
                                                        <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5"><FaMapMarkerAlt className="text-accent-green" /> {announcement.location}</span>
                                                        <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5"><FaClock className="text-accent-green" /> {formatAnnouncementTime(announcement.createdAt)}</span>
                                                    </div>
                                                    <h4 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight group-hover:text-accent-green transition-colors">{announcement.title}</h4>
                                                    <p className="text-sm sm:text-base leading-relaxed text-gray-400 line-clamp-6 mb-8">{announcement.message}</p>
                                                    
                                                    <div className="mt-auto flex items-center gap-4 border-t border-white/10 pt-6">
                                                        <div className="h-10 w-10 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center text-accent-green text-[12px] font-black">SA</div>
                                                        <div>
                                                            <p className="text-xs font-black tracking-widest uppercase text-white">{announcement.createdByName || 'Spllit Admin'}</p>
                                                            <p className="text-[10px] font-bold tracking-widest uppercase text-accent-green opacity-60">Verified Team</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
                                    <div className="flex items-center gap-2 text-accent-green text-[10px] sm:text-xs font-black uppercase tracking-[0.35em]">
                                        <FaBullhorn /> Campus News
                                    </div>
                                    <h3 className="mt-2 font-display text-2xl sm:text-4xl font-black text-white leading-tight">Live Dispatch</h3>
                                    <p className="mt-1 text-xs sm:text-sm text-gray-400">Fresh updates from the Spllit Admin team.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="p-5 sm:p-8 pb-10">
                                {announcements.length === 0 ? (
                                    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
                                        <FaBullhorn className="mx-auto text-5xl text-gray-700" />
                                        <p className="mt-4 text-lg font-bold text-white">Radio Silence</p>
                                        <p className="mt-1 text-sm text-gray-500">Wait for the next broadcast. Admin updates will land here.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
                                        {announcements.map((announcement) => (
                                            <motion.article
                                                key={announcement.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent shadow-xl"
                                            >
                                                {announcement.imageUrl ? (
                                                    <div className="relative aspect-video sm:aspect-[16/9]">
                                                        <img
                                                            src={announcement.imageUrl}
                                                            alt={announcement.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                        <div className="absolute left-4 top-4 rounded-full bg-accent-green px-3 py-1 text-[9px] font-black uppercase tracking-widest text-black">
                                                            Verified Drop
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex aspect-video items-center justify-center bg-white/5">
                                                        <FaImage className="text-4xl text-white/10" />
                                                    </div>
                                                )}

                                                <div className="p-5 sm:p-6">
                                                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                        <span className="flex items-center gap-1.5"><FaMapMarkerAlt className="text-accent-green" /> {announcement.location}</span>
                                                        <span className="flex items-center gap-1.5"><FaClock className="text-accent-green" /> {formatAnnouncementTime(announcement.createdAt)}</span>
                                                    </div>
                                                    <h4 className="text-xl sm:text-2xl font-black text-white mb-3">{announcement.title}</h4>
                                                    <p className="text-sm sm:text-base leading-relaxed text-gray-400 line-clamp-4">{announcement.message}</p>
                                                    <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                                                        <div className="h-8 w-8 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center text-accent-green text-[10px] font-black">SP</div>
                                                        <div className="text-[10px] font-bold tracking-widest uppercase">
                                                            <p className="text-white">{announcement.createdByName || 'Spllit Admin'}</p>
                                                            <p className="text-accent-green/60">Official Official</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 20 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl border border-white/10 bg-bg-secondary shadow-2xl"
                        >
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-bg-secondary/95 backdrop-blur-xl px-4 sm:px-6 py-4 pt-5 sm:pt-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-accent-green text-xs font-black uppercase tracking-[0.35em]">
                                        <FaBullhorn /> Campus Drops
                                    </div>
                                    <h3 className="mt-2 font-display text-[1.55rem] sm:text-3xl font-black text-white leading-tight">Campus Feed, in Real Time</h3>
                                    <p className="mt-1 text-sm text-gray-400">Fresh posts from the admin desk, arranged for quick scrolling.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="w-11 h-11 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 pb-6 sm:pb-6">
                                {announcements.length === 0 ? (
                                    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-14 text-center">
                                        <FaBullhorn className="mx-auto text-5xl text-gray-500" />
                                        <p className="mt-4 text-lg font-semibold text-white">No drops yet</p>
                                        <p className="mt-1 text-sm text-gray-400">Check back soon for campus updates and event announcements.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                        {announcements.map((announcement) => (
                                            <motion.article
                                                key={announcement.id}
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/3 shadow-xl"
                                            >
                                                {announcement.imageUrl ? (
                                                    <div className="relative">
                                                        <img
                                                            src={announcement.imageUrl}
                                                            alt={announcement.imageAlt || announcement.title}
                                                            className="h-44 sm:h-56 w-full object-cover"
                                                        />
                                                        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white backdrop-blur-sm">
                                                            New Drop
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex h-44 sm:h-56 items-center justify-center bg-gradient-to-br from-accent-green/20 via-white/5 to-accent-emerald/20">
                                                        <FaImage className="text-5xl text-accent-green/80" />
                                                    </div>
                                                )}

                                                <div className="space-y-4 p-4 sm:p-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h4 className="text-lg sm:text-xl font-black text-white break-words leading-snug">{announcement.title}</h4>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                                    <FaMapMarkerAlt className="text-accent-green" /> {announcement.location}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                                    <FaClock className="text-accent-green" /> {formatAnnouncementTime(announcement.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <p className="text-sm leading-relaxed text-gray-300 break-words">{announcement.message}</p>

                                                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-gray-400">
                                                        <span>Posted by {announcement.createdByName || 'Admin'}</span>
                                                        <span className="uppercase tracking-[0.25em] text-accent-green">{announcement.createdByRole || 'admin'}</span>
                                                    </div>
                                                </div>
                                            </motion.article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnnouncementDrops;