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
            {/* 1. Floating Action Button (The "Announcement Button") */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpen(true)}
                className="group relative flex items-center gap-3 rounded-2xl border border-accent-green/30 bg-[#07110d]/90 p-3 sm:p-4 text-white shadow-[0_8px_32px_rgba(16,185,129,0.25)] backdrop-blur-xl transition-all hover:bg-accent-green/10"
            >
                <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-accent-green/20 border border-accent-green/30 text-accent-green">
                    <FaBullhorn className="text-xl sm:text-2xl" />
                    {announcements.length > 0 && (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent-green animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                    )}
                </div>
                <div className="text-left hidden sm:block pr-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green opacity-80">Campus Drops</p>
                    <p className="font-display font-bold text-sm tracking-tight">Stay Updated</p>
                </div>
                {/* Mobile text is hidden to avoid overlap, only icon shows */}
            </motion.button>

            {/* 2. Auto-Popup (4-8 seconds) */}
            <AnimatePresence>
                {showPopup && latest && !open && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute right-0 top-20 sm:top-24 z-[100] w-[280px] sm:w-[320px] rounded-3xl border border-accent-green/30 bg-[#0a0a0a]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-green">New Drop Alert</span>
                            </div>
                            <button
                                onClick={() => setShowPopup(false)}
                                className="rounded-full bg-white/5 p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                            >
                                <FaTimes size={10} />
                            </button>
                        </div>
                        <div className="mt-3 flex gap-3 cursor-pointer" onClick={() => { setOpen(true); setShowPopup(false); }}>
                            {latest.imageUrl && (
                                <img src={latest.imageUrl} className="h-12 w-12 rounded-lg object-cover flex-shrink-0 border border-white/10" alt="drop" />
                            )}
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-white line-clamp-1">{latest.title}</p>
                                <p className="mt-1 text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{latest.message}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setOpen(true); setShowPopup(false); }}
                            className="mt-4 w-full rounded-xl bg-accent-green/10 py-2 text-[10px] font-bold uppercase tracking-widest text-accent-green hover:bg-accent-green/20 transition-colors"
                        >
                            Open Feed
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
                        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 100 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 100 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-[2.5rem] sm:rounded-3xl border border-white/10 bg-bg-secondary shadow-2xl"
                        >
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-bg-secondary/95 backdrop-blur-xl px-5 sm:px-8 py-5">
                                <div className="min-w-0">
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