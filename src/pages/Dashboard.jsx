import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import { FaUser, FaEnvelope, FaPhone, FaCar, FaMapMarkerAlt, FaTimes, FaCalendarAlt, FaClock, FaUsers, FaRupeeSign, FaMapPin, FaBell, FaCheck, FaTimes as FaTimesCircle, FaComments, FaEdit, FaTrash, FaExclamationTriangle, FaMicrophone, FaImage, FaBullhorn, FaPlus, FaCheckCircle, FaMedal, FaTrophy, FaMoon, FaSun, FaSignOutAlt } from 'react-icons/fa';
import useAuthStore from '../store/authStore';
import socketService from '../services/socket';
import { ridesAPI, matchesAPI, emergencyAPI, announcementsAPI } from '../services/api';
import { NotificationContainer } from '../components/UserNotification';
import ChatModal from '../components/ChatModal';
import SubadminManagement from '../components/SubadminManagement';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/backendUrl';

/* eslint-disable react-hooks/exhaustive-deps */

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const iconScoutHeroLottieUrl = 'https://assets5.lottiefiles.com/packages/lf20_u4yrau.json';
const iconScoutAlertsLottieUrl = 'https://assets4.lottiefiles.com/packages/lf20_Stt1R6.json';
const iconScoutCreateRideLottieUrl = 'https://assets9.lottiefiles.com/packages/lf20_m6j5igxb.json';
const iconScoutFindRideLottieUrl = 'https://assets3.lottiefiles.com/packages/lf20_pwohahvd.json';
const iconScoutMyRideLottieUrl = 'https://assets3.lottiefiles.com/packages/lf20_xlmz9xwm.json';
const iconScoutInboxLottieUrl = 'https://assets3.lottiefiles.com/packages/lf20_jcikwtux.json';
const iconScoutMatchLottieUrl = 'https://assets9.lottiefiles.com/packages/lf20_ydo1amjm.json';
const iconScoutSOSLottieUrl = 'https://assets5.lottiefiles.com/packages/lf20_rwq6ciql.json';

// Load Google Maps script with async
const loadGoogleMaps = (callback) => {
    let existingScript = document.getElementById('googleMaps');
    if (window.google?.maps?.places) {
        if (callback) callback();
        return true;
    }

    // If a script exists but Places is unavailable, reload script with places library.
    if (existingScript && !window.google?.maps?.places) {
        existingScript.remove();
        existingScript = null;
    }

    if (!existingScript) {
        if (!googleMapsApiKey) {
            return false;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&v=weekly&loading=async`;
        script.id = 'googleMaps';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
        script.onload = () => {
            if (callback) callback();
        };
        script.onerror = () => {
            console.warn('Google Maps failed to load');
        };
    } else {
        if (window.google?.maps?.places) {
            if (callback) callback();
        } else if (callback) {
            existingScript.addEventListener('load', callback, { once: true });
        }
    }

    return true;
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, hasHydrated, logout, updateProfile, fetchProfile } = useAuthStore();
    const [showCreateRide, setShowCreateRide] = useState(false);
    const [showFindMatches, setShowFindMatches] = useState(false);
    const [showMyRides, setShowMyRides] = useState(false);
    const [rides, setRides] = useState([]);
    const [myRides, setMyRides] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [notificationFeed, setNotificationFeed] = useState([]);
    const [rideAnnouncements, setRideAnnouncements] = useState([]);
    const [showRideAnnouncements, setShowRideAnnouncements] = useState(false);
    const [adminAnnouncements, setAdminAnnouncements] = useState([]);
    const [showAdminAnnouncements, setShowAdminAnnouncements] = useState(false);
    const [showMessageCenter, setShowMessageCenter] = useState(false);
    const [showMatchedCenter, setShowMatchedCenter] = useState(false);
    const [showProfileStickerPicker, setShowProfileStickerPicker] = useState(false);
    const [pendingProfilePhoto, setPendingProfilePhoto] = useState('');
    const [stickerPickerOriginalPhoto, setStickerPickerOriginalPhoto] = useState('');
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneInputError, setPhoneInputError] = useState('');
    const [savingPhone, setSavingPhone] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('overview');
    const [showCollegeModal, setShowCollegeModal] = useState(false);
    const [collegeInput, setCollegeInput] = useState('');
    const [collegeInputError, setCollegeInputError] = useState('');
    const [savingCollege, setSavingCollege] = useState(false);
    const [socket, setSocket] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [matches, setMatches] = useState([]);
    const [rejectedMatches, setRejectedMatches] = useState([]);
    const [allMatches, setAllMatches] = useState([]);
    const [matchStatusFilter, setMatchStatusFilter] = useState('pending');
    const [showSOSModal, setShowSOSModal] = useState(false);
    const [sendingSOS, setSendingSOS] = useState(false);
    const [nowMs, setNowMs] = useState(Date.now());
    const [isLightMode, setIsLightMode] = useState(() => {
        try {
            return localStorage.getItem('dashboard-light-mode') === '1';
        } catch {
            return false;
        }
    });
    
    // Form data with location coordinates
    const [rideData, setRideData] = useState({
        origin: '',
        originLat: null,
        originLng: null,
        destination: '',
        destLat: null,
        destLng: null,
        departureTime: '',
        seats: 1,
        fare: '',
        vehicleType: 'cab',
        genderPref: 'any'
    });
    const [sosData, setSosData] = useState({
        emergencyType: 'other',
        message: ''
    });
    const [heroLottieData, setHeroLottieData] = useState(null);
    const [alertsLottieData, setAlertsLottieData] = useState(null);
    const [createRideLottieData, setCreateRideLottieData] = useState(null);
    const [findRideLottieData, setFindRideLottieData] = useState(null);
    const [myRideLottieData, setMyRideLottieData] = useState(null);
    const [inboxLottieData, setInboxLottieData] = useState(null);
    const [matchLottieData, setMatchLottieData] = useState(null);
    const [sosLottieData, setSosLottieData] = useState(null);
    const [allowMotion, setAllowMotion] = useState(true);

    // Refs for autocomplete
    const originRef = useRef(null);
    const destinationRef = useRef(null);
    const originAutocompleteRef = useRef(null);
    const destAutocompleteRef = useRef(null);
    const originAutoDetectedRef = useRef(false);
    const notificationBellRef = useRef(null);
    const notificationPanelRef = useRef(null);

    const profileStickerCards = React.useMemo(() => {
        const baseSeed = (user?.name || user?.email || 'spllit-rider').trim().toLowerCase().replace(/\s+/g, '-');
        const variants = ['campus', 'ride', 'study', 'weekend', 'elite', 'vibe', 'sport', 'creator'];

        return variants.map((variant) => ({
            id: `${baseSeed}-${variant}`,
            label: variant,
            url: `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(`${baseSeed}-${variant}`)}`
        }));
    }, [user?.name, user?.email]);

    const displayName = (user?.name || 'Profile').trim();
    const profileInitials = displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
    const selectedStickerLabel = profileStickerCards.find((avatar) => avatar.url === user?.profilePhoto)?.label || 'Choose sticker';
    const verifiedScore = Math.min(100, Math.max(0, Math.round(((Number(user?.rating) || 0) / 5) * 100)));
    const profileProgress = Math.min(100, Math.round(((Number(user?.totalRides) || 0) * 14) + verifiedScore * 0.5));
    const profileLevel = Math.max(1, Math.min(10, Math.ceil(profileProgress / 12)));
    const hasPerformanceData = Number(user?.totalRides || 0) > 0 || matches.length > 0 || Number(user?.rating || 0) > 0;
    const profileTabs = {
        overview: (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Rides" value={Number(user?.totalRides) || 0} tone="green" isLightMode={isLightMode} />
                    <MiniStat label="Rating" value={Number(user?.rating || 0).toFixed(1)} tone="blue" isLightMode={isLightMode} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Level" value={`Lv ${profileLevel}`} tone="purple" isLightMode={isLightMode} />
                    <MiniStat label="Verified" value={verifiedScore >= 70 ? 'Blue' : 'New'} tone="green" isLightMode={isLightMode} />
                </div>
            </div>
        ),
        performance: (
            <div className="space-y-3 min-h-[190px]">
                <section className={`rounded-2xl border p-4 sm:p-5 ${isLightMode ? 'border-gray-200 bg-white' : 'border-white/10 bg-black/20'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className={`text-xs uppercase tracking-wider ${isLightMode ? 'text-gray-500' : 'text-gray-400'}`}>Performance snapshot</p>
                            <p className={`text-sm mt-1 ${isLightMode ? 'text-gray-600' : 'text-gray-500'}`}>Real activity from rides, matches, and rating.</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${hasPerformanceData ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-white/10 bg-white/5 text-gray-400'}`}>
                            {hasPerformanceData ? 'Live' : 'No activity yet'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <MiniStat label="Rides" value={Number(user?.totalRides) || 0} tone="green" isLightMode={isLightMode} />
                        <MiniStat label="Rating" value={Number(user?.rating || 0).toFixed(1)} tone="blue" isLightMode={isLightMode} />
                        <MiniStat label="Level" value={`Lv ${profileLevel}`} tone="purple" isLightMode={isLightMode} />
                        <MiniStat label="Matches" value={matches.length} tone="green" isLightMode={isLightMode} />
                    </div>
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CompactBar label="Profile strength" value={profileProgress} isLightMode={isLightMode} />
                    <CompactBar label="Trust score" value={verifiedScore} isLightMode={isLightMode} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Accepted + pending" value={pendingRequests.length + matches.length} tone="blue" isLightMode={isLightMode} />
                    <MiniStat label="Verified" value={verifiedScore >= 70 ? 'Blue' : 'New'} tone="purple" isLightMode={isLightMode} />
                </div>
            </div>
        ),
        rewards: (
            <div className="space-y-2">
                <RewardChip label="Starter" active={(user?.totalRides || 0) >= 1} isLightMode={isLightMode} />
                <RewardChip label="Reliable" active={(Number(user?.rating) || 0) >= 4} isLightMode={isLightMode} />
                <RewardChip label="Verified" active={verifiedScore >= 70} isLightMode={isLightMode} />
            </div>
        )
    };

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
        let isMounted = true;

        const loadAnimation = async (url, setter) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return;
                const data = await response.json();
                if (isMounted) setter(data);
            } catch {
                // Keep fallback UI when Lottie files are unavailable.
            }
        };

        loadAnimation(iconScoutHeroLottieUrl, setHeroLottieData);
        loadAnimation(iconScoutAlertsLottieUrl, setAlertsLottieData);
        loadAnimation(iconScoutCreateRideLottieUrl, setCreateRideLottieData);
        loadAnimation(iconScoutFindRideLottieUrl, setFindRideLottieData);
        loadAnimation(iconScoutMyRideLottieUrl, setMyRideLottieData);
        loadAnimation(iconScoutInboxLottieUrl, setInboxLottieData);
        loadAnimation(iconScoutMatchLottieUrl, setMatchLottieData);
        loadAnimation(iconScoutSOSLottieUrl, setSosLottieData);

        return () => {
            isMounted = false;
        };
    }, []);

    const rideAnnouncementSeenKey = `ride-announcements-seen-${user?.id || 'guest'}`;
    const notificationFeedKey = `notification-feed-${user?.id || 'guest'}`;
    const dismissedFeedKey = `notification-feed-dismissed-${user?.id || 'guest'}`;
    const adminAnnouncementSeenKey = `admin-announcements-seen-${user?.id || 'guest'}`;
    const ridePostDepartureWindowMs = 3 * 60 * 60 * 1000;
    const notificationFeedExpiryMs = 2 * 60 * 60 * 1000;

    const getNowIso = () => new Date().toISOString();

    const pruneExpiredFeed = (items) => {
        const now = Date.now();
        return items.filter((item) => {
            const expiresAt = new Date(item.expiresAt || 0).getTime();
            return Number.isFinite(expiresAt) && expiresAt > now;
        });
    };

    const getRideExpiryMsFromData = (item, fallbackTimestamp) => {
        const departureMs = new Date(item?.departureTime || item?.meta?.departureTime || 0).getTime();
        if (Number.isFinite(departureMs) && departureMs > 0) {
            return departureMs + ridePostDepartureWindowMs;
        }

        const fallbackMs = new Date(fallbackTimestamp || item?.timestamp || item?.createdAt || 0).getTime();
        if (Number.isFinite(fallbackMs) && fallbackMs > 0) {
            return fallbackMs + ridePostDepartureWindowMs;
        }

        return 0;
    };

    const normalizeFeedItem = (item) => {
        const timestamp = item.timestamp || item.createdAt || getNowIso();
        const rideExpiryMs = getRideExpiryMsFromData(item, timestamp);
        const defaultExpiryMs = item.type === 'ride' ? rideExpiryMs : new Date(timestamp).getTime() + notificationFeedExpiryMs;
        return {
            id: item.id || `${item.type || 'info'}-${Date.now()}`,
            type: item.type || 'info',
            title: item.title || 'Notification',
            message: item.message || '',
            timestamp,
            expiresAt: item.expiresAt || (defaultExpiryMs > 0 ? new Date(defaultExpiryMs).toISOString() : null),
            rideId: item.rideId,
            matchId: item.matchId,
            chatRoomId: item.chatRoomId,
            meta: item.meta || {}
        };
    };

    const persistNotificationFeed = (items) => {
        localStorage.setItem(notificationFeedKey, JSON.stringify(items));
    };

    const getDismissedFeedIds = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(dismissedFeedKey) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const persistDismissedFeedIds = (ids) => {
        localStorage.setItem(dismissedFeedKey, JSON.stringify(ids));
    };

    const removeNotificationFeedItem = (id) => {
        const dismissedIds = new Set(getDismissedFeedIds());
        dismissedIds.add(id);
        persistDismissedFeedIds(Array.from(dismissedIds));

        setNotificationFeed((prev) => {
            const next = prev.filter((item) => item.id !== id);
            persistNotificationFeed(next);
            return next;
        });
    };

    const addNotificationFeedItem = (item) => {
        const nextItem = normalizeFeedItem(item);
        setNotificationFeed((prev) => {
            const next = pruneExpiredFeed([
                nextItem,
                ...prev.filter((existing) => existing.id !== nextItem.id)
            ]);
            persistNotificationFeed(next);
            return next;
        });
    };

    const loadNotificationFeed = async () => {
        try {
            const dismissedIds = new Set(getDismissedFeedIds());
            const parsedFeed = JSON.parse(localStorage.getItem(notificationFeedKey) || '[]');
            const storedFeed = Array.isArray(parsedFeed) ? parsedFeed : [];
            const rideResponse = await ridesAPI.getAnnouncements();
            const announcements = Array.isArray(rideResponse?.announcements) ? rideResponse.announcements : [];
            const rideItems = announcements.map((announcement) => normalizeFeedItem({
                id: `ride-${announcement.id}`,
                type: 'ride',
                title: announcement.title || 'New Ride Available!',
                message: announcement.message,
                timestamp: announcement.createdAt,
                expiresAt: announcement.expiresAt || new Date(new Date(announcement.departureTime || announcement.createdAt).getTime() + ridePostDepartureWindowMs).toISOString(),
                rideId: announcement.rideId,
                meta: {
                    origin: announcement.origin,
                    destination: announcement.destination,
                    creatorName: announcement.creatorName,
                    creatorCollege: announcement.creatorCollege,
                    departureTime: announcement.departureTime,
                    fare: announcement.fare,
                    vehicleType: announcement.vehicleType
                }
            }));

            const storedItems = storedFeed.map(normalizeFeedItem);
            const merged = pruneExpiredFeed([
                ...rideItems,
                ...storedItems
            ]).filter((item) => !dismissedIds.has(item.id)).reduce((accumulator, item) => {
                if (!accumulator.some((existing) => existing.id === item.id)) {
                    accumulator.push(item);
                }
                return accumulator;
            }, []);

            setNotificationFeed(merged);
            persistNotificationFeed(merged);
            return merged;
        } catch (error) {
            console.error('Failed to load notification feed:', error);
            return [];
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('dashboard-light-mode', isLightMode ? '1' : '0');
        } catch {
            // Ignore localStorage write failures.
        }
    }, [isLightMode]);

    const getRideExpiryMs = (ride) => {
        if (ride?.expiresAt) {
            const value = new Date(ride.expiresAt).getTime();
            if (Number.isFinite(value)) return value;
        }

        return getRideExpiryMsFromData(ride, ride?.createdAt || ride?.timestamp);
    };

    const getRideRemainingMs = (ride) => {
        const remaining = getRideExpiryMs(ride) - nowMs;
        return remaining > 0 ? remaining : 0;
    };

    const formatRideCountdown = (remainingMs) => {
        const totalSeconds = Math.floor(remainingMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

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

    const normalizeRideAnnouncement = (announcement) => ({
        id: announcement.id,
        title: announcement.title || 'New Ride Available!',
        message: announcement.message || `${announcement.creatorName || 'A student'} is going from ${announcement.origin} to ${announcement.destination}`,
        origin: announcement.origin,
        destination: announcement.destination,
        creatorName: announcement.creatorName || 'Student',
        creatorCollege: announcement.creatorCollege || '',
        departureTime: announcement.departureTime,
        fare: announcement.fare,
        vehicleType: announcement.vehicleType,
        createdAt: announcement.createdAt,
        timestamp: announcement.createdAt
    });

    const normalizeAdminAnnouncement = (announcement) => ({
        id: announcement.id,
        title: announcement.title || 'Campus update',
        message: announcement.message || '',
        location: announcement.location || 'Campus',
        imageUrl: announcement.imageUrl || '',
        imageAlt: announcement.imageAlt || announcement.title || 'Announcement image',
        createdByName: announcement.createdByName || 'Admin',
        createdByRole: announcement.createdByRole || 'admin',
        createdAt: announcement.createdAt,
        timestamp: announcement.createdAt
    });

    const seenAdminAnnouncementsAt = () => {
        const storedValue = localStorage.getItem(adminAnnouncementSeenKey);
        const parsed = storedValue ? new Date(storedValue) : null;
        return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
    };

    const unreadAdminAnnouncementCount = adminAnnouncements.filter((announcement) => {
        const createdAt = new Date(announcement.createdAt || announcement.timestamp || 0);
        return createdAt > seenAdminAnnouncementsAt();
    }).length;

    const visibleNotificationFeed = notificationFeed.slice(0, 2);
    const uniqueAlertIds = new Set([
        ...notificationFeed.map((item) => item.id),
        ...notifications.map((item) => item.id)
    ]);
    const alertBadgeCount = uniqueAlertIds.size;
    const alertBadgeLabel = alertBadgeCount === 1 ? 'New' : '2+';
    const lottiePlaybackProps = allowMotion
        ? { loop: true, autoplay: true }
        : { loop: false, autoplay: false };

    const markRideAnnouncementsSeen = (announcements = rideAnnouncements) => {
        if (!announcements.length) return;

        const latestTimestamp = announcements.reduce((latest, announcement) => {
            const createdAt = new Date(announcement.createdAt || announcement.timestamp || 0).getTime();
            return createdAt > latest ? createdAt : latest;
        }, 0);

        if (latestTimestamp > 0) {
            localStorage.setItem(rideAnnouncementSeenKey, new Date(latestTimestamp).toISOString());
        }
    };

    const loadRideAnnouncements = async () => {
        try {
            const response = await ridesAPI.getAnnouncements();
            const nextAnnouncements = (response.announcements || []).map(normalizeRideAnnouncement);
            setRideAnnouncements(nextAnnouncements);
            return nextAnnouncements;
        } catch (error) {
            console.error('Failed to load ride announcements:', error);
            return [];
        }
    };

    const markAdminAnnouncementsSeen = (announcements = adminAnnouncements) => {
        if (!announcements.length) return;

        const latestTimestamp = announcements.reduce((latest, announcement) => {
            const createdAt = new Date(announcement.createdAt || announcement.timestamp || 0).getTime();
            return createdAt > latest ? createdAt : latest;
        }, 0);

        if (latestTimestamp > 0) {
            localStorage.setItem(adminAnnouncementSeenKey, new Date(latestTimestamp).toISOString());
        }
    };

    const loadAdminAnnouncements = async () => {
        try {
            const response = await announcementsAPI.getPublicAnnouncements();
            const nextAnnouncements = (response.announcements || []).map(normalizeAdminAnnouncement);
            setAdminAnnouncements(nextAnnouncements);
            return nextAnnouncements;
        } catch (error) {
            console.error('Failed to load admin announcements:', error);
            return [];
        }
    };

    useEffect(() => {
        if (!hasHydrated) {
            return;
        }

        // Redirect to login if not authenticated
        if (!isAuthenticated || !user) {
            navigate('/login');
            return;
        }

        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
            navigate('/login');
            return;
        }

        let isCancelled = false;
        let newSocket = null;

        const initializeProtectedDashboard = async () => {
            // Validate/refresh auth once before opening sockets or fetching protected data.
            const profileResult = await fetchProfile();
            if (!profileResult?.success || isCancelled) {
                logout();
                navigate('/login', { replace: true });
                return;
            }

            // Connect to Socket.IO for real-time features
            const socketUrl = SOCKET_BASE_URL;
            const socketToken = localStorage.getItem('accessToken');
            const isLikelyMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            newSocket = io(socketUrl, {
                auth: socketToken ? { token: socketToken } : undefined,
                transports: isLikelyMobile ? ['polling'] : ['websocket', 'polling'],
                upgrade: !isLikelyMobile,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            setSocket(newSocket);

            newSocket.on('connect', () => {});
            newSocket.on('connect_error', () => {});

        // Listen for new rides (for all users)
        newSocket.on('new-ride-created', (data) => {
            // Only show notification if it's not the current user's ride
            if (data.creator && data.creator.id !== user.id) {
                const rideAnnouncement = normalizeRideAnnouncement({
                    ...data,
                    creatorName: data.creator.name,
                    creatorCollege: data.creator.college
                });

                setRideAnnouncements(prev => [rideAnnouncement, ...prev.filter(item => item.id !== rideAnnouncement.id)]);
                addNotificationFeedItem({
                    id: `ride-${data.id}`,
                    type: 'ride',
                    title: 'New Ride Available!',
                    message: `${data.creator.name} is going from ${data.origin} to ${data.destination} at ${formatAnnouncementTime(data.departureTime)}`,
                    timestamp: data.timestamp || getNowIso(),
                    rideId: data.id,
                    meta: {
                        origin: data.origin,
                        destination: data.destination,
                        creatorName: data.creator.name,
                        creatorCollege: data.creator.college,
                        departureTime: data.departureTime,
                        fare: data.fare,
                        vehicleType: data.vehicleType
                    }
                });
                addNotification({
                    type: 'ride',
                    title: 'New Ride Available!',
                    message: `${data.creator.name} is going from ${data.origin} to ${data.destination} at ${formatAnnouncementTime(data.departureTime)}`,
                    actionLabel: 'Browse rides',
                    onAction: async () => {
                        setShowRideAnnouncements(false);
                        setShowMessageCenter(false);
                        setShowMatchedCenter(false);
                        setShowAdminAnnouncements(false);
                        await handleSearchRides();
                    }
                });
                localStorage.removeItem(rideAnnouncementSeenKey);
                // Add ride to available list if viewing matches
                if (showFindMatches) {
                    setRides(prev => [data, ...prev]);
                }
            }
        });

        // Listen for match created for this user
        newSocket.on(`match_created_${user.id}`, (data) => {
            if (data.notification) {
                addNotificationFeedItem({
                    id: `match-created-${data.match?.id || Date.now()}`,
                    type: data.notification.type,
                    title: data.notification.title,
                    message: data.notification.message,
                    timestamp: getNowIso(),
                    matchId: data.match?.id,
                    chatRoomId: data.notification.chatRoomId
                });
                addNotification({
                    type: data.notification.type,
                    title: data.notification.title,
                    message: data.notification.message,
                    actionLabel: 'Open chat',
                    onAction: async () => {
                        await handleAlertItemClick({
                            matchId: data.match?.id,
                            chatRoomId: data.notification.chatRoomId
                        });
                    }
                });
                // Play notification sound
                playNotificationSound();
            }
            // Refresh my rides to show updated status
            setTimeout(() => {
                handleGetMyRides(false); // Don't show modal, just refresh data
            }, 500);
        });

        // Listen for match requests (ride creator receives when user 2 requests)
        newSocket.on(`match_request_${user.id}`, (data) => {
            // Show prominent notification popup to ride creator
            addNotificationFeedItem({
                id: `match-request-${data.match?.id || Date.now()}`,
                type: 'match',
                title: '📨 New Match Request!',
                message: data.notification?.message || 'Someone wants to join your ride!',
                timestamp: getNowIso(),
                matchId: data.match?.id,
                chatRoomId: data.match?.chatRoomId
            });
            addNotification({
                type: 'ride',
                title: '📨 New Match Request!',
                message: data.notification?.message || `Someone wants to join your ride!`,
                actionLabel: 'Review request',
                onAction: async () => {
                    setShowRideAnnouncements(false);
                    setShowMessageCenter(false);
                    setShowAdminAnnouncements(false);
                    setMatchStatusFilter('pending');
                    await loadMatches();
                    setShowMatchedCenter(true);
                }
            });
            playNotificationSound();
            
            // Add to pending requests
            if (data.match) {
                setPendingRequests(prev => [data.match, ...prev]);
            }
            
            // Refresh my rides to show pending request
            handleGetMyRides(false);
            
            // Show additional alert for important notification
            setTimeout(() => {
                addNotification({
                    type: 'success',
                    title: '👀 Action Required',
                    message: 'Go to Matched to accept or reject requests.',
                    actionLabel: 'Review request',
                    onAction: async () => {
                        setMatchStatusFilter('pending');
                        await loadMatches();
                        setShowMatchedCenter(true);
                    }
                });
            }, 2000);
        });

        // Listen for match request sent (requester)
        newSocket.on(`match_request_sent_${user.id}`, (data) => {
            if (data.notification) {
                addNotificationFeedItem({
                    id: `match-request-sent-${data.match?.id || Date.now()}`,
                    type: data.notification.type || 'info',
                    title: data.notification.title,
                    message: data.notification.message,
                    timestamp: getNowIso(),
                    matchId: data.match?.id,
                    chatRoomId: data.match?.chatRoomId
                });
                addNotification({
                    type: 'success',
                    title: data.notification.title,
                    message: data.notification.message,
                    actionLabel: 'Open matches',
                    onAction: async () => {
                        setMatchStatusFilter('accepted');
                        await loadMatches();
                        setShowMatchedCenter(true);
                    }
                });
            }
        });

        // Listen for match accepted (both users receive this)
        newSocket.on(`match_accepted_${user.id}`, (data) => {
            // Show prominent acceptance notification popup
            addNotificationFeedItem({
                id: `match-accepted-${data.match?.id || Date.now()}`,
                type: 'success',
                title: data.notification?.title || '✅ Match Accepted!',
                message: data.notification?.message || 'Your ride match is confirmed!',
                timestamp: getNowIso(),
                matchId: data.match?.id,
                chatRoomId: data.notification?.chatRoomId
            });
            addNotification({
                type: 'success',
                title: data.notification?.title || '✅ Match Accepted!',
                message: data.notification?.message || 'Your ride match is confirmed!',
                actionLabel: 'Chat now',
                onAction: async () => {
                    await handleAlertItemClick({
                        matchId: data.match?.id,
                        chatRoomId: data.notification?.chatRoomId
                    });
                }
            });
            playNotificationSound();
            
            // Remove from pending requests
            if (data.match) {
                setPendingRequests(prev => prev.filter(req => req.id !== data.match.id));
            }
            
            // Refresh matches
            loadMatches();
            handleGetMyRides(false);
        });

        // Listen for match rejected
        newSocket.on(`match_rejected_${user.id}`, (data) => {
            if (data.notification) {
                addNotificationFeedItem({
                    id: `match-rejected-${data.notification.matchId || Date.now()}`,
                    type: 'error',
                    title: data.notification.title,
                    message: data.notification.message,
                    timestamp: getNowIso(),
                    matchId: data.notification.matchId
                });
                addNotification({
                    type: 'error',
                    title: data.notification.title,
                    message: data.notification.message,
                    actionLabel: 'View details',
                    onAction: async () => {
                        setShowMatchedCenter(true);
                        setMatchStatusFilter('rejected');
                        await loadMatches();
                    }
                });
            }
        });

        // Listen for new messages
        newSocket.on(`message_notification_${user.id}`, (data) => {
            if (data.notification) {
                const uniqueMessageNotificationId = data.notification.id || `message-${data.notification.matchId || 'general'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                addNotificationFeedItem({
                    id: uniqueMessageNotificationId,
                    type: 'match',
                    title: data.notification.title,
                    message: data.notification.message,
                    timestamp: getNowIso(),
                    matchId: data.notification.matchId,
                    chatRoomId: data.notification.chatRoomId
                });
                addNotification({
                    type: 'match',
                    title: data.notification.title,
                    message: data.notification.message,
                    actionLabel: 'Open chat',
                    onAction: async () => {
                        await handleAlertItemClick({
                            matchId: data.notification.matchId,
                            chatRoomId: data.notification.chatRoomId
                        });
                    }
                });
                playNotificationSound();
            }
        });

        // Listen for ride status updates
        newSocket.on('ride-status-updated', (data) => {
            // Remove from available rides if matched
            if (data.status === 'matched') {
                setRides(prev => prev.filter(ride => ride.id !== data.rideId));
            }
            // Update my rides status
            setMyRides(prev => prev.map(ride => 
                ride.id === data.rideId ? { ...ride, status: data.status } : ride
            ));
        });

        newSocket.on('new-admin-announcement', (data) => {
            if (!data?.announcement) return;

            const announcement = normalizeAdminAnnouncement(data.announcement);
            setAdminAnnouncements(prev => [announcement, ...prev.filter((item) => item.id !== announcement.id)]);
            addNotificationFeedItem({
                id: `announcement-${announcement.id}`,
                type: 'info',
                title: announcement.title,
                message: `${announcement.location} • ${announcement.message}`,
                timestamp: announcement.createdAt,
                meta: {
                    location: announcement.location,
                    imageUrl: announcement.imageUrl,
                    imageAlt: announcement.imageAlt
                }
            });
            addNotification({
                type: 'success',
                title: 'New announcement',
                message: announcement.title,
                actionLabel: 'View announcement',
                onAction: async () => {
                    setShowRideAnnouncements(false);
                    setShowMessageCenter(false);
                    setShowMatchedCenter(false);
                    setShowFindMatches(false);
                    setShowAdminAnnouncements(true);
                }
            });
            playNotificationSound();
        });

            // Load Google Maps early so the ride modal is ready quickly
            loadGoogleMaps();

            loadRideAnnouncements();
            loadAdminAnnouncements();
            loadNotificationFeed();
            loadMatches();
        };

        initializeProtectedDashboard();

        // Cleanup on unmount
        return () => {
            isCancelled = true;
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [hasHydrated, isAuthenticated, user?.id, navigate, fetchProfile, logout]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNotificationFeed((prev) => {
                const next = pruneExpiredFeed(prev);
                if (next.length !== prev.length) {
                    persistNotificationFeed(next);
                }
                return next;
            });
        }, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!showRideAnnouncements) return;

        const handleOutsideClick = (event) => {
            const bellEl = notificationBellRef.current;
            const panelEl = notificationPanelRef.current;

            if (!bellEl || !panelEl) return;

            const target = event.target;
            const clickedInsideBell = bellEl.contains(target);
            const clickedInsidePanel = panelEl.contains(target);

            if (!clickedInsideBell && !clickedInsidePanel) {
                setShowRideAnnouncements(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowRideAnnouncements(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showRideAnnouncements]);

    useEffect(() => {
        if (!showAdminAnnouncements) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowAdminAnnouncements(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showAdminAnnouncements]);

    const addNotification = (notification) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { ...notification, id }].slice(-2));
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
        } catch {
            // Ignore optional notification sound failures.
        }
    };

    useEffect(() => {
        if (!showCreateRide) {
            originAutoDetectedRef.current = false;
            originAutocompleteRef.current = null;
            destAutocompleteRef.current = null;
            return;
        }

        if (!googleMapsApiKey) {
            setError('Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your frontend .env file.');
            return;
        }

        const initAutocomplete = () => {
            if (!window.google?.maps?.places?.Autocomplete) {
                setError('Google Places API unavailable. Enable Places API and Maps JavaScript API, and allow your site domain in API key referrers.');
                return;
            }

            if (originRef.current && !originAutocompleteRef.current) {
                originAutocompleteRef.current = new window.google.maps.places.Autocomplete(originRef.current, {
                    componentRestrictions: { country: 'in' },
                    fields: ['formatted_address', 'geometry', 'name']
                });

                originAutocompleteRef.current.addListener('place_changed', () => {
                    const place = originAutocompleteRef.current.getPlace();
                    if (place.geometry) {
                        originAutoDetectedRef.current = true;
                        setRideData(prev => ({
                            ...prev,
                            origin: place.formatted_address || place.name,
                            originLat: place.geometry.location.lat(),
                            originLng: place.geometry.location.lng()
                        }));
                    }
                });
            }

            if (destinationRef.current && !destAutocompleteRef.current) {
                destAutocompleteRef.current = new window.google.maps.places.Autocomplete(destinationRef.current, {
                    componentRestrictions: { country: 'in' },
                    fields: ['formatted_address', 'geometry', 'name']
                });

                destAutocompleteRef.current.addListener('place_changed', () => {
                    const place = destAutocompleteRef.current.getPlace();
                    if (place.geometry) {
                        setRideData(prev => ({
                            ...prev,
                            destination: place.formatted_address || place.name,
                            destLat: place.geometry.location.lat(),
                            destLng: place.geometry.location.lng()
                        }));
                    }
                });
            }
        };

        const autoDetectOrigin = () => {
            if (originAutoDetectedRef.current || !navigator.geolocation) {
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    let originLabel = 'Current location';

                    try {
                        if (window.google?.maps?.Geocoder) {
                            const geocoder = new window.google.maps.Geocoder();
                            const reverseGeocode = await new Promise((resolve, reject) => {
                                geocoder.geocode(
                                    { location: { lat: latitude, lng: longitude } },
                                    (results, status) => {
                                        if (status === 'OK' && results?.[0]) {
                                            resolve(results[0]);
                                        } else {
                                            reject(new Error(status || 'Geocoder failed'));
                                        }
                                    }
                                );
                            });

                            originLabel = reverseGeocode.formatted_address || reverseGeocode.name || originLabel;
                        }
                    } catch (error) {
                        originLabel = 'Current location';
                    }

                    originAutoDetectedRef.current = true;
                    setRideData(prev => ({
                        ...prev,
                        origin: originLabel,
                        originLat: latitude,
                        originLng: longitude
                    }));
                },
                () => {
                    originAutoDetectedRef.current = true;
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
            );
        };

        const setupAutocomplete = (attempt = 0) => {
            // Wait until modal input refs are attached before init.
            if ((!originRef.current || !destinationRef.current) && attempt < 5) {
                setTimeout(() => setupAutocomplete(attempt + 1), 120);
                return;
            }

            initAutocomplete();
            autoDetectOrigin();
        };

        loadGoogleMaps(() => {
            if (!window.google?.maps?.places?.Autocomplete) {
                setError('Google Places failed to initialize. Check API key restrictions for this domain and ensure Places API is enabled.');
                return;
            }
            setupAutocomplete();
        });
    }, [showCreateRide]);

    const handleLogout = () => {
        socketService.disconnect();
        logout();
        navigate('/login');
    };

    const handleOpenStickerPicker = () => {
        const currentPhoto = user?.profilePhoto || '';
        setStickerPickerOriginalPhoto(currentPhoto);
        setPendingProfilePhoto(currentPhoto);
        setShowProfileStickerPicker(true);
    };

    const handleSelectStickerAvatar = (avatarUrl) => {
        if (!avatarUrl) return;

        setPendingProfilePhoto(avatarUrl);
    };

    const handleSelectNoneSticker = () => {
        setPendingProfilePhoto(stickerPickerOriginalPhoto || '');
    };

    const handleCancelStickerPicker = () => {
        setPendingProfilePhoto(stickerPickerOriginalPhoto || user?.profilePhoto || '');
        setShowProfileStickerPicker(false);
    };

    const handleApplyStickerSelection = async () => {
        const nextPhoto = pendingProfilePhoto || '';
        const currentPhoto = user?.profilePhoto || '';

        setShowProfileStickerPicker(false);

        if (nextPhoto === currentPhoto) return;

        try {
            await updateProfile({ profilePhoto: nextPhoto });
            if (typeof fetchProfile === 'function') {
                await fetchProfile();
            }
        } catch (updateError) {
            console.error('Failed to update profile avatar:', updateError);
        }
    };

    const handleOpenPhoneModal = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setPhoneInputError('');
        setPhoneInput(user?.phone || '');
        setShowPhoneModal(true);
    };

    const handleCancelPhoneModal = () => {
        setPhoneInputError('');
        setPhoneInput('');
        setShowPhoneModal(false);
    };

    const handleSavePhone = async () => {
        const trimmedPhone = phoneInput.trim();

        if (!trimmedPhone) {
            setPhoneInputError('Phone number is required');
            return;
        }

        // Basic phone validation (adjust regex as needed)
        const phoneRegex = /^[6-9]\d{9}$/; // Indian phone format
        if (!phoneRegex.test(trimmedPhone)) {
            setPhoneInputError('Enter a valid 10-digit Indian phone number');
            return;
        }

        setSavingPhone(true);
        try {
            await updateProfile({ phone: trimmedPhone });
            if (typeof fetchProfile === 'function') {
                await fetchProfile();
            }
            setShowPhoneModal(false);
            addNotification({
                type: 'success',
                title: 'Phone Updated',
                message: 'Your phone number has been saved successfully.'
            });
        } catch (err) {
            console.error('Failed to save phone:', err);
            setPhoneInputError(err.response?.data?.message || 'Failed to save phone number');
        } finally {
            setSavingPhone(false);

            const handleOpenCollegeModal = (e) => {
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                setCollegeInputError('');
                setCollegeInput(user?.college || '');
                setShowCollegeModal(true);
            };

            const handleCancelCollegeModal = () => {
                setCollegeInputError('');
                setCollegeInput('');
                setShowCollegeModal(false);
            };

            const handleSaveCollege = async () => {
                const trimmedCollege = collegeInput.trim();

                if (!trimmedCollege) {
                    setCollegeInputError('College name is required');
                    return;
                }

                if (trimmedCollege.length < 3) {
                    setCollegeInputError('College name must be at least 3 characters');
                    return;
                }

                if (trimmedCollege.length > 100) {
                    setCollegeInputError('College name must be less than 100 characters');
                    return;
                }

                setSavingCollege(true);
                try {
                    await updateProfile({ college: trimmedCollege });
                    if (typeof fetchProfile === 'function') {
                        await fetchProfile();
                    }
                    setShowCollegeModal(false);
                    addNotification({
                        type: 'success',
                        title: 'College Updated',
                        message: 'Your college information has been saved successfully.'
                    });
                } catch (err) {
                    console.error('Failed to save college:', err);
                    setCollegeInputError(err.response?.data?.message || 'Failed to save college');
                } finally {
                    setSavingCollege(false);
                }
            };
        }
    };

    const handleRideBellClick = async () => {
        setShowMessageCenter(false);
        setShowMatchedCenter(false);
        setShowAdminAnnouncements(false);
        const willOpen = !showRideAnnouncements;
        setShowRideAnnouncements(willOpen);

        if (willOpen) {
            Promise.allSettled([
                loadRideAnnouncements(),
                loadNotificationFeed()
            ]).then((results) => {
                const rideResult = results[0];
                if (rideResult.status === 'fulfilled' && Array.isArray(rideResult.value)) {
                    markRideAnnouncementsSeen(rideResult.value);
                }
            });
        }
    };

    const handleAnnouncementMicClick = async () => {
        setShowMessageCenter(false);
        setShowMatchedCenter(false);
        setShowRideAnnouncements(false);
        const nextAnnouncements = await loadAdminAnnouncements();
        markAdminAnnouncementsSeen(nextAnnouncements);
        setShowAdminAnnouncements((prev) => !prev);
    };

    const handleMessageCenterClick = async () => {
        setShowRideAnnouncements(false);
        setShowAdminAnnouncements(false);
        setShowMatchedCenter(false);
        await loadMatches();
        setShowMessageCenter(true);
    };

    const handleMatchedCenterClick = async (filter = 'pending') => {
        setShowRideAnnouncements(false);
        setShowAdminAnnouncements(false);
        setShowMessageCenter(false);
        await loadMatches();
        setMatchStatusFilter(filter);
        setShowMatchedCenter(true);
    };

    const matchedActionCount = pendingRequests.length + rejectedMatches.length;
    const announcementActionCount = unreadAdminAnnouncementCount;

    const getSeatLimitByVehicleType = (vehicleType) => {
        if (vehicleType === 'auto') return 3;
        if (vehicleType === 'cab-xl') return 7;
        if (vehicleType === 'bike') return 1;
        return 4; // cab default
    };

    const triggerSOSFeedback = () => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([240, 120, 320]);
        }

        try {
            const siren = new Audio('/alert.mp3');
            siren.play().catch(() => {});
            setTimeout(() => {
                siren.pause();
                siren.currentTime = 0;
            }, 2200);
        } catch {
            // Ignore optional siren failures.
        }
    };

    const getCurrentLocation = () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Location services are not available on this device.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            () => {
                reject(new Error('Unable to fetch location. Please enable location permissions.'));
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        );
    });

    const handleSendSOS = async () => {
        setSendingSOS(true);
        setError('');

        try {
            triggerSOSFeedback();
            const location = await getCurrentLocation();
            await emergencyAPI.sendSOS({
                location,
                emergencyType: sosData.emergencyType,
                message: sosData.message?.trim() || undefined
            });

            addNotification({
                type: 'success',
                title: 'SOS sent',
                message: 'Emergency team has been alerted with your phone and location.'
            });

            setShowSOSModal(false);
            setSosData({ emergencyType: 'other', message: '' });
        } catch (sosError) {
            setError(sosError?.response?.data?.error || sosError?.message || 'Failed to send SOS alert.');
        } finally {
            setSendingSOS(false);
        }
    };

    const isMatchChatActive = (match) => {
        if (!match?.acceptedAt) return false;
        const acceptedTime = new Date(match.acceptedAt).getTime();
        return Number.isFinite(acceptedTime) && Date.now() - acceptedTime <= 30 * 60 * 1000;
    };

    const handleNotificationItemClick = async (item) => {
        if (!item?.matchId && !item?.chatRoomId) {
            return;
        }

        try {
            // Prefer already loaded matches for instant open, then refresh from API if needed.
            let allMatchesLocal = Array.isArray(allMatches) ? allMatches : [];
            let targetMatch = allMatchesLocal.find((match) =>
                (item.matchId && match.id === item.matchId) ||
                (item.chatRoomId && match.chatRoomId === item.chatRoomId)
            );

            if (!targetMatch) {
                const response = await matchesAPI.getMyMatches();
                allMatchesLocal = Array.isArray(response?.matches) ? response.matches : [];
                setAllMatches(allMatchesLocal);
                targetMatch = allMatchesLocal.find((match) =>
                    (item.matchId && match.id === item.matchId) ||
                    (item.chatRoomId && match.chatRoomId === item.chatRoomId)
                );
            }

            if (!targetMatch) {
                addNotification({
                    type: 'error',
                    title: 'Match not found',
                    message: 'This ride match is not available right now.'
                });
                return;
            }

            setShowRideAnnouncements(false);
            setShowMessageCenter(false);
            setShowMatchedCenter(true);

            if (targetMatch.status !== 'accepted') {
                setMatchStatusFilter(targetMatch.status === 'rejected' ? 'rejected' : 'pending');
                return;
            }

            setMatchStatusFilter('accepted');
            setActiveChat(targetMatch);
            setShowMatchedCenter(false);
        } catch (error) {
            addNotification({
                type: 'error',
                title: 'Unable to open match',
                message: 'Please try again in a moment.'
            });
        }
    };

    const handleAlertItemClick = async (item) => {
        if (!item) return;

        if (item.matchId || item.chatRoomId) {
            await handleNotificationItemClick(item);
            return;
        }

        if (item.type === 'ride') {
            setShowRideAnnouncements(false);
            setShowMessageCenter(false);
            setShowMatchedCenter(false);
            setShowAdminAnnouncements(false);
            await handleSearchRides();
            return;
        }

        if (item.type === 'info') {
            setShowRideAnnouncements(false);
            setShowMessageCenter(false);
            setShowMatchedCenter(false);
            setShowFindMatches(false);
            setShowAdminAnnouncements(true);
        }
    };

    const handleCreateRide = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Validate coordinates
        if (!rideData.destLat || !rideData.destLng) {
            setError('Please select a valid destination from the dropdown');
            setLoading(false);
            return;
        }

        // Calculate per person fare
        const totalSeats = parseInt(rideData.seats) || 1;
        const totalFare = parseFloat(rideData.fare) || 0;
        const perPersonFare = totalFare > 0 ? (totalFare / totalSeats).toFixed(2) : 0;

        const submitData = {
            origin: rideData.origin,
            originLat: rideData.originLat,
            originLng: rideData.originLng,
            destination: rideData.destination,
            destLat: rideData.destLat,
            destLng: rideData.destLng,
            departureTime: new Date(rideData.departureTime).toISOString(),
            seats: totalSeats,
            fare: totalFare,
            vehicleType: rideData.vehicleType,
            genderPref: rideData.genderPref
        };

        const seatLimit = getSeatLimitByVehicleType(submitData.vehicleType);
        if (submitData.seats > seatLimit) {
            setError(`${submitData.vehicleType} allows maximum ${seatLimit} seats`);
            setLoading(false);
            return;
        }

        try {
            const response = await ridesAPI.createRide(submitData);
            
            // Show success notification popup
            addNotification({
                type: 'success',
                title: '🚗 Ride Created Successfully!',
                message: `₹${perPersonFare}/person when shared. Finding matches...`
            });
            playNotificationSound();
            
            setSuccess(`Ride created! ₹${perPersonFare}/person when shared. Finding matches...`);
            setShowCreateRide(false);
            
            // Reset form
            setRideData({
                origin: '', originLat: null, originLng: null,
                destination: '', destLat: null, destLng: null,
                departureTime: '', seats: 1, fare: '',
                vehicleType: 'cab', genderPref: 'any'
            });
            
            setTimeout(() => {
                setSuccess('');
                handleSearchRides(); // Auto-search for matches
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create ride');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchRides = async () => {
        setLoading(true);
        setError('');

        try {
            // Fetch all available rides using the simpler endpoint
            await fetchAllAvailableRides();
            setShowFindMatches(true);
            
            // Show notification about available rides
            if (rides.length > 0) {
                addNotification({
                    type: 'success',
                    title: '🔍 Rides Found!',
                    message: `Found ${rides.length} available ride${rides.length > 1 ? 's' : ''} matching your route`
                });
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch rides');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllAvailableRides = async () => {
        try {
            const response = await ridesAPI.getAvailableRides();
            const available = Array.isArray(response?.rides) ? response.rides : [];
            setRides(available.filter((ride) => getRideRemainingMs(ride) > 0));
        } catch (err) {
            console.error('Failed to fetch rides:', err);
            setRides([]);
        }
    };

    // Calculate fare per person
    const calculateFarePerPerson = (totalFare, seats) => {
        const fare = parseFloat(totalFare) || 0;
        const seatCount = parseInt(seats) || 1;
        return fare > 0 ? (fare / seatCount).toFixed(2) : '0.00';
    };

    const handleRequestToJoin = async (rideId) => {
        setLoading(true);
        setError('');

        try {
            await matchesAPI.createMatch(rideId);
            addNotification({
                type: 'success',
                title: 'Match Request Sent!',
                message: 'Ride creator has been notified. Wait for confirmation.'
            });
            // Remove the ride from available list
            setRides(prev => prev.filter(ride => ride.id !== rideId));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send join request');
            setTimeout(() => setError(''), 5000);
        } finally {
            setLoading(false);
        }
    };

    const handleGetMyRides = async (showModal = true) => {
        setLoading(true);
        setError('');

        try {
            const response = await ridesAPI.getMyRides();
            const allRides = response.rides || [];
            
            // Only show rides created by current user (not rides they requested to join)
            const myCreatedRides = allRides.filter(ride => 
                (ride.creator?.id === user.id || ride.userId === user.id) && ['pending', 'matched'].includes(ride.status)
            );
            setMyRides(myCreatedRides);
            
            // Also load matches and pending requests
            await loadMatches();
            
            if (showModal) {
                setShowMyRides(true);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch your rides');
        } finally {
            setLoading(false);
        }
    };

    const loadMatches = async () => {
        try {
            const response = await matchesAPI.getMyMatches();
            const allMatchesResponse = response.matches || [];
            
            // Separate pending requests (where I'm the creator) from accepted matches
            const pending = allMatchesResponse.filter(m => m.status === 'pending' && m.user1.id === user.id);
            const accepted = allMatchesResponse.filter(m => m.status === 'accepted');
            const rejected = allMatchesResponse.filter(m => m.status === 'rejected');
            
            setAllMatches(allMatchesResponse);
            setPendingRequests(pending);
            setMatches(accepted);
            setRejectedMatches(rejected);
        } catch (error) {
            console.error('Failed to load matches:', error);
        }
    };

    const handleAcceptMatch = async (matchId) => {
        setLoading(true);
        try {
            await matchesAPI.acceptMatch(matchId);
            addNotification({
                type: 'success',
                title: 'Match Accepted!',
                message: 'You can now chat with your ride partner.'
            });
            // Refresh data
            await loadMatches();
            await handleGetMyRides(false);
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to accept match');
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleRejectMatch = async (matchId) => {
        if (!confirm('Are you sure you want to reject this match request?')) return;
        
        setLoading(true);
        try {
            await matchesAPI.rejectMatch(matchId);
            addNotification({
                type: 'success',
                title: 'Request Rejected',
                message: 'The match request has been declined.'
            });
            // Refresh data
            await loadMatches();
            await handleGetMyRides(false);
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to reject match');
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChat = (match) => {
        setActiveChat(match);
    };

    const handleDeleteRide = async (rideId) => {
        if (!confirm('Are you sure you want to delete this ride?')) return;

        setLoading(true);
        try {
            await ridesAPI.deleteRide(rideId);
            setSuccess('Ride deleted successfully!');
            // Refresh the list
            handleGetMyRides();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete ride');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-accent-green';
            case 'matched': return 'text-blue-400';
            case 'completed': return 'text-gray-400';
            case 'cancelled': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active': return 'bg-accent-green/20 text-accent-green';
            case 'matched': return 'bg-blue-500/20 text-blue-400';
            case 'completed': return 'bg-gray-500/20 text-gray-400';
            case 'cancelled': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    if (!user) return null;

    return (
        <div className={`min-h-screen overflow-hidden relative font-poppins ${isLightMode ? 'bg-[#f4f7fb]' : 'bg-[#050505]'}`}>
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-accent-green/[0.04] pointer-events-none" />
            <div className="absolute inset-0 z-0 opacity-30">
                <svg className="w-full h-full" width="100%" height="100%">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <div className="container mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto"
                >
                    {/* Header */}
                    <div className={`mb-6 sm:mb-8 relative overflow-hidden rounded-3xl border px-5 py-6 sm:px-7 sm:py-7 ${isLightMode ? 'bg-gradient-to-br from-white via-emerald-50/40 to-cyan-50 border-emerald-100' : 'bg-gradient-to-br from-[#0d1713] via-[#0b1010] to-[#071117] border-white/10'}`}>
                        <div className="absolute -right-8 -top-10 w-40 h-40 sm:w-48 sm:h-48 opacity-80 pointer-events-none">
                            {heroLottieData ? (
                                <Lottie animationData={heroLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-accent-green/25 via-cyan-400/20 to-blue-500/20 blur-2xl" />
                            )}
                        </div>
                        <div className="relative z-10 max-w-2xl">
                            <p className={`text-[11px] uppercase tracking-[0.32em] mb-2 ${isLightMode ? 'text-emerald-700' : 'text-accent-green/80'}`}>
                                Gen Z Ride Command Center
                            </p>
                            <h1 className={`text-3xl sm:text-4xl md:text-5xl font-black mb-3 tracking-tight leading-tight ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>
                                Welcome to <span className="text-accent-green">Spllit Lift</span>
                            </h1>
                            <p className={`text-sm sm:text-base ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                Fast ride dashboard, ready to go.
                            </p>
                        </div>
                    </div>

                    {/* User Profile Card */}
                    <div className="sticky top-4 z-20 mb-5">
                        <div className={`backdrop-blur-xl border rounded-[28px] p-4 sm:p-5 shadow-xl ${isLightMode ? 'bg-gradient-to-br from-[#ffffff] via-[#f5fbff] to-[#f4fff8] border-emerald-100 shadow-[0_20px_45px_rgba(16,185,129,0.12)]' : 'bg-gradient-to-br from-[#0f1815]/95 to-[#0a0d0c]/95 border-white/10'}`}>
                            <div className="flex flex-col gap-4 sm:gap-5">
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                                    <button
                                        type="button"
                                        onClick={handleOpenStickerPicker}
                                        className="group w-full text-left active:scale-[0.99] transition-transform"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className="relative shrink-0">
                                                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full p-[3px] bg-gradient-to-br from-accent-green via-cyan-400 to-blue-500 shadow-[0_0_26px_rgba(16,185,129,0.24)]">
                                                    <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden ${isLightMode ? 'bg-white' : 'bg-[#07110d]'}`}>
                                                        {user?.profilePhoto ? (
                                                            <img src={user.profilePhoto} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                                                        ) : (
                                                            <span className={`text-2xl font-black ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>{profileInitials || 'SR'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent-green text-black flex items-center justify-center shadow-lg ${isLightMode ? 'border-2 border-white' : 'border-2 border-[#07110d]'}`}>
                                                    <FaPlus className="text-xs" />
                                                </span>
                                                <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg ${isLightMode ? 'border-2 border-white' : 'border-2 border-[#07110d]'}`}>
                                                    <FaCheckCircle className="text-xs" />
                                                </span>
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className={`text-[11px] uppercase tracking-[0.28em] ${isLightMode ? 'text-gray-500' : 'text-gray-500'}`}>Profile</p>
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${isLightMode ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}>
                                                        <FaCheckCircle className="text-[11px]" /> Verified
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${isLightMode ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-accent-green/15 text-accent-green border border-accent-green/20'}`}>
                                                        Lv {profileLevel}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${isLightMode ? 'bg-gray-100 text-gray-700 border border-gray-200' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                                                        {selectedStickerLabel}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        className={`max-w-[220px] truncate px-3 py-1 rounded-full text-xs font-medium cursor-default ${isLightMode ? 'bg-gray-100 text-gray-700 border border-gray-200' : 'bg-white/5 text-gray-300 border border-white/10'}`}
                                                    >
                                                        {user.college || 'IIT Madras BS Degree'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleOpenCollegeModal}
                                                        className={`max-w-[220px] truncate px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80 ${isLightMode ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200' : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'}`}
                                                    >
                                                        {user.college || 'IIT Madras BS Degree'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleOpenPhoneModal}
                                                        className={`max-w-[140px] truncate px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80 ${isLightMode ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200' : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'}`}
                                                    >
                                                        {user.phone || 'Add phone'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 xl:flex xl:flex-wrap xl:items-center xl:justify-end w-full xl:w-auto xl:pt-0">
                                    <div className="relative w-full sm:w-auto" ref={notificationBellRef}>
                                        <button
                                            type="button"
                                            onClick={handleRideBellClick}
                                            className={`w-full sm:w-auto h-11 sm:h-12 px-3 sm:px-4 rounded-xl transition-all relative flex items-center justify-center gap-2 font-semibold ${isLightMode ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-800 hover:from-emerald-100 hover:to-teal-100' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
                                        >
                                            <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                                                {alertsLottieData ? (
                                                    <Lottie animationData={alertsLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                                ) : (
                                                    <FaBell className="text-accent-green text-sm sm:text-base" />
                                                )}
                                            </span>
                                            <span className={`text-sm ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>Alerts</span>
                                            {alertBadgeCount > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center font-bold leading-none">
                                                    {alertBadgeLabel}
                                                </span>
                                            )}
                                        </button>
                                        <AnimatePresence>
                                            {showRideAnnouncements && (
                                                <motion.div
                                                    ref={notificationPanelRef}
                                                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                                    onClick={(event) => {
                                                        if (event.target === event.currentTarget) {
                                                            setShowRideAnnouncements(false);
                                                        }
                                                    }}
                                                    className="fixed inset-0 z-[10001] bg-black/55 backdrop-blur-[2px] px-2 pt-[calc(env(safe-area-inset-top)+5rem)] flex justify-center pointer-events-auto lg:bg-transparent lg:backdrop-blur-0 lg:px-0 lg:pt-0 lg:block lg:absolute lg:inset-auto lg:left-auto lg:top-auto lg:right-0 lg:mt-3"
                                                >
                                                    <div className="w-full max-w-[32rem] max-h-[calc(100dvh-6.5rem)] bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden lg:w-[28rem] lg:max-h-none lg:rounded-3xl">
                                                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                                        <div>
                                                            <h3 className="text-white font-bold text-lg">Notifications</h3>
                                                            <p className="text-gray-500 text-xs mt-1">
                                                                Ride updates, matches, and chat activity
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setShowRideAnnouncements(false);
                                                            }}
                                                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </div>
                                                    <div className="max-h-[24rem] overflow-y-auto">
                                                        {visibleNotificationFeed.length === 0 ? (
                                                            <div className="px-5 py-8 text-center text-gray-500">
                                                                <div className="mx-auto mb-3 w-24 h-24 sm:w-28 sm:h-28">
                                                                    {alertsLottieData ? (
                                                                        <Lottie animationData={alertsLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                                                    ) : (
                                                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-accent-green/20 to-blue-500/20 blur-xl" />
                                                                    )}
                                                                </div>
                                                                <p className="text-sm font-semibold text-gray-300">No notifications yet</p>
                                                                <p className="text-xs mt-1 text-gray-500">Fresh alerts and chat updates will drop here.</p>
                                                            </div>
                                                        ) : (
                                                            visibleNotificationFeed.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={() => handleAlertItemClick(item)}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                                            event.preventDefault();
                                                                            handleAlertItemClick(item);
                                                                        }
                                                                    }}
                                                                    className="w-full text-left px-5 py-4 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer focus:outline-none focus:bg-white/5"
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="w-11 h-11 rounded-2xl bg-accent-green/15 border border-accent-green/20 flex items-center justify-center flex-shrink-0">
                                                                            {item.type === 'ride' ? (
                                                                                <FaCar className="text-accent-green" />
                                                                            ) : item.type === 'match' ? (
                                                                                <FaComments className="text-purple-400" />
                                                                            ) : (
                                                                                <FaBell className="text-accent-green" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1">
                                                                                <div>
                                                                                    <p className="text-white font-semibold leading-tight break-words">
                                                                                        {item.title}
                                                                                    </p>
                                                                                    <p className="text-gray-500 text-xs mt-1">
                                                                                        {item.type === 'ride' ? 'Ride announcement' : item.type === 'match' ? 'Match update' : 'Notification'}
                                                                                    </p>
                                                                                </div>
                                                                                <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 whitespace-nowrap shrink-0">
                                                                                    {formatAnnouncementTime(item.timestamp)}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-gray-300 text-sm leading-relaxed break-words">
                                                                                {item.message}
                                                                            </p>
                                                                            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs">
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {item.type === 'ride' && item.meta?.origin && (
                                                                                        <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                                                                                            {item.meta.origin}
                                                                                        </span>
                                                                                    )}
                                                                                    {item.type === 'ride' && item.meta?.vehicleType && (
                                                                                        <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10 capitalize">
                                                                                            {item.meta.vehicleType}
                                                                                        </span>
                                                                                    )}
                                                                                    {item.type === 'ride' && item.meta?.fare ? (
                                                                                        <span className="px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                                                                                            ₹{item.meta.fare}
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                                                    {(item.matchId || item.chatRoomId) && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(event) => {
                                                                                                event.stopPropagation();
                                                                                                handleNotificationItemClick(item);
                                                                                            }}
                                                                                            className="px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green hover:bg-accent-green/10 transition-colors"
                                                                                        >
                                                                                            Open chat
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        type="button"
                                                                                        onMouseDown={(event) => event.stopPropagation()}
                                                                                        onClick={(event) => {
                                                                                            event.stopPropagation();
                                                                                            removeNotificationFeedItem(item.id);
                                                                                        }}
                                                                                        className="w-8 h-8 rounded-full border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                                                                                    >
                                                                                        <FaTimes />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    {notificationFeed.length > visibleNotificationFeed.length && (
                                                        <div className="px-5 pb-4 pt-1 text-[11px] text-gray-500">
                                                            Showing latest 2 alerts.
                                                        </div>
                                                    )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleMessageCenterClick}
                                        className={`w-full sm:w-auto h-11 sm:h-12 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold text-sm ${isLightMode ? 'bg-gradient-to-r from-slate-50 to-zinc-50 border border-slate-200 text-slate-700 hover:from-slate-100 hover:to-zinc-100' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}
                                    >
                                        <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                                            {inboxLottieData ? (
                                                <Lottie animationData={inboxLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                            ) : (
                                                <FaComments className="text-sm" />
                                            )}
                                        </span>
                                        <span>Inbox</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMatchedCenterClick('pending')}
                                        className={`relative w-full sm:w-auto h-11 sm:h-12 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold text-sm ${isLightMode ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-700 hover:from-blue-100 hover:to-cyan-100' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}
                                    >
                                        <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                                            {matchLottieData ? (
                                                <Lottie animationData={matchLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                            ) : (
                                                <FaCheck className="text-sm" />
                                            )}
                                        </span>
                                        <span>Matches</span>
                                        {matchedActionCount > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-4 h-4 sm:min-w-5 sm:h-5 px-1 rounded-full bg-red-500 text-white text-[10px] sm:text-[11px] leading-4 sm:leading-5 font-bold text-center">
                                                {matchedActionCount > 99 ? '99+' : matchedActionCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowSOSModal(true)}
                                        className={`w-full sm:w-auto h-11 sm:h-12 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold text-sm animate-pulse ${isLightMode ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100' : 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/20'}`}
                                    >
                                        <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shrink-0">
                                            {sosLottieData ? (
                                                <Lottie animationData={sosLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                            ) : (
                                                <FaExclamationTriangle className="text-sm" />
                                            )}
                                        </span>
                                        <span>SOS</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsLightMode((prev) => !prev)}
                                        className={`h-11 sm:h-12 rounded-xl border transition-all flex items-center justify-center ${isLightMode ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'} col-span-1 xl:w-12 xl:px-0`}
                                        title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                                        aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                                    >
                                        {isLightMode ? <FaMoon className="text-sm" /> : <FaSun className="text-sm" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className={`h-11 sm:h-12 rounded-xl border transition-all flex items-center justify-center ${isLightMode ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' : 'bg-white/5 border-white/10 text-red-300 hover:bg-red-500/10'} col-span-1 xl:w-12 xl:px-0`}
                                        title="Logout"
                                        aria-label="Logout"
                                    >
                                        <FaSignOutAlt className="text-sm" />
                                    </button>
                                    </div>
                                </div>

                                <div className={`inline-flex flex-wrap items-center gap-2 p-1 rounded-2xl border ${isLightMode ? 'bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-100' : 'bg-white/[0.03] border-white/10'} xl:self-end`}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveProfileTab('overview')}
                                        className={`min-w-[88px] px-3 py-2 rounded-xl border text-xs font-semibold ${activeProfileTab === 'overview' ? 'border-accent-green bg-accent-green/15 text-accent-green' : isLightMode ? 'border-gray-200 bg-white text-gray-600' : 'border-white/10 bg-white/5 text-gray-300'}`}
                                    >
                                        Overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveProfileTab('performance')}
                                        className={`min-w-[88px] px-3 py-2 rounded-xl border text-xs font-semibold ${activeProfileTab === 'performance' ? 'border-accent-green bg-accent-green/15 text-accent-green' : isLightMode ? 'border-gray-200 bg-white text-gray-600' : 'border-white/10 bg-white/5 text-gray-300'}`}
                                    >
                                        Performance
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveProfileTab('rewards')}
                                        className={`min-w-[88px] px-3 py-2 rounded-xl border text-xs font-semibold ${activeProfileTab === 'rewards' ? 'border-accent-green bg-accent-green/15 text-accent-green' : isLightMode ? 'border-gray-200 bg-white text-gray-600' : 'border-white/10 bg-white/5 text-gray-300'}`}
                                    >
                                        Rewards
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4">{profileTabs[activeProfileTab] || profileTabs.overview}</div>
                        </div>
                    </div>

            {/* Profile Sticker Picker */}
            <AnimatePresence>
                {showProfileStickerPicker && user && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowProfileStickerPicker(false)}
                    >
                        <motion.div
                            initial={{ y: 18, scale: 0.98, opacity: 0 }}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            exit={{ y: 18, scale: 0.98, opacity: 0 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#08130f] shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                <div>
                                    <h4 className="text-lg font-bold text-white">Pick Your Sticker Avatar</h4>
                                    <p className="text-xs text-gray-400">Choose a sticker, or keep your current profile photo.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelStickerPicker}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="p-4 sm:p-5 max-h-[72vh] overflow-y-auto">
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    <StickerChoiceCard
                                        label="None"
                                        active={pendingProfilePhoto === (stickerPickerOriginalPhoto || '')}
                                        onClick={handleSelectNoneSticker}
                                    />
                                    {profileStickerCards.map((avatar) => (
                                        <ProfileStickerCard
                                            key={avatar.id}
                                            avatar={avatar}
                                            isSelected={pendingProfilePhoto === avatar.url}
                                            onSelect={handleSelectStickerAvatar}
                                        />
                                    ))}
                                </div>

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectNoneSticker}
                                        className="sm:col-span-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all"
                                    >
                                        None
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelStickerPicker}
                                        className="sm:col-span-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApplyStickerSelection}
                                        className="sm:col-span-1 px-4 py-3 rounded-xl bg-accent-green text-black font-bold hover:bg-accent-green/90 transition-all"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Phone Modal */}
            <AnimatePresence>
                {showPhoneModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowPhoneModal(false)}
                        className="fixed inset-0 z-[10002] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full max-w-sm rounded-3xl p-6 sm:p-8 ${isLightMode ? 'bg-white shadow-xl' : 'bg-[#0f0f0f] border border-white/10 shadow-2xl'}`}
                        >
                            <div className="mb-6">
                                <h2 className={`text-2xl font-bold mb-2 ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>
                                    Add Phone Number
                                </h2>
                                <p className={`text-sm ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                    Keep your profile up-to-date for better ride matches
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                                        Phone Number (India)
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneInput}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setPhoneInput(value);
                                            setPhoneInputError('');
                                        }}
                                        placeholder="9876543210"
                                        className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                                            phoneInputError
                                                ? isLightMode ? 'border-red-300 bg-red-50 text-red-900' : 'border-red-500/30 bg-red-500/10 text-white'
                                                : isLightMode ? 'border-gray-200 bg-white text-[#0d1a16]' : 'border-white/10 bg-white/5 text-white'
                                        } focus:outline-none focus:ring-2 focus:ring-accent-green/50`}
                                    />
                                    {phoneInputError && (
                                        <p className={`text-xs mt-2 font-medium ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>
                                            {phoneInputError}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancelPhoneModal}
                                        disabled={savingPhone}
                                        className={`px-4 py-3 rounded-xl border font-semibold text-sm transition-all disabled:opacity-50 ${isLightMode ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSavePhone}
                                        disabled={savingPhone || phoneInput.length === 0}
                                        className={`px-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                                            savingPhone || phoneInput.length === 0
                                                ? 'bg-accent-green/50 text-black'
                                                : 'bg-accent-green text-black hover:bg-accent-green/90'
                                        }`}
                                    >
                                        {savingPhone ? 'Saving...' : 'Save'}

                                                {/* College Modal */}
                                                <AnimatePresence>
                                                    {showCollegeModal && (
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            onClick={() => setShowCollegeModal(false)}
                                                            className="fixed inset-0 z-[10002] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
                                                        >
                                                            <motion.div
                                                                initial={{ scale: 0.95, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                exit={{ scale: 0.95, opacity: 0 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className={`w-full max-w-sm rounded-3xl p-6 sm:p-8 ${isLightMode ? 'bg-white shadow-xl' : 'bg-[#0f0f0f] border border-white/10 shadow-2xl'}`}
                                                            >
                                                                <div className="mb-6">
                                                                    <h2 className={`text-2xl font-bold mb-2 ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>
                                                                        Update College
                                                                    </h2>
                                                                    <p className={`text-sm ${isLightMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                        Let other riders know where you study
                                                                    </p>
                                                                </div>

                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <label className={`block text-sm font-medium mb-2 ${isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>
                                                                            College/University Name
                                                                        </label>
                                                                        <textarea
                                                                            value={collegeInput}
                                                                            onChange={(e) => {
                                                                                const value = e.target.value.slice(0, 100);
                                                                                setCollegeInput(value);
                                                                                setCollegeInputError('');
                                                                            }}
                                                                            placeholder="IIT Madras (BS Degree)"
                                                                            rows="2"
                                                                            className={`w-full px-4 py-3 rounded-xl border text-sm transition-all resize-none ${
                                                                                collegeInputError
                                                                                    ? isLightMode ? 'border-red-300 bg-red-50 text-red-900' : 'border-red-500/30 bg-red-500/10 text-white'
                                                                                    : isLightMode ? 'border-gray-200 bg-white text-[#0d1a16]' : 'border-white/10 bg-white/5 text-white'
                                                                            } focus:outline-none focus:ring-2 focus:ring-accent-green/50`}
                                                                        />
                                                                        <div className={`text-xs mt-1 ${isLightMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                            {collegeInput.length}/100
                                                                        </div>
                                                                        {collegeInputError && (
                                                                            <p className={`text-xs mt-2 font-medium ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>
                                                                                {collegeInputError}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleCancelCollegeModal}
                                                                            disabled={savingCollege}
                                                                            className={`px-4 py-3 rounded-xl border font-semibold text-sm transition-all disabled:opacity-50 ${isLightMode ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleSaveCollege}
                                                                            disabled={savingCollege || collegeInput.length === 0}
                                                                            className={`px-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                                                                                savingCollege || collegeInput.length === 0
                                                                                    ? 'bg-accent-green/50 text-black'
                                                                                    : 'bg-accent-green text-black hover:bg-accent-green/90'
                                                                            }`}
                                                                        >
                                                                            {savingCollege ? 'Saving...' : 'Save'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Create Ride Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setShowCreateRide(true)}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-5 sm:p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-accent-green/20 border-2 border-accent-green rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden">
                                {createRideLottieData ? (
                                    <Lottie animationData={createRideLottieData} {...lottiePlaybackProps} className="w-12 h-12 sm:w-14 sm:h-14" />
                                ) : (
                                    <FaCar className="text-accent-green text-lg sm:text-2xl" />
                                )}
                            </div>
                            <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">Create Ride</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Post your ride request and find students going to the same exam center within 30 minutes.
                            </p>
                            <div className="mt-5 text-accent-green font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>Create Now</span>
                                <span aria-hidden="true">•</span>
                                <span>Share Ride</span>
                            </div>
                        </motion.div>

                        {/* Find Matches Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => { setShowFindMatches(true); handleSearchRides(); }}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-5 sm:p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-500/20 border-2 border-purple-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden">
                                {findRideLottieData ? (
                                    <Lottie animationData={findRideLottieData} {...lottiePlaybackProps} className="w-12 h-12 sm:w-14 sm:h-14" />
                                ) : (
                                    <FaMapMarkerAlt className="text-purple-500 text-lg sm:text-2xl" />
                                )}
                            </div>
                            <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">Find Matches</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Browse available rides and connect with verified students for safe group travel.
                            </p>
                            <div className="mt-5 text-accent-green font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>Find Rides</span>
                                <span aria-hidden="true">•</span>
                                <span>Browse Fast</span>
                            </div>
                        </motion.div>

                        {/* My Rides Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={handleGetMyRides}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-5 sm:p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500/20 border-2 border-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden">
                                {myRideLottieData ? (
                                    <Lottie animationData={myRideLottieData} {...lottiePlaybackProps} className="w-12 h-12 sm:w-14 sm:h-14" />
                                ) : (
                                    <FaUser className="text-blue-500 text-lg sm:text-2xl" />
                                )}
                            </div>
                            <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">My Rides</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                View and manage your active rides, check matches, and track your ride history.
                            </p>
                            <div className="mt-5 text-accent-green font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>View Rides</span>
                                <span aria-hidden="true">•</span>
                                <span>Manage</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Subadmin Management - Only show for master admin */}
                    {user?.role === 'admin' && user?.isAdmin === true && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-8"
                        >
                            <SubadminManagement />
                        </motion.div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6 bg-accent-green/10 border border-accent-green/20 rounded-2xl p-6 text-center"
                        >
                            <p className="text-accent-green font-bold text-lg">
                                🎉 {success}
                            </p>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center"
                        >
                            <p className="text-red-400 font-bold text-lg">
                                ❌ {error}
                            </p>
                        </motion.div>
                    )}

                </motion.div>
            </div>

            {/* Create Ride Modal - Enhanced */}
            <AnimatePresence>
                {showCreateRide && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowCreateRide(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-bg-secondary to-bg-secondary/80 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">Create Ride</h2>
                                    <p className="text-gray-400 text-sm">Fill in the details to share your ride</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateRide(false)}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateRide} className="space-y-8">
                                {/* Location Section */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-5">
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <FaMapMarkerAlt className="text-accent-green" /> Journey Details
                                    </h3>

                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                            <FaMapPin className="text-accent-green text-lg" />
                                            <span>Pickup Location</span>
                                            <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            ref={originRef}
                                            type="text"
                                            value={rideData.origin}
                                            onChange={(e) => setRideData({...rideData, origin: e.target.value})}
                                            required
                                            placeholder="e.g., Velachery, IIT Madras..."
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">Start typing to see Google Maps suggestions</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                            <FaMapMarkerAlt className="text-purple-400 text-lg" />
                                            <span>Drop Location</span>
                                            <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            ref={destinationRef}
                                            type="text"
                                            value={rideData.destination}
                                            onChange={(e) => setRideData({...rideData, destination: e.target.value})}
                                            required
                                            placeholder="e.g., Fortune Tower, Anna University..."
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">Autocomplete will find your destination</p>
                                    </div>
                                </div>

                                {/* Time & Vehicle Section */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-5">
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <FaClock className="text-accent-green" /> Schedule & Vehicle
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                                <FaCalendarAlt className="text-accent-green" />
                                                <span>Departure Time</span>
                                                <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={rideData.departureTime}
                                                onChange={(e) => setRideData({...rideData, departureTime: e.target.value})}
                                                required
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                                <FaCar className="text-accent-green" />
                                                <span>Vehicle Type</span>
                                                <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                value={rideData.vehicleType}
                                                onChange={(e) => {
                                                    const nextVehicleType = e.target.value;
                                                    const seatLimit = getSeatLimitByVehicleType(nextVehicleType);
                                                    const safeSeats = Math.min(parseInt(rideData.seats || 1, 10), seatLimit);
                                                    setRideData({
                                                        ...rideData,
                                                        vehicleType: nextVehicleType,
                                                        seats: safeSeats
                                                    });
                                                }}
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all appearance-none"
                                                style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2366ff00' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}
                                            >
                                                <option value="cab" style={{ color: '#111827', backgroundColor: '#ffffff' }}>🚕 Cab (4 seats)</option>
                                                <option value="auto" style={{ color: '#111827', backgroundColor: '#ffffff' }}>🚌 Auto (3 seats)</option>
                                                <option value="cab-xl" style={{ color: '#111827', backgroundColor: '#ffffff' }}>🚐 Cab XL (7 seats)</option>
                                                <option value="bike" style={{ color: '#111827', backgroundColor: '#ffffff' }}>🏍️ Bike (1 seat)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Capacity & Pricing Section */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-5">
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <FaUsers className="text-accent-green" /> Capacity & Pricing
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                                <FaUsers className="text-accent-green" />
                                                <span>Available Seats</span>
                                                <span className="text-red-400">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={rideData.seats}
                                                    onChange={(e) => {
                                                        const requestedSeats = parseInt(e.target.value || '1', 10);
                                                        const seatLimit = getSeatLimitByVehicleType(rideData.vehicleType);
                                                        const safeSeats = Math.max(1, Math.min(Number.isNaN(requestedSeats) ? 1 : requestedSeats, seatLimit));
                                                        setRideData({ ...rideData, seats: safeSeats });
                                                    }}
                                                    min="1"
                                                    max={getSeatLimitByVehicleType(rideData.vehicleType)}
                                                    required
                                                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded">
                                                    Max: {getSeatLimitByVehicleType(rideData.vehicleType)}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                                <FaRupeeSign className="text-accent-green" />
                                                <span>Total Fare</span>
                                                <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={rideData.fare}
                                                onChange={(e) => setRideData({...rideData, fare: e.target.value})}
                                                min="0"
                                                step="0.01"
                                                placeholder="e.g., 300"
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Fare Breakdown */}
                                    {rideData.fare && rideData.seats && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-accent-green/10 border border-accent-green/30 rounded-lg p-4 flex items-center justify-between"
                                        >
                                            <span className="text-gray-200 font-medium">Price per person</span>
                                            <span className="text-2xl font-black text-accent-green">₹{calculateFarePerPerson(rideData.fare, rideData.seats)}</span>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Preferences Section */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 mb-5">
                                        <FaUser className="text-accent-green" /> Preferences
                                    </h3>

                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-3">Gender Preference</label>
                                        <select
                                            value={rideData.genderPref}
                                            onChange={(e) => setRideData({...rideData, genderPref: e.target.value})}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-white focus:outline-none focus:border-accent-green focus:bg-white/8 focus:ring-2 focus:ring-accent-green/20 transition-all appearance-none"
                                            style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2366ff00' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}
                                        >
                                            <option value="any" style={{ color: '#111827', backgroundColor: '#ffffff' }}>👥 Any</option>
                                            <option value="male" style={{ color: '#111827', backgroundColor: '#ffffff' }}>👨 Male Only</option>
                                            <option value="female" style={{ color: '#111827', backgroundColor: '#ffffff' }}>👩 Female Only</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-2">All passengers will see your preference</p>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-accent-green to-accent-green/80 text-black font-black text-lg rounded-xl hover:from-accent-green/90 hover:to-accent-green/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-accent-green/30 transform hover:scale-[1.02] active:scale-95"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                                            Creating your ride...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-6 h-6 flex items-center justify-center">
                                                {createRideLottieData ? (
                                                    <Lottie animationData={createRideLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                                ) : (
                                                    <FaCar className="text-base" />
                                                )}
                                            </span>
                                            Create Ride & Find Matches
                                        </span>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Find Matches Modal */}
            <AnimatePresence>
                {showFindMatches && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowFindMatches(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white">Available Rides</h2>
                                <button
                                    onClick={() => setShowFindMatches(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-green mx-auto"></div>
                                    <p className="text-gray-400 mt-4">Loading available rides...</p>
                                </div>
                            ) : rides.filter((ride) => getRideRemainingMs(ride) > 0).length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="mx-auto mb-4 w-20 h-20">
                                        {findRideLottieData ? (
                                            <Lottie animationData={findRideLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                        ) : (
                                            <FaCar className="text-gray-600 text-6xl mx-auto" />
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-lg">No rides available at the moment</p>
                                    <p className="text-gray-500 text-sm mt-2">Create a ride to get started!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {rides.filter((ride) => getRideRemainingMs(ride) > 0).map((ride) => (
                                        <div
                                            key={ride.id}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-accent-green/30 transition-all"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                                                <div>
                                                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 break-words">
                                                        {ride.origin} → {ride.destination}
                                                    </h3>
                                                    <p className="text-gray-400 text-sm">
                                                        <FaClock className="inline mr-2" />
                                                        {new Date(ride.departureTime).toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-accent-green mt-2 font-semibold">
                                                        Expires in: {formatRideCountdown(getRideRemainingMs(ride))}
                                                    </p>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    <p className="text-accent-green font-bold text-lg">
                                                        {ride.seatsAvailable} seats
                                                    </p>
                                                    <p className="text-gray-500 text-sm">available</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                                <div className="bg-white/5 rounded-xl p-3">
                                                    <p className="text-gray-500 text-xs">Vehicle</p>
                                                    <p className="text-white font-semibold">{ride.vehicleType}</p>
                                                </div>
                                                <div className="bg-white/5 rounded-xl p-3">
                                                    <p className="text-gray-500 text-xs">Fare</p>
                                                    <p className="text-accent-green font-semibold">₹{ride.fare}</p>
                                                </div>
                                            </div>
                                            {ride.creator && (
                                                <div className="bg-white/5 rounded-xl p-3 mb-4">
                                                    <p className="text-gray-500 text-xs mb-1">Rider</p>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-accent-green flex items-center justify-center">
                                                            <FaUser className="text-black" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white font-semibold break-words">{ride.creator.name}</p>
                                                            <p className="text-gray-400 text-xs break-words">{ride.creator.college}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={() => handleRequestToJoin(ride.id)}
                                                    disabled={loading}
                                                    className="flex-1 py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {loading ? 'Sending...' : 'Request to Join'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* My Rides Modal */}
            <AnimatePresence>
                {showMyRides && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowMyRides(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-5xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white">My Rides</h2>
                                <button
                                    onClick={() => setShowMyRides(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-green mx-auto"></div>
                                    <p className="text-gray-400 mt-4">Loading your rides...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <p className="text-sm text-gray-300">
                                            Match request actions are now in the Matched section near Messages.
                                        </p>
                                    </div>

                                    {/* My Rides List */}
                                    <h3 className="text-xl font-bold text-white mb-4">My Created Rides</h3>
                                    {myRides.length === 0 ? (
                                        <div className="text-center py-12 bg-white/5 rounded-2xl">
                                            <div className="mx-auto mb-4 w-20 h-20">
                                                {myRideLottieData ? (
                                                    <Lottie animationData={myRideLottieData} {...lottiePlaybackProps} className="w-full h-full" />
                                                ) : (
                                                    <FaCar className="text-gray-600 text-6xl mx-auto" />
                                                )}
                                            </div>
                                            <p className="text-gray-400 text-lg">You haven't created any rides yet</p>
                                            <p className="text-gray-500 text-sm mt-2">Click "Create Ride" to get started!</p>
                                            <button
                                                onClick={() => {
                                                    setShowMyRides(false);
                                                    setShowCreateRide(true);
                                                }}
                                                className="mt-6 px-6 py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all"
                                            >
                                                Create Your First Ride
                                            </button>
                                        </div>
                                    ) : (
                                <div className="space-y-4">
                                    {myRides.map((ride) => (
                                        <div
                                            key={ride.id}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-accent-green/30 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                                        <h3 className="text-lg sm:text-xl font-bold text-white break-words">
                                                            {ride.origin} → {ride.destination}
                                                        </h3>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadge(ride.status)}`}>
                                                            {ride.status === 'pending' ? 'Active' : ride.status === 'matched' ? 'Inactive' : ride.status}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                        <div>
                                                            <p className="text-gray-500 text-xs mb-1">Departure</p>
                                                            <p className="text-white text-sm font-medium">
                                                                <FaClock className="inline mr-1" />
                                                                {new Date(ride.departureTime).toLocaleString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 text-xs mb-1">Vehicle</p>
                                                            <p className="text-white text-sm font-medium capitalize">
                                                                <FaCar className="inline mr-1" />
                                                                {ride.vehicleType}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 text-xs mb-1">Seats Available</p>
                                                            <p className="text-accent-green text-lg font-bold">
                                                                {ride.seatsAvailable}/{ride.seats}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 text-xs mb-1">Fare per Person</p>
                                                            <p className="text-white text-lg font-bold">
                                                                <FaRupeeSign className="inline text-sm" />
                                                                {ride.fare ? calculateFarePerPerson(ride.fare, ride.seats) : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {ride.status === 'pending' && getRideRemainingMs(ride) > 0 && (
                                                        <p className="text-xs text-accent-green mt-3 font-semibold">
                                                            Ride auto-inactivates in: {formatRideCountdown(getRideRemainingMs(ride))}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Matches Section */}
                                            {ride.matches && ride.matches.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-white/10">
                                                    <p className="text-gray-400 text-sm mb-3">
                                                        <FaUsers className="inline mr-2" />
                                                        {ride.matches.length} Match{ride.matches.length > 1 ? 'es' : ''} Found
                                                    </p>
                                                    <div className="space-y-2">
                                                        {ride.matches.slice(0, 3).map((match, idx) => (
                                                            <div key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                                                                <div className="w-10 h-10 bg-accent-green/20 rounded-full flex items-center justify-center">
                                                                    <FaUser className="text-accent-green" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-white font-medium text-sm">
                                                                        {match.rider?.name || 'Student'}
                                                                    </p>
                                                                    <p className="text-gray-500 text-xs">
                                                                        {match.rider?.college || 'IIT Madras'}
                                                                    </p>
                                                                </div>
                                                                <span className={`px-2 py-1 rounded-lg text-xs ${match.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                                    {match.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap gap-3 mt-4">
                                                {ride.status === 'active' && (
                                                    <>
                                                        <button className="flex-1 min-w-[9rem] py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all">
                                                            View Matches
                                                        </button>
                                                        <button className="flex-1 min-w-[9rem] py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all">
                                                            Edit Ride
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRide(ride.id)}
                                                            className="w-full sm:w-auto px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                                {ride.status === 'matched' && (
                                                    <button className="flex-1 py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all">
                                                        Start Chat
                                                    </button>
                                                )}
                                                {ride.status === 'completed' && (
                                                    <button className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl cursor-not-allowed">
                                                        Ride Completed
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Modal */}
            {activeChat && (
                <ChatModal
                    match={activeChat}
                    onClose={() => setActiveChat(null)}
                    currentUserId={user.id}
                    socketClient={socket}
                />
            )}

            <NotificationContainer
                notifications={notifications}
                onClose={removeNotification}
                onRemove={removeNotification}
            />

            {/* Message Center */}
            <AnimatePresence>
                {showMessageCenter && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowMessageCenter(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-3xl w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Messages</h2>
                                    <p className="text-gray-400 text-sm mt-2">Open a chat only after your ride gets accepted.</p>
                                </div>
                                <button
                                    onClick={() => setShowMessageCenter(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {matches.length === 0 ? (
                                <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                                    <FaComments className="text-6xl mx-auto text-gray-600 mb-4" />
                                    <p className="text-white text-lg font-semibold">No one has accepted your ride yet</p>
                                    <p className="text-gray-400 text-sm mt-2">
                                        Once a rider accepts, the chat will appear here in real time.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {matches.map((match) => {
                                        const otherUser = match.user1.id === user.id ? match.user2 : match.user1;
                                        return (
                                            <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-12 h-12 rounded-full bg-accent-green/20 flex items-center justify-center flex-shrink-0">
                                                            <FaUser className="text-accent-green" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white font-semibold truncate">{otherUser.name}</p>
                                                            <p className="text-gray-400 text-sm truncate">{otherUser.college}</p>
                                                            <p className="text-gray-500 text-xs mt-1 truncate">
                                                                {match.ride.origin} → {match.ride.destination}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setActiveChat(match);
                                                            setShowMessageCenter(false);
                                                        }}
                                                        disabled={!isMatchChatActive(match)}
                                                        className="w-full sm:w-auto px-5 py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isMatchChatActive(match) ? 'Open Chat' : 'Chat Expired'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SOS Modal */}
            <AnimatePresence>
                {showSOSModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[160] flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowSOSModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 12 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 12 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-lg bg-bg-secondary border border-red-500/30 rounded-3xl p-5 sm:p-7"
                        >
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div>
                                    <h3 className="text-2xl font-bold text-red-300 flex items-center gap-2">
                                        <FaExclamationTriangle /> Emergency SOS
                                    </h3>
                                    <p className="text-gray-400 text-sm mt-2">
                                        This sends your live location and phone number instantly to admin emergency desk.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSOSModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={22} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-300 block mb-2">Emergency Type</label>
                                    <select
                                        value={sosData.emergencyType}
                                        onChange={(event) => setSosData((prev) => ({ ...prev, emergencyType: event.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                                    >
                                        <option value="other" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Other emergency</option>
                                        <option value="accident" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Accident</option>
                                        <option value="medical" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Medical</option>
                                        <option value="harassment" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Harassment</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm text-gray-300 block mb-2">Optional Note</label>
                                    <textarea
                                        rows={3}
                                        value={sosData.message}
                                        onChange={(event) => setSosData((prev) => ({ ...prev, message: event.target.value }))}
                                        placeholder="Briefly describe the emergency"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSendSOS}
                                    disabled={sendingSOS}
                                    className="w-full py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {sendingSOS ? 'Sending SOS...' : 'Send SOS Now'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Admin Announcements Modal */}
            <AnimatePresence>
                {showAdminAnnouncements && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[115] flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowAdminAnnouncements(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 flex items-center gap-2">
                                        <FaBullhorn className="text-accent-green text-2xl sm:text-3xl" /> Campus Drops
                                    </h2>
                                    <p className="text-gray-400 text-sm">Fresh event posts from the admin desk</p>
                                </div>
                                <button
                                    onClick={() => setShowAdminAnnouncements(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {adminAnnouncements.length === 0 ? (
                                <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                                    <FaMicrophone className="mx-auto text-5xl text-gray-500 mb-4" />
                                    <p className="text-white text-lg font-semibold">No campus drops yet</p>
                                    <p className="text-gray-400 text-sm mt-2">Check back when admin posts an update, event, or location drop.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    {adminAnnouncements.map((announcement) => (
                                        <div key={announcement.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                            <div className="relative">
                                                {announcement.imageUrl ? (
                                                    <img
                                                        src={announcement.imageUrl}
                                                        alt={announcement.imageAlt || announcement.title}
                                                        className="w-full h-52 object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-52 bg-gradient-to-br from-accent-green/20 via-white/5 to-purple-500/20 flex items-center justify-center">
                                                        <FaImage className="text-5xl text-accent-green/80" />
                                                    </div>
                                                )}
                                                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-semibold">
                                                    New Drop
                                                </div>
                                            </div>
                                            <div className="p-4 sm:p-5 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="text-lg sm:text-xl font-bold text-white break-words">{announcement.title}</h3>
                                                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                                            <FaUser className="text-[10px]" /> {announcement.createdByName}
                                                        </p>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green text-[11px] font-semibold whitespace-nowrap">
                                                        {formatAnnouncementTime(announcement.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-gray-300 text-sm leading-relaxed break-words">{announcement.message}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-3 py-1 rounded-full bg-white/5 text-gray-200 border border-white/10 text-xs flex items-center gap-2">
                                                        <FaMapMarkerAlt className="text-accent-green" /> {announcement.location}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Matched Center */}
            <AnimatePresence>
                {showMatchedCenter && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[125] flex items-center justify-center p-3 sm:p-6"
                        onClick={() => setShowMatchedCenter(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Matched</h2>
                                    <p className="text-gray-400 text-sm mt-2">Manage pending requests and review accepted/declined rides.</p>
                                </div>
                                <button
                                    onClick={() => setShowMatchedCenter(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                                <button onClick={() => setMatchStatusFilter('pending')} className={`px-4 py-2 rounded-xl border ${matchStatusFilter === 'pending' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                    Pending ({pendingRequests.length})
                                </button>
                                <button onClick={() => setMatchStatusFilter('accepted')} className={`px-4 py-2 rounded-xl border ${matchStatusFilter === 'accepted' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                    Accepted ({matches.length})
                                </button>
                                <button onClick={() => setMatchStatusFilter('rejected')} className={`px-4 py-2 rounded-xl border ${matchStatusFilter === 'rejected' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                    Denied ({rejectedMatches.length})
                                </button>
                            </div>

                            {matchStatusFilter === 'pending' && (
                                <div className="space-y-3">
                                    {pendingRequests.length === 0 ? (
                                        <p className="text-gray-400">No pending requests.</p>
                                    ) : pendingRequests.map((match) => (
                                        <div key={match.id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-white font-semibold">{match.user2?.name}</p>
                                                    <p className="text-gray-400 text-sm">{match.ride?.origin} → {match.ride?.destination}</p>
                                                </div>
                                                <div className="flex w-full sm:w-auto gap-2">
                                                    <button onClick={() => handleAcceptMatch(match.id)} disabled={loading} className="flex-1 sm:flex-none px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50">Accept</button>
                                                    <button onClick={() => handleRejectMatch(match.id)} disabled={loading} className="flex-1 sm:flex-none px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50">Decline</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {matchStatusFilter === 'accepted' && (
                                <div className="space-y-3">
                                    {matches.length === 0 ? (
                                        <p className="text-gray-400">No accepted rides.</p>
                                    ) : matches.map((match) => {
                                        const otherUser = match.user1?.id === user.id ? match.user2 : match.user1;
                                        const canChat = isMatchChatActive(match);
                                        return (
                                            <div key={match.id} className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <p className="text-white font-semibold">{otherUser?.name}</p>
                                                        <p className="text-gray-400 text-sm">{match.ride?.origin} → {match.ride?.destination}</p>
                                                    </div>
                                                    <button
                                                        disabled={!canChat}
                                                        onClick={() => {
                                                            setActiveChat(match);
                                                            setShowMatchedCenter(false);
                                                        }}
                                                        className="w-full sm:w-auto px-5 py-2.5 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {canChat ? 'Open Chat' : 'Chat Expired'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {matchStatusFilter === 'rejected' && (
                                <div className="space-y-3">
                                    {rejectedMatches.length === 0 ? (
                                        <p className="text-gray-400">No denied requests.</p>
                                    ) : rejectedMatches.map((match) => {
                                        const otherUser = match.user1?.id === user.id ? match.user2 : match.user1;
                                        return (
                                            <div key={match.id} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                                                <p className="text-white font-semibold">{otherUser?.name}</p>
                                                <p className="text-gray-400 text-sm">{match.ride?.origin} → {match.ride?.destination}</p>
                                                <p className="text-red-300 text-xs mt-2">Request declined</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default Dashboard;

const MiniStat = ({ label, value, tone, isLightMode = false }) => {
    const toneClasses = {
        green: 'text-accent-green border-accent-green/30 bg-accent-green/10',
        blue: 'text-blue-300 border-blue-400/30 bg-blue-500/10',
        purple: 'text-purple-300 border-purple-400/30 bg-purple-500/10'
    };

    const lightToneClasses = {
        green: 'text-emerald-800 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50',
        blue: 'text-blue-800 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50',
        purple: 'text-purple-800 border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50'
    };

    return (
        <div className={`rounded-2xl border px-3 py-3 ${isLightMode ? (lightToneClasses[tone] || lightToneClasses.green) : (toneClasses[tone] || toneClasses.green)}`}>
            <p className={`text-[10px] uppercase tracking-wider ${isLightMode ? 'text-gray-500' : 'text-white/65'}`}>{label}</p>
            <p className={`text-lg font-black mt-1 ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>{value}</p>
        </div>
    );
};

const CompactBar = ({ label, value, isLightMode = false }) => (
    <div className={`rounded-2xl border p-4 ${isLightMode ? 'border-gray-200 bg-gradient-to-br from-white to-slate-50' : 'border-white/10 bg-black/20'}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
            <p className={`text-xs uppercase tracking-wider ${isLightMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-semibold ${isLightMode ? 'text-[#0d1a16]' : 'text-white'}`}>{value}%</p>
        </div>
        <div className={`h-2 w-full rounded-full overflow-hidden ${isLightMode ? 'bg-gray-200' : 'bg-white/10'}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-accent-green to-cyan-400" style={{ width: `${value}%` }} />
        </div>
    </div>
);

const RewardChip = ({ label, active, isLightMode = false }) => (
    <div className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${active ? 'border-accent-green/30 bg-accent-green/10' : isLightMode ? 'border-gray-200 bg-gradient-to-r from-white to-slate-50' : 'border-white/10 bg-black/20'}`}>
        <span className={`text-sm font-semibold ${active ? 'text-accent-green' : isLightMode ? 'text-gray-700' : 'text-gray-300'}`}>{label}</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-accent-green' : isLightMode ? 'text-gray-500' : 'text-gray-500'}`}>{active ? 'Unlocked' : 'Locked'}</span>
    </div>
);

const ProfileStickerCard = ({ avatar, isSelected, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(avatar.url)}
        className={`group rounded-3xl p-2 border transition-all ${isSelected
            ? 'border-accent-green bg-accent-green/15'
            : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/10'
            }`}
        title={`Set ${avatar.label} avatar`}
    >
        <div className={`mx-auto w-full aspect-square rounded-full p-[2px] ${isSelected ? 'bg-gradient-to-br from-accent-green to-cyan-300' : 'bg-white/10'}`}>
            <img
                src={avatar.url}
                alt={avatar.label}
                className="w-full h-full rounded-full object-cover bg-[#08120e]"
                loading="lazy"
            />
        </div>
        <span className="block mt-1 text-[10px] text-gray-400 capitalize truncate group-hover:text-white text-center">
            {avatar.label}
        </span>
    </button>
);

const StickerChoiceCard = ({ label, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group rounded-3xl p-2 border transition-all ${active
            ? 'border-accent-green bg-accent-green/15'
            : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/10'
            }`}
    >
        <div className={`mx-auto w-full aspect-square rounded-full flex items-center justify-center ${active ? 'bg-gradient-to-br from-accent-green to-cyan-300' : 'bg-white/10'}`}>
            <span className={`text-xs font-bold uppercase tracking-widest ${active ? 'text-black' : 'text-gray-300'}`}>{label}</span>
        </div>
        <span className="block mt-1 text-[10px] text-gray-400 capitalize truncate group-hover:text-white text-center">
            {label}
        </span>
    </button>
);
