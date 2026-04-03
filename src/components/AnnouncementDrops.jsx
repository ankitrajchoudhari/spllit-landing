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

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await announcementsAPI.getPublicAnnouncements();
            const items = Array.isArray(response?.announcements) ? response.announcements : [];
            setAnnouncements(items);
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

    const previewItems = useMemo(() => announcements.slice(0, 3), [announcements]);

    return (
        <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-12 px-0">
            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpen(true)}
                className="w-full group relative overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] border border-accent-green/25 bg-gradient-to-r from-[#08110d] via-[#0f1c17] to-[#08110d] px-4 sm:px-6 py-4 sm:py-6 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_35%)] opacity-90" />
                <div className="relative flex flex-row items-center gap-3 sm:gap-5">
                    <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center flex-shrink-0">
                        <FaBullhorn className="text-accent-green text-sm sm:text-xl" />
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-accent-green animate-pulse" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.35em] uppercase text-accent-green">Live</span>
                            <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/30 border border-white/10 text-[8px] sm:text-[10px] text-white/80 uppercase tracking-widest sm:tracking-[0.18em]">
                                Campus Drops
                            </span>
                        </div>
                        <h3 className="mt-1 sm:mt-2 font-display text-sm sm:text-xl md:text-3xl font-black text-white leading-tight">
                            Latest Campus Drops
                        </h3>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        <div className="px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-accent-green to-accent-emerald text-black text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg">
                            Open
                        </div>
                    </div>
                </div>
            </motion.button>

            <div className="mt-4 flex gap-2.5 sm:gap-3 overflow-x-auto pb-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 scrollbar-hide snap-x snap-mandatory">
                {previewItems.length === 0 ? (
                    <div className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] sm:text-sm text-gray-400 text-left">
                        No active drops. Admin updates will appear here.
                    </div>
                ) : (
                    previewItems.map((announcement, index) => (
                        <div key={announcement.id} className="min-w-[200px] sm:min-w-0 snap-start rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-3.5 backdrop-blur-sm text-left">
                            <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-widest text-accent-green font-bold">
                                <span>#{index + 1} Update</span>
                                <span className="inline-flex items-center gap-1 text-[8px] text-white/60">
                                    <FaClock size={8} /> {formatAnnouncementTime(announcement.createdAt)}
                                </span>
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-bold text-white line-clamp-1">{announcement.title}</p>
                            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-500 line-clamp-1">{announcement.location}</p>
                        </div>
                    ))
                )}
            </div>

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