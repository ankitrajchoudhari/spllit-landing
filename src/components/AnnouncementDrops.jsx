import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBullhorn, FaClock, FaImage, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import { announcementsAPI } from '../services/api';

const POPUP_DURATION_MS = 4000;

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
    const [showPopup, setShowPopup] = useState(false);
    const [latestId, setLatestId] = useState(null);
    const popupTimeoutRef = useRef(null);

    const loadAnnouncements = async () => {
        try {
            const response = await announcementsAPI.getPublicAnnouncements();
            const items = Array.isArray(response?.announcements) ? response.announcements : [];
            setAnnouncements(items);

            if (items.length > 0) {
                const newestId = items[0].id;
                if (newestId && newestId !== latestId) {
                    setLatestId(newestId);
                    setShowPopup(true);

                    if (popupTimeoutRef.current) {
                        clearTimeout(popupTimeoutRef.current);
                    }
                    popupTimeoutRef.current = setTimeout(() => {
                        setShowPopup(false);
                    }, POPUP_DURATION_MS);
                }
            }
        } catch (error) {
            console.error('Failed to load public announcements:', error);
            setAnnouncements([]);
        }
    };

    useEffect(() => {
        loadAnnouncements();

        return () => {
            if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
            }
        };
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
            <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.04 }}
                onClick={() => {
                    setOpen(true);
                    setShowPopup(false);
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-accent-green/30 bg-[#07110d]/92 text-accent-green shadow-[0_8px_25px_rgba(16,185,129,0.25)] backdrop-blur-xl"
                aria-label="Open announcements"
                title="Announcements"
            >
                <FaBullhorn className="text-base" />
                {announcements.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-green animate-pulse" />
                )}
            </motion.button>

            <AnimatePresence>
                {showPopup && latest && !open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        className="fixed right-4 top-28 z-[120] w-[min(88vw,320px)] rounded-2xl border border-accent-green/25 bg-[#0a0a0a]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-green">New Announcement</p>
                            <button
                                onClick={() => setShowPopup(false)}
                                className="rounded-full bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                                aria-label="Close announcement preview"
                            >
                                <FaTimes size={10} />
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setOpen(true);
                                setShowPopup(false);
                            }}
                            className="mt-3 w-full text-left"
                        >
                            <p className="line-clamp-1 text-sm font-bold text-white">{latest.title || 'Campus update'}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-400">{latest.message || 'Tap to read full announcement.'}</p>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

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
