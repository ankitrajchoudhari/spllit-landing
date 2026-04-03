import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaEnvelope, FaPhone, FaCar, FaMapMarkerAlt, FaTimes, FaCalendarAlt, FaClock, FaUsers, FaRupeeSign, FaMapPin, FaBell, FaCheck, FaTimes as FaTimesCircle, FaComments, FaEdit, FaTrash } from 'react-icons/fa';
import useAuthStore from '../store/authStore';
import socketService from '../services/socket';
import { ridesAPI, matchesAPI } from '../services/api';
import { NotificationContainer } from '../components/UserNotification';
import ChatModal from '../components/ChatModal';
import SubadminManagement from '../components/SubadminManagement';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/backendUrl';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&v=weekly`;
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
    const { user, isAuthenticated, logout } = useAuthStore();
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
    const [showMessageCenter, setShowMessageCenter] = useState(false);
    const [socket, setSocket] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [matches, setMatches] = useState([]);
    
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

    // Refs for autocomplete
    const originRef = useRef(null);
    const destinationRef = useRef(null);
    const originAutocompleteRef = useRef(null);
    const destAutocompleteRef = useRef(null);
    const originAutoDetectedRef = useRef(false);

    const rideAnnouncementSeenKey = `ride-announcements-seen-${user?.id || 'guest'}`;
    const notificationFeedKey = `notification-feed-${user?.id || 'guest'}`;
    const dismissedFeedKey = `notification-feed-dismissed-${user?.id || 'guest'}`;
    const notificationFeedExpiryMs = 2 * 60 * 60 * 1000;

    const getNowIso = () => new Date().toISOString();

    const pruneExpiredFeed = (items) => {
        const now = Date.now();
        return items.filter((item) => {
            const expiresAt = new Date(item.expiresAt || 0).getTime();
            return Number.isFinite(expiresAt) && expiresAt > now;
        });
    };

    const normalizeFeedItem = (item) => {
        const timestamp = item.timestamp || item.createdAt || getNowIso();
        return {
            id: item.id || `${item.type || 'info'}-${Date.now()}`,
            type: item.type || 'info',
            title: item.title || 'Notification',
            message: item.message || '',
            timestamp,
            expiresAt: item.expiresAt || new Date(new Date(timestamp).getTime() + notificationFeedExpiryMs).toISOString(),
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
                expiresAt: new Date(new Date(announcement.createdAt).getTime() + notificationFeedExpiryMs).toISOString(),
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

    const seenRideAnnouncementsAt = () => {
        const storedValue = localStorage.getItem(rideAnnouncementSeenKey);
        const parsed = storedValue ? new Date(storedValue) : null;
        return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
    };

    const unreadRideAnnouncementCount = rideAnnouncements.filter((announcement) => {
        const createdAt = new Date(announcement.createdAt || announcement.timestamp || 0);
        return createdAt > seenRideAnnouncementsAt();
    }).length;

    const notificationFeedCount = notificationFeed.length;

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

    useEffect(() => {
        // Redirect to login if not authenticated
        if (!isAuthenticated || !user) {
            navigate('/login');
            return;
        }

        // Connect to Socket.IO for real-time features
        const socketUrl = SOCKET_BASE_URL;
        const socketToken = localStorage.getItem('accessToken');
        const newSocket = io(socketUrl, {
            auth: socketToken ? { token: socketToken } : undefined,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket.IO connected successfully');
        });

        newSocket.on('connect_error', (error) => {
            console.log('Socket.IO connection error:', error);
        });

        // Listen for new rides (for all users)
        newSocket.on('new-ride-created', (data) => {
            console.log('New ride created event received:', data);
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
                    message: `${data.creator.name} is going from ${data.origin} to ${data.destination} at ${formatAnnouncementTime(data.departureTime)}`
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
            console.log('Match created event received:', data);
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
                    message: data.notification.message
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
            console.log('Match request received:', data);
            
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
                message: data.notification?.message || `Someone wants to join your ride!`
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
                    message: 'Check "My Rides" to accept or reject the request'
                });
            }, 2000);
        });

        // Listen for match request sent (requester)
        newSocket.on(`match_request_sent_${user.id}`, (data) => {
            console.log('Match request sent event:', data);
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
                    message: data.notification.message
                });
            }
        });

        // Listen for match accepted (both users receive this)
        newSocket.on(`match_accepted_${user.id}`, (data) => {
            console.log('Match accepted event:', data);
            
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
                message: data.notification?.message || 'Your ride match is confirmed!'
            });
            playNotificationSound();
            
            // Show follow-up notification to start chatting
            setTimeout(() => {
                addNotification({
                    type: 'match',
                    title: '💬 Chat Now Available!',
                    message: 'Go to "My Rides" → "Active Matches" to start chatting'
                });
            }, 3000);
            
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
            console.log('Match rejected event:', data);
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
                    message: data.notification.message
                });
            }
        });

        // Listen for new messages
        newSocket.on(`message_notification_${user.id}`, (data) => {
            console.log('Message notification:', data);
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
                    message: data.notification.message
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

        // Load Google Maps early so the ride modal is ready quickly
        loadGoogleMaps();

        loadRideAnnouncements();
        loadNotificationFeed();
        loadMatches();

        // Cleanup on unmount
        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [isAuthenticated, user, navigate]);

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

    const addNotification = (notification) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { ...notification, id }]);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch((error) => {
                console.warn('Notification sound unavailable:', error?.message || error);
            });
        } catch (error) {
            console.warn('Audio play failed:', error?.message || error);
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
                        } else {
                            originLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                        }
                    } catch (error) {
                        originLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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

    const handleRideBellClick = async () => {
        setShowMessageCenter(false);
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

    const handleMessageCenterClick = async () => {
        setShowRideAnnouncements(false);
        await loadMatches();
        setShowMessageCenter(true);
    };

    const handleNotificationItemClick = async (item) => {
        if (!item?.matchId && !item?.chatRoomId) {
            return;
        }

        try {
            // Prefer already loaded matches for instant open, then refresh from API if needed.
            let allMatches = Array.isArray(matches) ? matches : [];
            let targetMatch = allMatches.find((match) =>
                (item.matchId && match.id === item.matchId) ||
                (item.chatRoomId && match.chatRoomId === item.chatRoomId)
            );

            if (!targetMatch) {
                const response = await matchesAPI.getMyMatches();
                allMatches = Array.isArray(response?.matches) ? response.matches : [];
                targetMatch = allMatches.find((match) =>
                    (item.matchId && match.id === item.matchId) ||
                    (item.chatRoomId && match.chatRoomId === item.chatRoomId)
                );
            }

            if (!targetMatch) {
                addNotification({
                    type: 'error',
                    title: 'Chat not found',
                    message: 'This conversation is not available right now.'
                });
                return;
            }

            if (targetMatch.status !== 'accepted') {
                addNotification({
                    type: 'error',
                    title: 'Chat unavailable',
                    message: 'This ride is not accepted yet, so chat is not active.'
                });
                return;
            }

            setShowRideAnnouncements(false);
            setShowMessageCenter(false);
            setActiveChat(targetMatch);
        } catch (error) {
            addNotification({
                type: 'error',
                title: 'Unable to open chat',
                message: 'Please try again in a moment.'
            });
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
            setRides(response.rides || []);
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
                ride.creator?.id === user.id || ride.userId === user.id
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
            const allMatches = response.matches || [];
            
            // Separate pending requests (where I'm the creator) from accepted matches
            const pending = allMatches.filter(m => m.status === 'pending' && m.user1.id === user.id);
            const accepted = allMatches.filter(m => m.status === 'accepted');
            
            setPendingRequests(pending);
            setMatches(accepted);
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
        <div className="min-h-screen bg-[#050505] overflow-hidden relative font-poppins">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
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

            <div className="container mx-auto px-6 pt-20 pb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto"
                >
                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                            Welcome to <span className="text-accent-green">Spllit Lift</span>
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Your smart ride-matching dashboard is ready!
                        </p>
                    </div>

                    {/* User Profile Card */}
                    <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        className="bg-bg-secondary border border-white/10 rounded-3xl p-8 mb-6 shadow-xl"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-accent-green/20 border-2 border-accent-green rounded-2xl flex items-center justify-center">
                                    <FaUser className="text-accent-green text-3xl" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                                    <p className="text-gray-500 text-sm">{user.college || 'IIT Madras BS Degree'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Notification Bell */}
                                <div className="relative">
                                    <button
                                        onClick={handleRideBellClick}
                                        className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all relative"
                                    >
                                        <FaBell className="text-accent-green text-xl" />
                                        {(notifications.length > 0 || notificationFeedCount > 0 || unreadRideAnnouncementCount > 0) && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                                {Math.max(notifications.length, notificationFeedCount, unreadRideAnnouncementCount)}
                                            </span>
                                        )}
                                    </button>
                                    <AnimatePresence>
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    removeNotificationFeedItem(item.id);
                                                                                }}
                                            <motion.div
                                                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                                className="absolute right-0 mt-3 w-[22rem] md:w-[28rem] bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[10001] pointer-events-auto"
                                            >
                                                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                                    <div>
                                                        <h3 className="text-white font-bold text-lg">Notifications</h3>
                                                        <p className="text-gray-500 text-xs mt-1">
                                                            Ride updates, matches, and chat activity
                                                        </p>
                                                    </div>
                                                    <button
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
                                                    {notificationFeed.length === 0 ? (
                                                        <div className="px-5 py-8 text-center text-gray-500">
                                                            No notifications yet.
                                                        </div>
                                                    ) : (
                                                        notificationFeed.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                onClick={() => handleNotificationItemClick(item)}
                                                                className="px-5 py-4 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
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
                                                                        <div className="flex items-start justify-between gap-3 mb-1">
                                                                            <div>
                                                                                <p className="text-white font-semibold leading-tight">
                                                                                    {item.title}
                                                                                </p>
                                                                                <p className="text-gray-500 text-xs mt-1">
                                                                                    {item.type === 'ride' ? 'Ride announcement' : item.type === 'match' ? 'Match update' : 'Notification'}
                                                                                </p>
                                                                            </div>
                                                                            <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 whitespace-nowrap">
                                                                                {formatAnnouncementTime(item.timestamp)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-gray-300 text-sm leading-relaxed">
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
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button
                                    onClick={handleMessageCenterClick}
                                    className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 font-medium"
                                >
                                    <FaComments /> Messages
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <FaEnvelope className="text-accent-green" />
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Email</span>
                                </div>
                                <p className="text-white font-medium">{user.email}</p>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <FaPhone className="text-accent-green" />
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Phone</span>
                                </div>
                                <p className="text-white font-medium">{user.phone || 'Not provided'}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Create Ride Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setShowCreateRide(true)}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-16 h-16 bg-accent-green/20 border-2 border-accent-green rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FaCar className="text-accent-green text-2xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Create Ride</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Post your ride request and find students going to the same exam center within 30 minutes.
                            </p>
                            <div className="mt-6 text-accent-green font-bold text-sm uppercase tracking-wider">
                                Create Now →
                            </div>
                        </motion.div>

                        {/* Find Matches Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => { setShowFindMatches(true); handleSearchRides(); }}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-16 h-16 bg-purple-500/20 border-2 border-purple-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FaMapMarkerAlt className="text-purple-500 text-2xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Find Matches</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Browse available rides and connect with verified students for safe group travel.
                            </p>
                            <div className="mt-6 text-accent-green font-bold text-sm uppercase tracking-wider">
                                Find Rides →
                            </div>
                        </motion.div>

                        {/* My Rides Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={handleGetMyRides}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 cursor-pointer hover:border-accent-green/30 transition-all group"
                        >
                            <div className="w-16 h-16 bg-blue-500/20 border-2 border-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FaUser className="text-blue-500 text-2xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">My Rides</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                View and manage your active rides, check matches, and track your ride history.
                            </p>
                            <div className="mt-6 text-accent-green font-bold text-sm uppercase tracking-wider">
                                View Rides →
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

                    {/* Status Message */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-12 bg-accent-green/10 border border-accent-green/20 rounded-2xl p-6 text-center"
                    >
                        <p className="text-accent-green font-bold text-lg">
                            🎉 Backend Integration Complete!
                        </p>
                        <p className="text-gray-400 text-sm mt-2">
                            Your login is now connected to the backend API. Socket.IO real-time features are ready!
                        </p>
                    </motion.div>
                </motion.div>
            </div>

            {/* Create Ride Modal */}
            <AnimatePresence>
                {showCreateRide && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowCreateRide(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-3xl font-bold text-white">Create Ride</h2>
                                <button
                                    onClick={() => setShowCreateRide(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateRide} className="space-y-6">
                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">
                                        <FaMapPin className="inline mr-2 text-accent-green" />
                                        Origin (Your Location)
                                    </label>
                                    <input
                                        ref={originRef}
                                        type="text"
                                        value={rideData.origin}
                                        onChange={(e) => setRideData({...rideData, origin: e.target.value})}
                                        required
                                        placeholder="Type: Velachery, IIT Madras, etc."
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green transition-colors"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Start typing to see suggestions</p>
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">
                                        <FaMapMarkerAlt className="inline mr-2 text-purple-500" />
                                        Destination (Exam Center)
                                    </label>
                                    <input
                                        ref={destinationRef}
                                        type="text"
                                        value={rideData.destination}
                                        onChange={(e) => setRideData({...rideData, destination: e.target.value})}
                                        required
                                        placeholder="Type: Fortune Tower Chennai, Anna University, etc."
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green transition-colors"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Google Maps will auto-search location</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">
                                            <FaCalendarAlt className="inline mr-2" />
                                            Departure Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={rideData.departureTime}
                                            onChange={(e) => setRideData({...rideData, departureTime: e.target.value})}
                                            required
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-green transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">
                                            <FaUsers className="inline mr-2" />
                                            Available Seats
                                        </label>
                                        <input
                                            type="number"
                                            value={rideData.seats}
                                            onChange={(e) => setRideData({...rideData, seats: e.target.value})}
                                            min="1"
                                            max="4"
                                            required
                                            placeholder="1-4"
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-sm font-medium mb-2">
                                        <FaRupeeSign className="inline mr-2" />
                                        Total Fare (₹)
                                    </label>
                                    <input
                                        type="number"
                                        value={rideData.fare}
                                        onChange={(e) => setRideData({...rideData, fare: e.target.value})}
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g., 300"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green transition-colors"
                                    />
                                    {rideData.fare && rideData.seats && (
                                        <p className="text-sm text-accent-green mt-2">
                                            ₹{calculateFarePerPerson(rideData.fare, rideData.seats)} per person when shared
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">
                                            Vehicle Type
                                        </label>
                                        <select
                                            value={rideData.vehicleType}
                                            onChange={(e) => setRideData({...rideData, vehicleType: e.target.value})}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-green transition-colors"
                                        >
                                            <option value="cab">Cab</option>
                                            <option value="auto">Auto</option>
                                            <option value="bike">Bike</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-gray-400 text-sm font-medium mb-2">
                                            Gender Preference
                                        </label>
                                        <select
                                            value={rideData.genderPref}
                                            onChange={(e) => setRideData({...rideData, genderPref: e.target.value})}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-green transition-colors"
                                        >
                                            <option value="any">Any</option>
                                            <option value="male">Male Only</option>
                                            <option value="female">Female Only</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Ride & Find Matches'}
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowFindMatches(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-3xl font-bold text-white">Available Rides</h2>
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
                            ) : rides.length === 0 ? (
                                <div className="text-center py-12">
                                    <FaCar className="text-gray-600 text-6xl mx-auto mb-4" />
                                    <p className="text-gray-400 text-lg">No rides available at the moment</p>
                                    <p className="text-gray-500 text-sm mt-2">Create a ride to get started!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {rides.map((ride) => (
                                        <div
                                            key={ride.id}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-accent-green/30 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-2">
                                                        {ride.origin} → {ride.destination}
                                                    </h3>
                                                    <p className="text-gray-400 text-sm">
                                                        <FaClock className="inline mr-2" />
                                                        {new Date(ride.departureTime).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-accent-green font-bold text-lg">
                                                        {ride.seatsAvailable} seats
                                                    </p>
                                                    <p className="text-gray-500 text-sm">available</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
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
                                                        <div>
                                                            <p className="text-white font-semibold">{ride.creator.name}</p>
                                                            <p className="text-gray-400 text-xs">{ride.creator.college}</p>
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowMyRides(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-3xl font-bold text-white">My Rides</h2>
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
                                    {/* Pending Match Requests */}
                                    {pendingRequests.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                                <FaBell className="text-yellow-400" />
                                                Pending Match Requests ({pendingRequests.length})
                                            </h3>
                                            <div className="space-y-3">
                                                {pendingRequests.map((match) => (
                                                    <div
                                                        key={match.id}
                                                        className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                                                    <FaUser className="text-yellow-400 text-lg" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-white font-semibold">
                                                                        {match.user2.name}
                                                                    </p>
                                                                    <p className="text-gray-400 text-sm">
                                                                        {match.user2.college}
                                                                    </p>
                                                                    <p className="text-gray-500 text-xs mt-1">
                                                                        Wants to join: {match.ride.startLocation} → {match.ride.endLocation}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleAcceptMatch(match.id)}
                                                                    disabled={loading}
                                                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                                                >
                                                                    <FaCheck />
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectMatch(match.id)}
                                                                    disabled={loading}
                                                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                                                >
                                                                    <FaTimesCircle />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Accepted Matches - Chat Available */}
                                    {matches.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                                <FaComments className="text-green-400" />
                                                Active Matches ({matches.length})
                                            </h3>
                                            <div className="space-y-3">
                                                {matches.map((match) => {
                                                    const otherUser = match.user1.id === user.id ? match.user2 : match.user1;
                                                    return (
                                                        <div
                                                            key={match.id}
                                                            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3 flex-1">
                                                                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                                                        <FaUser className="text-green-400 text-lg" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-white font-semibold">
                                                                            {otherUser.name}
                                                                        </p>
                                                                        <p className="text-gray-400 text-sm">
                                                                            {otherUser.college}
                                                                        </p>
                                                                        <p className="text-gray-500 text-xs mt-1">
                                                                            {match.ride.startLocation} → {match.ride.endLocation}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleOpenChat(match)}
                                                                    className="px-6 py-3 bg-accent-green text-black font-bold rounded-lg hover:bg-accent-green/90 transition-all flex items-center gap-2"
                                                                >
                                                                    <FaComments />
                                                                    Chat Now
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* My Rides List */}
                                    <h3 className="text-xl font-bold text-white mb-4">My Created Rides</h3>
                                    {myRides.length === 0 ? (
                                        <div className="text-center py-12 bg-white/5 rounded-2xl">
                                            <FaCar className="text-gray-600 text-6xl mx-auto mb-4" />
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
                                            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-accent-green/30 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-xl font-bold text-white">
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
                                            <div className="flex gap-3 mt-4">
                                                {ride.status === 'active' && (
                                                    <>
                                                        <button className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all">
                                                            View Matches
                                                        </button>
                                                        <button className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all">
                                                            Edit Ride
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRide(ride.id)}
                                                            className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
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

            {/* Message Center */}
            <AnimatePresence>
                {showMessageCenter && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-6"
                        onClick={() => setShowMessageCenter(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-3xl font-bold text-white">Messages</h2>
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
                                                <div className="flex items-center justify-between gap-4">
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
                                                        className="px-5 py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all"
                                                    >
                                                        Open Chat
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

        </div>
    );
};

export default Dashboard;
