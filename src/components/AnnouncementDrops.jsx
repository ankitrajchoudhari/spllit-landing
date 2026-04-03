import React, { useEffect, useState } from 'react';
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

    const loadAnnouncements = async () => {
        try {
            const response = await announcementsAPI.getPublicAnnouncements();
            const items = Array.isArray(response?.announcements) ? response.announcements : [];
            setAnnouncements(items);
        } catch (error) {
            console.error('Failed to load public announcements:', error);
            setAnnouncements([]);
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

    return (
        <div className="relative">
            <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.04 }}
                onClick={() => setOpen(true)}
                className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-accent-green/30 bg-[#07110d]/92 text-accent-green shadow-[0_8px_25px_rgba(16,185,129,0.25)] backdrop-blur-xl"
                aria-label="Open announcements"
                title="Announcements"
            >
                <FaBullhorn className="text-base" />
                {announcements.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-green animate-pulse" />
                )}
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 20 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl border border-white/10 bg-bg-secondary shadow-2xl"
                        >
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-bg-secondary/95 px-4 sm:px-6 py-4 backdrop-blur-xl">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green">Campus Feed</p>
                                    <h3 className="mt-1 text-xl sm:text-2xl font-black text-white">Announcements</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                    aria-label="Close announcements"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                {announcements.length === 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                                        <FaBullhorn className="mx-auto text-4xl text-gray-500" />
                                        <p className="mt-3 text-white font-semibold">No announcements yet</p>
                                    </div>
                                )}

                                {announcements.map((announcement) => (
                                    <article
                                        key={announcement.id}
                                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                                    >
                                        {announcement.imageUrl ? (
                                            <img
                                                src={announcement.imageUrl}
                                                alt={announcement.imageAlt || announcement.title || 'Announcement image'}
                                                className="h-44 w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-44 w-full items-center justify-center bg-white/5">
                                                <FaImage className="text-4xl text-white/10" />
                                            </div>
                                        )}

                                        <div className="p-4 sm:p-5">
                                            <h4 className="text-lg sm:text-xl font-black text-white break-words">{announcement.title || 'Untitled Announcement'}</h4>
                                            <p className="mt-2 text-sm text-gray-300 leading-relaxed break-words">{announcement.message || 'No message provided.'}</p>

                                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                    <FaMapMarkerAlt className="text-accent-green" />
                                                    {announcement.location || 'Campus'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                                    <FaClock className="text-accent-green" />
                                                    {formatAnnouncementTime(announcement.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnnouncementDrops;
