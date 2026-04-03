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
            const response = await announcementsAPI.getAnnouncements();
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
        <div className="w-full max-w-3xl mx-auto mt-8 sm:mt-10">
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpen(true)}
                className="w-full group relative overflow-hidden rounded-[1.75rem] border border-accent-green/20 bg-gradient-to-r from-white/5 via-accent-green/10 to-white/5 px-4 sm:px-5 py-4 sm:py-5 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_35%)] opacity-80" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-accent-green/15 border border-accent-green/30 flex items-center justify-center flex-shrink-0">
                        <FaBullhorn className="text-accent-green text-xl" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black tracking-[0.35em] uppercase text-accent-green">Live</span>
                            <span className="px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-[10px] text-white/80 uppercase tracking-[0.18em]">
                                Campus Drops
                            </span>
                        </div>
                        <h3 className="mt-2 text-xl sm:text-2xl font-black text-white leading-tight">
                            Tap to see what&apos;s happening on campus
                        </h3>
                        <p className="mt-1 text-sm sm:text-base text-gray-300">
                            Admin posts, event buzz, updates, and location drops in one clean feed.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center">
                        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-xs text-white/70 whitespace-nowrap">
                            {loading ? 'Loading...' : `${announcements.length} posts`}
                        </div>
                        <div className="px-3 py-2 rounded-full bg-accent-green text-black text-xs sm:text-sm font-black whitespace-nowrap shadow-lg shadow-accent-green/20">
                            Open Feed
                        </div>
                    </div>
                </div>
            </motion.button>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {previewItems.map((announcement) => (
                    <div key={announcement.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-accent-green font-bold">
                            <FaClock className="text-[9px]" /> {formatAnnouncementTime(announcement.createdAt)}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white line-clamp-1">{announcement.title}</p>
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{announcement.location}</p>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 20 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-bg-secondary shadow-2xl"
                        >
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-bg-secondary/95 backdrop-blur-xl px-4 sm:px-6 py-4">
                                <div>
                                    <div className="flex items-center gap-2 text-accent-green text-xs font-black uppercase tracking-[0.35em]">
                                        <FaBullhorn /> Campus Drops
                                    </div>
                                    <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white">What&apos;s popping on campus</h3>
                                    <p className="mt-1 text-sm text-gray-400">Fresh posts from the admin desk, made for quick scrolling.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6">
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
                                                            className="h-56 w-full object-cover"
                                                        />
                                                        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white backdrop-blur-sm">
                                                            New Drop
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex h-56 items-center justify-center bg-gradient-to-br from-accent-green/20 via-white/5 to-purple-500/20">
                                                        <FaImage className="text-5xl text-accent-green/80" />
                                                    </div>
                                                )}

                                                <div className="space-y-4 p-4 sm:p-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h4 className="text-lg sm:text-xl font-black text-white break-words">{announcement.title}</h4>
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