import { useState, useEffect } from 'react';
import { FaUserShield, FaPlus, FaTimes, FaTrash, FaToggleOn, FaToggleOff, FaEdit } from 'react-icons/fa';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://ankit-production-f3d4.up.railway.app/api';

const SubadminManagement = () => {
    const [subadmins, setSubadmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        college: 'Admin Panel',
        gender: 'other',
        phone: ''
    });

    useEffect(() => {
        loadSubadmins();
    }, []);

    const loadSubadmins = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`${API_URL}/subadmin/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSubadmins(response.data.subadmins);
        } catch (err) {
            console.error('Load subadmins error:', err);
            setError('Failed to load subadmins');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubadmin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(
                `${API_URL}/subadmin/create`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccess(response.data.message);
            setShowCreateModal(false);
            setFormData({
                name: '',
                email: '',
                password: '',
                college: 'Admin Panel',
                gender: 'other',
                phone: ''
            });
            loadSubadmins();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create subadmin');
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (id) => {
        if (!confirm('Are you sure you want to deactivate this subadmin?')) return;

        try {
            const token = localStorage.getItem('accessToken');
            await axios.put(
                `${API_URL}/subadmin/${id}/deactivate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Subadmin deactivated successfully');
            loadSubadmins();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to deactivate subadmin');
        }
    };

    const handleActivate = async (id) => {
        try {
            const token = localStorage.getItem('accessToken');
            await axios.put(
                `${API_URL}/subadmin/${id}/activate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Subadmin activated successfully');
            loadSubadmins();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to activate subadmin');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to permanently delete this subadmin? The email can be reused later.')) return;

        try {
            const token = localStorage.getItem('accessToken');
            await axios.delete(
                `${API_URL}/subadmin/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Subadmin deleted successfully. Email can now be reused.');
            loadSubadmins();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete subadmin');
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <FaUserShield className="text-purple-400 text-2xl" />
                    <h2 className="text-2xl font-bold text-white">Subadmin Management</h2>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <FaPlus />
                    <span>Add Subadmin</span>
                </button>
            </div>

            {/* Notifications */}
            {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-200">
                    {success}
                </div>
            )}

            {/* Subadmins List */}
            {loading && !subadmins.length ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="text-gray-400 mt-4">Loading subadmins...</p>
                </div>
            ) : subadmins.length === 0 ? (
                <div className="text-center py-12 bg-gray-700/50 rounded-lg">
                    <FaUserShield className="text-gray-600 text-6xl mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No subadmins yet</p>
                    <p className="text-gray-500 text-sm mt-2">Click "Add Subadmin" to create one</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {subadmins.map((admin) => (
                        <div
                            key={admin.id}
                            className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-white">{admin.name}</h3>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                            admin.adminStatus === 'active'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}
                                    >
                                        {admin.adminStatus === 'active' ? '● Enabled' : '○ Disabled'}
                                    </span>
                                </div>
                                <p className="text-gray-400 text-sm">{admin.email}</p>
                                <p className="text-gray-500 text-xs mt-1">
                                    Created: {new Date(admin.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {admin.adminStatus === 'active' ? (
                                    <button
                                        onClick={() => handleDeactivate(admin.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors font-medium"
                                        title="Deactivate this subadmin - they won't be able to login"
                                    >
                                        <FaToggleOff />
                                        <span>Disable</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleActivate(admin.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors font-medium"
                                        title="Activate this subadmin - they will be able to login"
                                    >
                                        <FaToggleOn />
                                        <span>Enable</span>
                                    </button>
                                )}

                                {admin.adminStatus === 'inactive' && (
                                    <button
                                        onClick={() => handleDelete(admin.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                                        title="Delete permanently - email can be reused"
                                    >
                                        <FaTrash />
                                        <span>Delete</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Subadmin Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-white">Add Subadmin</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubadmin} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">
                                    Email * (Gmail, Yahoo, Outlook, Zoho, etc.)
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Must be from a verified email provider
                                </p>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Password *</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Phone (optional)</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create Subadmin'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubadminManagement;
