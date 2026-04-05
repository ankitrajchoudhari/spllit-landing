import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUsers, FaCar, FaHandshake, FaShieldAlt, FaSignOutAlt, FaPlus, FaTimes, 
  FaChartLine, FaCrown, FaUserShield, FaTrash, FaSync, FaSearch, FaDownload,
  FaBell, FaClock, FaCheckCircle, FaTimesCircle, FaFilter, FaUser,
  FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaMoneyBillWave, FaUserClock, FaExclamationTriangle,
  FaPhone, FaAmbulance, FaLifeRing, FaBullhorn, FaImage, FaPaperPlane
} from 'react-icons/fa';
import useAdminStore from '../store/adminStore';
import useAuthStore from '../store/authStore';
import { fetchStats, fetchUsers, fetchRides, fetchMatches, fetchEarlyAccess, fetchAdmins, createAdmin, deactivateAdmin, activateAdmin, resetAdminPassword, deleteAdmin } from '../services/adminAPI';
import { emergencyAPI, announcementsAPI } from '../services/api';
import NotificationContainer from '../components/NotificationToast';
import io from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/backendUrl';

const ANNOUNCEMENT_IMAGE_MAX_DIMENSION = 1400;
const ANNOUNCEMENT_IMAGE_QUALITY = 0.8;

const getErrorMessage = (error, fallback) => {
  const responseError = error?.response?.data?.error;
  if (typeof responseError === 'string') return responseError;
  if (responseError && typeof responseError === 'object') {
    return responseError.message || JSON.stringify(responseError);
  }

  const details = error?.response?.data?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((detail) => (typeof detail === 'string' ? detail : detail?.message || JSON.stringify(detail)))
      .join(', ');
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

const compressImageDataUrl = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(1, ANNOUNCEMENT_IMAGE_MAX_DIMENSION / Math.max(image.width || 1, image.height || 1));
    const width = Math.max(1, Math.round((image.width || 1) * scale));
    const height = Math.max(1, Math.round((image.height || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      resolve(dataUrl);
      return;
    }

    context.drawImage(image, 0, 0, width, height);
    try {
      resolve(canvas.toDataURL('image/jpeg', ANNOUNCEMENT_IMAGE_QUALITY));
    } catch {
      resolve(dataUrl);
    }
  };
  image.onerror = () => reject(new Error('Failed to process pasted image'));
  image.src = dataUrl;
});

const compressAnnouncementImage = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  return compressImageDataUrl(dataUrl);
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const adminStore = useAdminStore();
  const authStore = useAuthStore();
  const hasHydrated = authStore.hasHydrated;
  
  // Check both authentication methods
  const isAuthenticated = adminStore.isAuthenticated || (authStore.isAuthenticated && (authStore.user?.role === 'subadmin' || authStore.user?.isAdmin));
  const admin = adminStore.admin || authStore.user;
  const isMasterAdmin = adminStore.admin?.role === 'master';
  const isSubAdmin = admin?.role === 'subadmin' || admin?.isAdmin;
  const canManageAdmins = isMasterAdmin || isSubAdmin;
  
  const logout = useCallback(() => {
    if (adminStore.isAuthenticated) {
      adminStore.logout();
    } else {
      authStore.logout();
    }
    navigate('/');
  }, [adminStore, authStore, navigate]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [matches, setMatches] = useState([]);
  const [earlyAccess, setEarlyAccess] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', name: '' });
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState(null);
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [updatingEmergencyId, setUpdatingEmergencyId] = useState(null);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    location: '',
    imageLink: '',
    imageUrl: '',
    imageAlt: ''
  });
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());
  const [usersPage, setUsersPage] = useState(1);
  const [ridesPage, setRidesPage] = useState(1);
  const [matchesPage, setMatchesPage] = useState(1);
  const [earlyAccessPage, setEarlyAccessPage] = useState(1);
  const [usersMeta, setUsersMeta] = useState({ total: 0, pages: 1, limit: 25 });
  const [ridesMeta, setRidesMeta] = useState({ total: 0, pages: 1, limit: 25 });
  const [matchesMeta, setMatchesMeta] = useState({ total: 0, pages: 1, limit: 25 });
  const [earlyAccessMeta, setEarlyAccessMeta] = useState({ total: 0, pages: 1, limit: 50 });
  const isLoadingRef = useRef(false);
  const queuedRefreshRef = useRef(false);

  const normalizeEmergency = (data) => {
    const lat = data.location?.lat ?? data.locationLat;
    const lng = data.location?.lng ?? data.locationLng;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    return {
      id: data.id,
      userName: data.userName || data.user?.name || 'Unknown User',
      phone: data.userPhone || data.phone || data.user?.phone || 'N/A',
      userEmail: data.userEmail || data.user?.email || 'N/A',
      college: data.college || data.user?.college || 'N/A',
      location: hasCoords ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Location pending...',
      locationLat: hasCoords ? lat : null,
      locationLng: hasCoords ? lng : null,
      message: data.message || 'Emergency SOS triggered',
      emergencyType: data.emergencyType || 'other',
      timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
      status: data.status || 'active'
    };
  };

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await announcementsAPI.getAnnouncements();
      const items = Array.isArray(response?.announcements) ? response.announcements : [];
      setAdminAnnouncements(items);
      return items;
    } catch (error) {
      console.error('Failed to load announcements:', error);
      return [];
    }
  }, []);

  const loadData = useCallback(async ({ silent = false, force = false } = {}) => {
    if (isLoadingRef.current) {
      if (force) {
        queuedRefreshRef.current = true;
      }
      return;
    }

    isLoadingRef.current = true;
    if (!silent) setLoading(true);

    try {
      if (activeTab === 'dashboard') {
        const [statsResponse] = await Promise.all([
          fetchStats(),
          loadAnnouncements()
        ]);
        setStats(statsResponse.data);
      } else if (activeTab === 'users') {
        const response = await fetchUsers(usersPage, 25);
        setUsers(response.data.users);
        const pagination = response.data.pagination || {};
        const totalPages = pagination.pages || 1;
        if (usersPage > totalPages) {
          setUsersPage(totalPages);
        }
        setUsersMeta({
          total: pagination.total || 0,
          pages: totalPages,
          limit: pagination.limit || 25
        });
      } else if (activeTab === 'rides') {
        const response = await fetchRides(ridesPage, 25);
        setRides(response.data.rides);
        const pagination = response.data.pagination || {};
        const totalPages = pagination.pages || 1;
        if (ridesPage > totalPages) {
          setRidesPage(totalPages);
        }
        setRidesMeta({
          total: pagination.total || 0,
          pages: totalPages,
          limit: pagination.limit || 25
        });
      } else if (activeTab === 'matches') {
        const response = await fetchMatches(matchesPage, 25);
        setMatches(response.data.matches);
        const pagination = response.data.pagination || {};
        const totalPages = pagination.pages || 1;
        if (matchesPage > totalPages) {
          setMatchesPage(totalPages);
        }
        setMatchesMeta({
          total: pagination.total || 0,
          pages: totalPages,
          limit: pagination.limit || 25
        });
      } else if (activeTab === 'early-access') {
        const response = await fetchEarlyAccess(earlyAccessPage, 50);
        setEarlyAccess(response.data.registrations || []);
        const pagination = response.data.pagination || {};
        const totalPages = pagination.pages || 1;
        if (earlyAccessPage > totalPages) {
          setEarlyAccessPage(totalPages);
        }
        setEarlyAccessMeta({
          total: pagination.total || 0,
          pages: totalPages,
          limit: pagination.limit || 50
        });
      } else if (activeTab === 'admins' && canManageAdmins) {
        const response = await fetchAdmins();
        setAdmins(response.data.subadmins || response.data.admins || []);
      } else if (activeTab === 'emergency') {
        const response = await emergencyAPI.getEmergencies();
        const items = Array.isArray(response?.emergencies) ? response.emergencies : [];
        setEmergencies(items.map(normalizeEmergency));
      }

      setLastRefreshAt(Date.now());
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/admin/login');
      }
    } finally {
      isLoadingRef.current = false;
      if (!silent) setLoading(false);

      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        loadData({ silent: true, force: false });
      }
    }
  }, [
    activeTab,
    canManageAdmins,
    earlyAccessPage,
    loadAnnouncements,
    logout,
    matchesPage,
    navigate,
    ridesPage,
    usersPage
  ]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }

    loadData({ silent: false, force: true });
  }, [hasHydrated, isAuthenticated, navigate, activeTab, loadData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const intervalMs = activeTab === 'emergency' ? 5000 : activeTab === 'dashboard' ? 15000 : 30000;
    const interval = setInterval(() => {
      loadData({ silent: true });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, loadData]);

  // Socket.IO for real-time notifications
  useEffect(() => {
    const socketToken = localStorage.getItem('adminToken') || localStorage.getItem('accessToken');
    if (!socketToken) {
      return;
    }

    const socketUrl = SOCKET_BASE_URL;
    const isLikelyMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const newSocket = io(socketUrl, {
      auth: { token: socketToken },
      transports: isLikelyMobile ? ['polling'] : ['websocket', 'polling'],
      upgrade: !isLikelyMobile
    });

    newSocket.on('connect', () => {
      console.log('Admin Socket connected');
      newSocket.emit('join-admin-room');
    });

    // Listen for new user registrations
    newSocket.on('new-user-registered', (data) => {
      addNotification({
        type: 'user',
        title: 'New User Registered',
        message: `${data.name} just joined from ${data.college}`,
        timestamp: Date.now()
      });
      loadData({ silent: true }); // Refresh data without blocking UI
    });

    // Listen for new ride created
    newSocket.on('new-ride-created', (data) => {
      addNotification({
        type: 'ride',
        title: 'New Ride Created',
        message: `${data.origin} → ${data.destination}`,
        amount: data.fare,
        timestamp: Date.now()
      });
      loadData({ silent: true });
    });

    // Listen for new match
    newSocket.on('new-match-created', (data) => {
      addNotification({
        type: 'match',
        title: 'New Match Created',
        message: `Ride matched! Total fare: ₹${data.totalFare}`,
        amount: data.splitAmount,
        timestamp: Date.now()
      });
      loadData({ silent: true });
    });

    // Listen for emergency SOS
    newSocket.on('emergency-sos', (data) => {
      const emergency = normalizeEmergency(data);
      addNotification({
        type: 'emergency',
        title: '🚨 EMERGENCY SOS',
        message: `${emergency.userName} needs help! Call ${emergency.phone} now.`,
        timestamp: Date.now()
      });
      setEmergencies(prev => [emergency, ...prev.filter((item) => item.id !== emergency.id)]);
      // Play alert sound
      if (typeof Audio !== 'undefined') {
        const audio = new Audio('/alert.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
      }
    });

    newSocket.on('emergency-status-updated', (data) => {
      setEmergencies((prev) => prev.map((item) =>
        item.id === data.id ? { ...item, status: data.status, resolvedAt: data.resolvedAt } : item
      ).filter((item) => ['active', 'acknowledged'].includes(item.status)));
    });

    // Listen for subadmin status changes (real-time)
    newSocket.on('subadmin-status-changed', (data) => {
      console.log('Subadmin status changed:', data);
      addNotification({
        type: 'admin',
        title: 'Subadmin Status Changed',
        message: `${data.name} is now ${data.status}`,
        timestamp: Date.now()
      });
      // Refresh admin list if on admins tab
      if (activeTab === 'admins') {
        loadData({ silent: true });
      }
    });

    newSocket.on('new-admin-announcement', (data) => {
      const announcement = data?.announcement;
      if (!announcement?.id) return;
      setAdminAnnouncements((prev) => [announcement, ...prev.filter((item) => item.id !== announcement.id)]);
    });

    newSocket.on('admin-announcement-deleted', (data) => {
      if (!data?.id) return;
      setAdminAnnouncements((prev) => prev.filter((item) => item.id !== data.id));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [activeTab, loadData]);

  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { ...notification, id }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleEmergencyStatusUpdate = async (emergencyId, status) => {
    try {
      setUpdatingEmergencyId(emergencyId);
      await emergencyAPI.updateEmergencyStatus(emergencyId, status);

      if (status === 'resolved' || status === 'false-alarm') {
        setEmergencies((prev) => prev.filter((item) => item.id !== emergencyId));
      } else {
        setEmergencies((prev) => prev.map((item) =>
          item.id === emergencyId ? { ...item, status } : item
        ));
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update emergency status');
    } finally {
      setUpdatingEmergencyId(null);
    }
  };

  // Check if user/ride is active (within last 10 minutes)
  const isActive = (timestamp) => {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    return new Date(timestamp).getTime() > tenMinutesAgo;
  };

  // Calculate total splitting amount
  const calculateTotalSplitAmount = () => {
    if (!stats) return 0;
    return matches.reduce((total, match) => {
      return total + (match.ride?.fare || 0);
    }, 0);
  };

  const setAnnouncementImage = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file');
      return;
    }

    try {
      const compressedDataUrl = await compressAnnouncementImage(file);
      setAnnouncementForm((prev) => ({
        ...prev,
        imageUrl: compressedDataUrl,
        imageLink: '',
        imageAlt: prev.imageAlt || file.name
      }));
    } catch {
      alert('Could not process the image. Please try a smaller image or use an image URL.');
    }
  };

  const handleAnnouncementImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await setAnnouncementImage(file);
    event.target.value = '';
  };

  const handleAnnouncementImagePaste = async (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));

    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    await setAnnouncementImage(file);
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    try {
      setAnnouncementSubmitting(true);
      const selectedImage = announcementForm.imageUrl || announcementForm.imageLink || undefined;
      const payload = {
        title: announcementForm.title,
        message: announcementForm.message,
        location: announcementForm.location,
        imageUrl: selectedImage,
        imageAlt: announcementForm.imageAlt || announcementForm.title
      };

      if (selectedImage?.startsWith('data:image') && selectedImage.length > 900000) {
        alert('The pasted image is still too large. Please use a smaller image or an image URL.');
        return;
      }

      const response = await announcementsAPI.createAnnouncement(payload);
      const createdAnnouncement = response?.announcement;

      if (createdAnnouncement) {
        setAdminAnnouncements((prev) => [createdAnnouncement, ...prev.filter((item) => item.id !== createdAnnouncement.id)]);
      } else {
        await loadAnnouncements();
      }

      setAnnouncementForm({ title: '', message: '', location: '', imageLink: '', imageUrl: '', imageAlt: '' });
      alert('Announcement posted successfully');
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to post announcement'));
    } finally {
      setAnnouncementSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!announcementId) return;
    if (!confirm('Delete this announcement post?')) return;

    try {
      await announcementsAPI.deleteAnnouncement(announcementId);
      setAdminAnnouncements((prev) => prev.filter((item) => item.id !== announcementId));
      alert('Announcement deleted successfully');
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete announcement'));
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      await createAdmin(newAdmin);
      setShowAddAdmin(false);
      setNewAdmin({ email: '', password: '', name: '' });
      loadData();
      alert('Admin created successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create admin');
    }
  };

  const handleDeactivateAdmin = async (id) => {
    if (!confirm('Are you sure you want to disable this admin? They will not be able to login.')) return;
    try {
      await deactivateAdmin(id);
      loadData();
      alert('Admin disabled successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to disable admin');
    }
  };

  const handleActivateAdmin = async (id) => {
    try {
      await activateAdmin(id);
      loadData();
      alert('Admin enabled successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to enable admin');
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this admin? The email can be reused after deletion.')) return;
    try {
      await deleteAdmin(id);
      loadData();
      alert('Admin deleted successfully! Email can now be reused.');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete admin');
    }
  };

  const handleOpenResetPasswordModal = (adminItem) => {
    setResetTargetAdmin(adminItem);
    setResetForm({ password: '', confirmPassword: '' });
    setShowResetPasswordModal(true);
  };

  const handleSubmitResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetAdmin?.id) return;

    if (resetForm.password !== resetForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!strongPasswordRegex.test(resetForm.password)) {
      alert('Password must be at least 8 characters and include both letters and numbers');
      return;
    }

    try {
      setIsResettingPassword(true);
      await resetAdminPassword(resetTargetAdmin.id, resetForm.password);
      setShowResetPasswordModal(false);
      setResetTargetAdmin(null);
      setResetForm({ password: '', confirmPassword: '' });
      alert('Subadmin password reset successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reset subadmin password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const exportToCSV = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Filter data based on search and status
  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.college.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || 
                           (filterStatus === 'active' && user.isActive) ||
                           (filterStatus === 'inactive' && !user.isActive);
      return matchesSearch && matchesFilter;
    });
  };

  const getFilteredRides = () => {
    return rides.filter(ride => {
      const matchesSearch = ride.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           ride.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           ride.creator.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || ride.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  };

  const openDataTab = (tabId, nextFilter = 'all') => {
    setActiveTab(tabId);
    setSearchTerm('');
    setFilterStatus(nextFilter);

    if (tabId === 'users') setUsersPage(1);
    if (tabId === 'rides') setRidesPage(1);
    if (tabId === 'matches') setMatchesPage(1);
    if (tabId === 'early-access') setEarlyAccessPage(1);
  };

  const renderPagination = (meta, page, setPage) => {
    if (!meta || meta.pages <= 1) return null;

    return (
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-white/10 bg-white/5">
        <p className="text-xs sm:text-sm text-gray-400">
          Page {page} of {meta.pages} • {meta.total} total
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-all"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(meta.pages, prev + 1))}
            disabled={page >= meta.pages}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-accent-green/20 text-accent-green disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-green/30 transition-all"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const adminSuggestions = (() => {
    if (!stats?.stats) return [];

    const list = [];
    const { totalUsers, activeRides, pendingMatches, todayUsers, earlyAccessCount } = stats.stats;

    if (activeRides > 0 && pendingMatches === 0) {
      list.push({
        id: 'match-ops',
        title: 'Review Active Rides',
        description: `${activeRides} active rides with low match throughput. Check matching quality and pending approvals.`,
        action: () => openDataTab('rides', 'pending'),
        actionLabel: 'Open Rides'
      });
    }

    if (todayUsers >= 10) {
      list.push({
        id: 'new-user-wave',
        title: 'High New User Inflow',
        description: `${todayUsers} users joined today. Validate onboarding quality and support response times.`,
        action: () => openDataTab('users', 'all'),
        actionLabel: 'Review Users'
      });
    }

    if (earlyAccessCount > 0) {
      list.push({
        id: 'early-access-followup',
        title: 'Spllit Social Lead Follow-up',
        description: `${earlyAccessCount} early-access leads are available for targeted outreach.`,
        action: () => openDataTab('early-access', 'all'),
        actionLabel: 'View Leads'
      });
    }

    if (totalUsers > 0 && pendingMatches > 0) {
      list.push({
        id: 'pending-matches',
        title: 'Pending Match Pipeline',
        description: `${pendingMatches} matches are pending. Track response delays and resolve stale requests.`,
        action: () => openDataTab('matches', 'all'),
        actionLabel: 'Open Matches'
      });
    }

    return list.slice(0, 4);
  })();

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-white/10 sticky top-0 z-40 backdrop-blur-lg bg-opacity-90">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
            {/* Left Section */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-12 sm:h-12 bg-accent-green/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <FaShieldAlt className="text-accent-green text-base sm:text-2xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl lg:text-2xl font-bold leading-tight break-words">Admin Dashboard</h1>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
                  <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-accent-green to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] sm:text-[9px] font-bold text-black">{admin?.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-[11px] sm:text-xs text-gray-300 whitespace-nowrap">Admin</span>
                  </div>
                  {!!admin?.name && (
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                      <FaUser className="text-gray-300 text-[9px] sm:text-[10px]" />
                      <span className="text-[10px] sm:text-xs text-gray-300 max-w-[180px] truncate">{admin.name}</span>
                    </div>
                  )}
                  {!!admin?.email && (
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                      <FaEnvelope className="text-gray-300 text-[9px] sm:text-[10px]" />
                      <span className="text-[10px] sm:text-xs text-gray-300 max-w-[220px] truncate">{admin.email}</span>
                    </div>
                  )}
                  {isMasterAdmin && (
                    <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-lg">
                      <FaCrown className="text-yellow-400 text-[9px] sm:text-[10px]" />
                      <span className="text-[10px] text-yellow-400 font-semibold whitespace-nowrap">MASTER</span>
                    </div>
                  )}
                  {isSubAdmin && !isMasterAdmin && (
                    <div className="flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg">
                      <FaUserShield className="text-blue-400 text-[9px] sm:text-[10px]" />
                      <span className="text-[10px] text-blue-400 font-semibold whitespace-nowrap">SUBADMIN</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Section */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2 w-full lg:w-auto flex-shrink-0">
              {/* Notification Bell */}
              <button
                onClick={() => setActiveTab('emergency')}
                className="relative flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all w-full sm:w-auto"
              >
                <FaBell className="text-gray-400 text-sm sm:text-base" />
                {emergencies.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {emergencies.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl transition-all text-xs sm:text-sm flex-1 lg:flex-initial w-full sm:w-auto ${
                  autoRefresh ? 'bg-accent-green/20 text-accent-green' : 'bg-white/5 text-gray-400'
                }`}
              >
                <FaSync className={`${autoRefresh ? 'animate-spin' : ''} text-xs sm:text-sm`} />
                <span className="hidden sm:inline whitespace-nowrap">Auto Refresh</span>
                <span className="sm:hidden">Auto</span>
              </button>
              <div className="col-span-2 sm:col-span-1 flex items-center justify-center px-3 py-2.5 rounded-xl bg-white/5 text-[11px] sm:text-xs text-gray-400">
                Updated {Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000))}s ago
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-xs sm:text-sm flex-1 lg:flex-initial whitespace-nowrap w-full sm:w-auto"
              >
                <FaSignOutAlt className="text-xs sm:text-sm" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-bg-secondary border-b border-white/10 sticky top-[88px] sm:top-[96px] z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: FaChartLine },
              { id: 'users', label: 'Users', icon: FaUsers },
              { id: 'rides', label: 'Rides', icon: FaCar },
              { id: 'matches', label: 'Matches', icon: FaHandshake },
              { id: 'early-access', label: 'Early Access', icon: FaUserClock },
              { id: 'emergency', label: 'Emergency', icon: FaExclamationTriangle },
              ...(canManageAdmins ? [{ id: 'admins', label: 'Admins', icon: FaUserShield }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => openDataTab(tab.id, 'all')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 font-semibold transition-all border-b-2 whitespace-nowrap text-[11px] sm:text-sm flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-accent-green text-accent-green bg-accent-green/5'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="text-xs sm:text-sm" />
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-accent-green"></div>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-4 sm:space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                  <motion.button
                    type="button"
                    onClick={() => openDataTab('users', 'all')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-left bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-blue-400/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaUsers className="text-2xl sm:text-4xl text-blue-400" />
                      <span className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        +{stats.stats.todayUsers}
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.stats.totalUsers}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Total Users</p>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => openDataTab('rides', 'all')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-left bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-purple-400/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaCar className="text-2xl sm:text-4xl text-purple-400" />
                      <span className="text-[10px] sm:text-xs bg-purple-500/20 text-purple-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        +{stats.stats.todayRides}
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.stats.totalRides}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Total Rides</p>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => openDataTab('matches', 'all')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-left bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-green-400/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaHandshake className="text-2xl sm:text-4xl text-green-400" />
                      <span className="text-[10px] sm:text-xs bg-green-500/20 text-green-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        {stats.stats.pendingMatches}
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.stats.totalMatches}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Total Matches</p>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => openDataTab('rides', 'pending')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-left bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-yellow-400/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaChartLine className="text-2xl sm:text-4xl text-yellow-400" />
                      <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        Live
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.stats.activeRides}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Active Rides</p>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => openDataTab('matches', 'all')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-left bg-gradient-to-br from-accent-green/10 to-emerald-600/5 border border-accent-green/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-accent-green/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaMoneyBillWave className="text-2xl sm:text-4xl text-accent-green" />
                      <span className="text-[10px] sm:text-xs bg-accent-green/20 text-accent-green px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        Total
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">₹{calculateTotalSplitAmount()}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Split Amount</p>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => openDataTab('early-access', 'all')}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-left bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-blue-300/40 hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <FaUserClock className="text-2xl sm:text-4xl text-blue-300" />
                      <span className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-300 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        Social
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.stats.earlyAccessCount || 0}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Early Access Leads</p>
                  </motion.button>
                </div>

                {adminSuggestions.length > 0 && (
                  <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
                      <FaBell className="text-yellow-400" /> Admin Suggestions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {adminSuggestions.map((item) => (
                        <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                          <p className="text-white font-semibold text-sm sm:text-base">{item.title}</p>
                          <p className="text-gray-400 text-xs sm:text-sm mt-1">{item.description}</p>
                          <button
                            type="button"
                            onClick={item.action}
                            className="mt-3 px-3 py-2 bg-accent-green/15 text-accent-green rounded-lg text-xs sm:text-sm font-semibold hover:bg-accent-green/25 transition-all"
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="bg-gradient-to-r from-accent-green/5 to-blue-500/5 border border-accent-green/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                    <FaBell className="text-accent-green" />
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                    <button
                      onClick={() => openDataTab('users', 'all')}
                      className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group"
                    >
                      <FaUsers className="text-xl sm:text-2xl text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-medium">View Users</span>
                    </button>
                    <button
                      onClick={() => openDataTab('rides', 'all')}
                      className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group"
                    >
                      <FaCar className="text-xl sm:text-2xl text-purple-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-medium">View Rides</span>
                    </button>
                    <button
                      onClick={() => openDataTab('matches', 'all')}
                      className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all group"
                    >
                      <FaHandshake className="text-xl sm:text-2xl text-green-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-medium">View Matches</span>
                    </button>
                    <button
                      onClick={() => openDataTab('early-access', 'all')}
                      className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all group"
                    >
                      <FaUserClock className="text-xl sm:text-2xl text-blue-300 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-medium text-blue-200">Spllit Social</span>
                    </button>
                    {canManageAdmins && (
                      <button
                        onClick={() => setShowAddAdmin(true)}
                        className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-accent-green/10 hover:bg-accent-green/20 rounded-xl transition-all group"
                      >
                        <FaPlus className="text-xl sm:text-2xl text-accent-green group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-medium text-accent-green">Add Admin</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Announcement Studio */}
                <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 sm:gap-6">
                  <div className="bg-gradient-to-br from-white/5 to-white/3 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                          <FaBullhorn className="text-accent-green" /> Announcement Studio
                        </h3>
                        <p className="text-sm text-gray-400 mt-2">
                          Post campus updates, event drops, and location-based notices for users.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded-full px-3 py-2 self-start">
                        <FaPaperPlane className="text-accent-green" /> Live feed
                      </div>
                    </div>

                    <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-white mb-2">Post Title</label>
                          <input
                            type="text"
                            value={announcementForm.title}
                            onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Campus fest, exam alert, meetup..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-white mb-2">Location</label>
                          <input
                            type="text"
                            value={announcementForm.location}
                            onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, location: e.target.value }))}
                            placeholder="IIT Madras, Velachery..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Announcement Text</label>
                        <textarea
                          rows={4}
                          value={announcementForm.message}
                          onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, message: e.target.value }))}
                          placeholder="Tell users what is happening, when, and why they should care..."
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50 resize-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                          <label className="block text-sm font-semibold text-white mb-2">Upload Image</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAnnouncementImageChange}
                            className="w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-accent-green file:text-black file:font-bold hover:file:bg-accent-green/90"
                          />
                          <p className="mt-2 text-[11px] text-gray-500">
                            Upload or paste an image. Large images are compressed automatically.
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-white mb-2">Image Link</label>
                          <input
                            type="text"
                            value={announcementForm.imageLink}
                            onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, imageLink: e.target.value }))}
                            onPaste={handleAnnouncementImagePaste}
                            placeholder="Paste an image URL if you don't want to upload"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Image Caption</label>
                        <input
                          type="text"
                          value={announcementForm.imageAlt}
                          onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, imageAlt: e.target.value }))}
                          placeholder="A short caption for accessibility"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green/50"
                        />
                      </div>

                      {(announcementForm.imageUrl || announcementForm.imageLink) && (
                        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
                          <img
                            src={announcementForm.imageUrl || announcementForm.imageLink}
                            alt={announcementForm.imageAlt || announcementForm.title || 'Preview'}
                            className="w-full max-h-64 object-cover"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={announcementSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-accent-green to-emerald-400 text-black font-black hover:opacity-90 transition-all disabled:opacity-60"
                      >
                        <FaPaperPlane className="text-sm" />
                        {announcementSubmitting ? 'Posting...' : 'Post Announcement'}
                      </button>
                    </form>
                  </div>

                  <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
                        <FaImage className="text-accent-green" /> Recent Drops
                      </h3>
                      <span className="text-xs text-gray-500">{adminAnnouncements.length} posts</span>
                    </div>
                    <div className="space-y-3 max-h-[34rem] overflow-y-auto">
                      {adminAnnouncements.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                          No announcements yet.
                        </div>
                      ) : adminAnnouncements.slice(0, 6).map((announcement) => (
                        <div key={announcement.id} className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                          {announcement.imageUrl ? (
                            <img src={announcement.imageUrl} alt={announcement.imageAlt || announcement.title} className="w-full h-36 object-cover" />
                          ) : (
                            <div className="w-full h-36 bg-gradient-to-br from-accent-green/20 to-purple-500/20 flex items-center justify-center">
                              <FaBullhorn className="text-4xl text-accent-green" />
                            </div>
                          )}
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-white font-semibold text-sm break-words">{announcement.title}</p>
                                <p className="text-gray-400 text-xs mt-1 break-words">{announcement.location}</p>
                              </div>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(announcement.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-gray-300 text-xs leading-relaxed break-words">
                              {announcement.message}
                            </p>
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(announcement.id)}
                                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-red-500/30 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
                              >
                                Delete Post
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Recent Users */}
                  <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
                        <FaUsers className="text-accent-green" />
                        Recent Users
                      </h3>
                      <span className="text-xs text-gray-500">{stats.recentUsers.length} users</span>
                    </div>
                    <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
                      {stats.recentUsers.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 p-2 sm:p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent-green to-blue-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-xs sm:text-sm">{user.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-xs sm:text-sm truncate">{user.name}</p>
                            <p className="text-[10px] sm:text-xs text-gray-400 truncate">{user.college}</p>
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Rides */}
                  <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
                        <FaCar className="text-accent-green" />
                        Recent Rides
                      </h3>
                      <span className="text-xs text-gray-500">{stats.recentRides.length} rides</span>
                    </div>
                    <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
                      {stats.recentRides.map((ride) => (
                        <div key={ride.id} className="p-2 sm:p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FaMapMarkerAlt className="text-accent-green text-xs flex-shrink-0" />
                              <p className="font-semibold text-white text-xs sm:text-sm truncate">
                                {ride.origin}
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                              ride.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              ride.status === 'matched' ? 'bg-green-500/20 text-green-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {ride.status}
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-400 ml-5 truncate">→ {ride.destination}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">By {ride.creator.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vehicle Stats */}
                {stats.vehicleStats && (
                  <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-base sm:text-xl font-bold mb-4">Rides by Vehicle Type</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {stats.vehicleStats.map((item) => (
                        <div key={item.vehicleType} className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-transform">
                          <p className="text-xl sm:text-2xl font-bold text-accent-green">{item._count}</p>
                          <p className="text-xs sm:text-sm text-gray-400 capitalize mt-1">{item.vehicleType}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'early-access' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold">Spllit Social Early Access</h2>
                  <span className="text-sm text-gray-400">{earlyAccessMeta.total} registrations</span>
                </div>

                <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Name</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Email</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Phone</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Message</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Registered At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earlyAccess.map((lead) => (
                          <tr key={lead.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                            <td className="p-3 sm:p-4 text-white font-medium text-xs sm:text-sm">{lead.name}</td>
                            <td className="p-3 sm:p-4 text-gray-300 text-xs sm:text-sm break-all">{lead.email}</td>
                            <td className="p-3 sm:p-4 text-gray-300 text-xs sm:text-sm">{lead.phone}</td>
                            <td className="p-3 sm:p-4 text-gray-300 text-xs sm:text-sm max-w-[240px] truncate">{lead.message || 'N/A'}</td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                              {new Date(lead.createdAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {earlyAccess.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No registrations yet.</div>
                  )}
                  {renderPagination(earlyAccessMeta, earlyAccessPage, setEarlyAccessPage)}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Search users by name, email, or college..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <button
                      onClick={() => exportToCSV(getFilteredUsers(), 'users.csv')}
                      className="flex items-center gap-2 px-4 py-3 bg-accent-green/10 text-accent-green rounded-xl hover:bg-accent-green/20 transition-all text-sm whitespace-nowrap"
                    >
                      <FaDownload />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Name</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Contact</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">College</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Gender</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">DOB</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Rides</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Joined</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredUsers().map((user) => (
                          <tr key={user.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                            <td className="p-3 sm:p-4">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent-green to-blue-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs sm:text-sm font-bold">{user.name[0]}</span>
                                </div>
                                <span className="font-medium text-xs sm:text-sm truncate">{user.name}</span>
                              </div>
                            </td>
                            <td className="p-3 sm:p-4">
                              <p className="text-gray-300 text-xs sm:text-sm break-all">{user.email}</p>
                              <p className="text-gray-400 text-[10px] sm:text-xs">{user.phone || 'Not provided'}</p>
                            </td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm">
                              <div className="truncate max-w-[150px]">{user.college}</div>
                            </td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm capitalize">
                              {user.gender || 'N/A'}
                            </td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                              {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-GB') : 'Not set'}
                            </td>
                            <td className="p-3 sm:p-4">
                              <span className="bg-accent-green/20 text-accent-green px-2 py-1 rounded-lg text-xs sm:text-sm font-semibold">
                                {user._count.ridesCreated}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm">
                              {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </td>
                            <td className="p-3 sm:p-4">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full whitespace-nowrap ${
                                  isActive(user.updatedAt || user.createdAt) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {isActive(user.updatedAt || user.createdAt) ? 'Active' : 'Inactive'}
                                </span>
                                <span className={`w-2 h-2 rounded-full ${
                                  isActive(user.updatedAt || user.createdAt) ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                                }`}></span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {getFilteredUsers().length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <FaUsers className="mx-auto text-4xl mb-2 opacity-50" />
                      <p>No users found</p>
                    </div>
                  )}
                  {renderPagination(usersMeta, usersPage, setUsersPage)}
                </div>
              </div>
            )}

            {/* Rides Tab */}
            {activeTab === 'rides' && (
              <div className="space-y-4">
                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Search rides by location or creator..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="matched">Matched</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => exportToCSV(getFilteredRides(), 'rides.csv')}
                      className="flex items-center gap-2 px-4 py-3 bg-accent-green/10 text-accent-green rounded-xl hover:bg-accent-green/20 transition-all text-sm whitespace-nowrap"
                    >
                      <FaDownload />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </div>
                </div>

                {/* Rides Grid/Table */}
                <div className="grid gap-4">
                  {getFilteredRides().map((ride) => (
                    <div key={ride.id} className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-white/20 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Route Info */}
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <FaCar className="text-purple-400 text-lg sm:text-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <FaMapMarkerAlt className="text-accent-green text-xs flex-shrink-0" />
                                <p className="font-bold text-sm sm:text-base truncate">{ride.origin}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <FaMapMarkerAlt className="text-red-400 text-xs flex-shrink-0" />
                                <p className="text-gray-400 text-xs sm:text-sm truncate">{ride.destination}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Additional Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                            <div className="bg-white/5 rounded-lg p-2">
                              <p className="text-[10px] sm:text-xs text-gray-400">Creator</p>
                              <p className="text-xs sm:text-sm font-medium truncate">{ride.creator.name}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <p className="text-[10px] sm:text-xs text-gray-400">Vehicle</p>
                              <p className="text-xs sm:text-sm font-medium capitalize">{ride.vehicleType}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <p className="text-[10px] sm:text-xs text-gray-400">Fare</p>
                              <p className="text-xs sm:text-sm font-bold text-accent-green">₹{ride.fare}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <p className="text-[10px] sm:text-xs text-gray-400">Seats</p>
                              <p className="text-xs sm:text-sm font-medium">{ride.seats}</p>
                            </div>
                          </div>
                        </div>

                        {/* Status and Matches */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-3">
                          <span className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${
                            ride.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            ride.status === 'matched' ? 'bg-green-500/20 text-green-400' :
                            ride.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {ride.status}
                          </span>
                          <div className="bg-white/5 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-gray-400">{ride.matches.length} matches</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getFilteredRides().length === 0 && (
                    <div className="text-center py-12 text-gray-400 bg-bg-secondary border border-white/10 rounded-2xl">
                      <FaCar className="mx-auto text-4xl mb-2 opacity-50" />
                      <p>No rides found</p>
                    </div>
                  )}
                </div>
                {renderPagination(ridesMeta, ridesPage, setRidesPage)}
              </div>
            )}

            {/* Matches Tab */}
            {activeTab === 'matches' && (
              <div className="space-y-4">
                <div className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Route</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Rider 1</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Rider 2</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Fare</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Status</th>
                          <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-400">Matched</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((match) => (
                          <tr key={match.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                            <td className="p-3 sm:p-4">
                              <p className="font-medium text-xs sm:text-sm truncate max-w-[150px]">{match.ride.origin}</p>
                              <p className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[150px]">→ {match.ride.destination}</p>
                            </td>
                            <td className="p-3 sm:p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-accent-green text-xs font-bold">{match.user1.name[0]}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm truncate">{match.user1.name}</p>
                                  <p className="text-[10px] sm:text-xs text-gray-400 truncate">{match.user1.phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 sm:p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-blue-400 text-xs font-bold">{match.user2.name[0]}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm truncate">{match.user2.name}</p>
                                  <p className="text-[10px] sm:text-xs text-gray-400 truncate">{match.user2.phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 sm:p-4">
                              <span className="text-accent-green font-bold text-xs sm:text-sm">₹{match.ride.fare}</span>
                            </td>
                            <td className="p-3 sm:p-4">
                              <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full whitespace-nowrap font-semibold ${
                                match.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                match.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                match.status === 'rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                match.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                match.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                              }`}>
                                {match.status}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm">
                              {new Date(match.matchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {matches.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <FaHandshake className="mx-auto text-4xl mb-2 opacity-50" />
                      <p>No matches found</p>
                    </div>
                  )}
                  {renderPagination(matchesMeta, matchesPage, setMatchesPage)}
                </div>
              </div>
            )}

            {/* Emergency SOS Tab */}
            {activeTab === 'emergency' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <FaExclamationTriangle className="text-red-400 text-2xl animate-pulse" />
                    </div>
                    Emergency & SOS Center
                  </h2>
                  {emergencies.length > 0 && (
                    <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold">
                      {emergencies.length} Active Emergencies
                    </span>
                  )}
                </div>

                {/* Emergency Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <button className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl hover:border-red-500/40 transition-all group">
                    <FaPhone className="text-2xl sm:text-3xl text-red-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs sm:text-sm font-semibold text-center">Call Emergency</span>
                    <span className="text-xs text-gray-400">Direct Line</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl hover:border-orange-500/40 transition-all group">
                    <FaAmbulance className="text-2xl sm:text-3xl text-orange-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs sm:text-sm font-semibold text-center">Call Ambulance</span>
                    <span className="text-xs text-gray-400">102 / 108</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl hover:border-blue-500/40 transition-all group">
                    <FaShieldAlt className="text-2xl sm:text-3xl text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs sm:text-sm font-semibold text-center">Call Police</span>
                    <span className="text-xs text-gray-400">100</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-all group">
                    <FaLifeRing className="text-2xl sm:text-3xl text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs sm:text-sm font-semibold text-center">Support Team</span>
                    <span className="text-xs text-gray-400">24/7 Help</span>
                  </button>
                </div>

                {/* Emergency Incidents List */}
                {emergencies.length > 0 ? (
                  <div className="space-y-3">
                    {emergencies.map((emergency, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/30 rounded-xl p-4 sm:p-6"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FaExclamationTriangle className="text-red-400 text-lg sm:text-xl animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base sm:text-lg font-bold text-white">SOS Alert</h3>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  emergency.status === 'acknowledged'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-red-500 text-white animate-pulse'
                                }`}>
                                  {emergency.status === 'acknowledged' ? 'ACKNOWLEDGED' : 'LIVE'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 mb-2">
                                <strong>{emergency.userName}</strong> has triggered an emergency alert
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <FaMapMarkerAlt className="text-red-400" />
                                  <span className="text-gray-400">{emergency.location || 'Location pending...'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FaPhone className="text-red-400" />
                                  <span className="text-gray-400">{emergency.phone || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FaClock className="text-red-400" />
                                  <span className="text-gray-400">{new Date(emergency.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-2">
                                <p className="text-gray-400">Type: <span className="text-white capitalize">{emergency.emergencyType || 'other'}</span></p>
                                <p className="text-gray-400">Email: <span className="text-white">{emergency.userEmail || 'N/A'}</span></p>
                                <p className="text-gray-400">College: <span className="text-white">{emergency.college || 'N/A'}</span></p>
                                <p className="text-gray-400">Message: <span className="text-white">{emergency.message || 'N/A'}</span></p>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                            {emergency.phone && emergency.phone !== 'N/A' ? (
                              <a
                                href={`tel:${emergency.phone}`}
                                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl transition-all font-semibold text-xs sm:text-sm text-center bg-red-500 text-white hover:bg-red-600"
                              >
                                Call User
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl transition-all font-semibold text-xs sm:text-sm text-center bg-red-500/30 text-red-200 cursor-not-allowed"
                              >
                                Call User
                              </button>
                            )}
                            {emergency.locationLat && emergency.locationLng ? (
                              <a
                                href={`https://maps.google.com/?q=${emergency.locationLat},${emergency.locationLng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-semibold text-xs sm:text-sm text-center"
                              >
                                View Map
                              </a>
                            ) : (
                              <button type="button" disabled className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-white/10 text-gray-400 rounded-xl cursor-not-allowed font-semibold text-xs sm:text-sm">
                                View Map
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={updatingEmergencyId === emergency.id || emergency.status === 'acknowledged'}
                              onClick={() => handleEmergencyStatusUpdate(emergency.id, 'acknowledged')}
                              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-xl hover:bg-yellow-500/30 transition-all font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Acknowledge
                            </button>
                            <button
                              type="button"
                              disabled={updatingEmergencyId === emergency.id}
                              onClick={() => handleEmergencyStatusUpdate(emergency.id, 'resolved')}
                              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-green-500/20 text-green-300 rounded-xl hover:bg-green-500/30 transition-all font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              disabled={updatingEmergencyId === emergency.id}
                              onClick={() => handleEmergencyStatusUpdate(emergency.id, 'false-alarm')}
                              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-gray-500/20 text-gray-300 rounded-xl hover:bg-gray-500/30 transition-all font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              False Alarm
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 sm:py-20 bg-bg-secondary border border-white/10 rounded-2xl">
                    <FaCheckCircle className="mx-auto text-5xl sm:text-6xl text-green-400 mb-4" />
                    <h3 className="text-lg sm:text-xl font-bold mb-2">All Clear!</h3>
                    <p className="text-gray-400">No active emergencies at the moment</p>
                  </div>
                )}

                {/* Emergency Protocols */}
                <div className="bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border border-yellow-500/20 rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <FaBell className="text-yellow-400" />
                    Emergency Response Protocols
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-green/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-accent-green font-bold text-xs">1</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Immediate Response</p>
                        <p className="text-gray-400 text-xs">Contact user within 30 seconds of SOS alert</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-green/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-accent-green font-bold text-xs">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Alert Emergency Services</p>
                        <p className="text-gray-400 text-xs">Call 100 (Police) or 108 (Ambulance) if needed</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-green/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-accent-green font-bold text-xs">3</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Track Location</p>
                        <p className="text-gray-400 text-xs">Get real-time GPS location of the user</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-accent-green/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-accent-green font-bold text-xs">4</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Document Incident</p>
                        <p className="text-gray-400 text-xs">Log all details for safety records</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admins Tab */}
            {activeTab === 'admins' && canManageAdmins && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Admin Management</h2>
                  <button
                    onClick={() => setShowAddAdmin(true)}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    <FaPlus />
                    Add New Admin
                  </button>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {admins.map((adm) => {
                    return (
                    <div key={adm.id} className="bg-bg-secondary border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            adm.role === 'admin' || adm.role === 'master' ? 'bg-yellow-500/20' : 'bg-accent-green/20'
                          }`}>
                            {adm.role === 'admin' || adm.role === 'master' ? (
                              <FaCrown className="text-yellow-400 text-xl sm:text-2xl" />
                            ) : (
                              <FaUserShield className="text-accent-green text-xl sm:text-2xl" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-xl font-bold">{adm.name}</h3>
                              {(adm.role === 'admin' || adm.role === 'master') && adm.isAdmin && (
                                <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                                  Master Admin
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm">****@spllit.app</p>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                              Last login: {adm.lastLogin ? new Date(adm.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                          <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full whitespace-nowrap font-bold uppercase ${
                            adm.adminStatus === 'active' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {adm.adminStatus === 'active' ? '● Enabled' : '○ Disabled'}
                          </span>
                          {isMasterAdmin && adm.role === 'subadmin' && adm.adminStatus === 'active' && (
                            <button
                              onClick={() => handleDeactivateAdmin(adm.id)}
                              className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all text-xs sm:text-sm font-medium"
                              title="Disable this admin - they won't be able to login"
                            >
                              Disable
                            </button>
                          )}
                          {isMasterAdmin && adm.role === 'subadmin' && adm.adminStatus === 'inactive' && (
                            <>
                              <button
                                onClick={() => handleActivateAdmin(adm.id)}
                                className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all text-xs sm:text-sm font-medium"
                                title="Enable this admin - they will be able to login"
                              >
                                Enable
                              </button>
                              <button
                                onClick={() => handleOpenResetPasswordModal(adm)}
                                className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all text-xs sm:text-sm font-medium"
                                title="Reset password securely"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(adm.id)}
                                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all text-xs sm:text-sm font-medium"
                                title="Delete permanently - email can be reused"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {isMasterAdmin && adm.role === 'subadmin' && adm.adminStatus === 'active' && (
                            <button
                              onClick={() => handleOpenResetPasswordModal(adm)}
                              className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all text-xs sm:text-sm font-medium"
                              title="Reset password securely"
                            >
                              Reset Password
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={() => setShowAddAdmin(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">Add New Admin</h2>
                <button
                  onClick={() => setShowAddAdmin(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Name</label>
                  <input
                    type="text"
                    required
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    className="w-full mt-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    placeholder="Admin name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Email</label>
                  <input
                    type="email"
                    required
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    className="w-full mt-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    placeholder="admin@spllit.app"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    className="w-full mt-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 sm:py-4 bg-accent-green text-black font-bold rounded-xl hover:bg-accent-green/90 transition-all text-sm sm:text-base"
                >
                  Create Admin
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showResetPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={() => setShowResetPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-bg-secondary border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">Reset Subadmin Password</h2>
                <button
                  onClick={() => setShowResetPasswordModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                Set a new password for <span className="text-white font-semibold">{resetTargetAdmin?.name}</span>.
              </p>

              <form onSubmit={handleSubmitResetPassword} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={resetForm.password}
                    onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                    className="w-full mt-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    placeholder="Minimum 8 chars with letters and numbers"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    className="w-full mt-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-green/50 text-white text-sm"
                    placeholder="Re-enter new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="w-full py-3 sm:py-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all text-sm sm:text-base disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Notifications */}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </div>
  );
};

export default AdminDashboard;
