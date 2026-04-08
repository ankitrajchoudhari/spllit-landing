import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEnvelope, FaCog, FaCheckCircle, FaTimesCircle, FaClock, FaPaperPlane } from 'react-icons/fa';
import { automationAPI } from '../services/api';

const AutomationMail = () => {
  const [activeTab, setActiveTab] = useState('setup'); // setup, send, history
  const [providers, setProviders] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Provider setup form
  const [providerForm, setProviderForm] = useState({
    name: 'gmail', // gmail or zoho
    recipientEmail: '',
    refreshToken: '',
    apiKey: '',
    password: '',
    smtp: 'smtp.gmail.com',
    port: 587,
  });

  // Mail sending form
  const [mailForm, setMailForm] = useState({
    prompt: '',
    providerId: '',
    subject: '',
    csvFile: null,
  });

  const fetchProviders = async () => {
    try {
      return await automationAPI.getProviders();
    } catch (error) {
      console.error('Error loading providers:', error);
      return [];
    }
  };

  const fetchCampaigns = async () => {
    try {
      return await automationAPI.getCampaigns();
    } catch (error) {
      console.error('Error loading campaigns:', error);
      return [];
    }
  };

  // Load providers and campaigns on mount
  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      const [nextProviders, nextCampaigns] = await Promise.all([fetchProviders(), fetchCampaigns()]);
      if (!mounted) return;
      setProviders(nextProviders);
      setCampaigns(nextCampaigns);
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle provider setup
  const handleSaveProvider = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await automationAPI.saveProvider(providerForm);
      setMessage({ type: 'success', text: 'Mail provider saved successfully' });
      setProviderForm({
        name: 'gmail',
        recipientEmail: '',
        refreshToken: '',
        apiKey: '',
        password: '',
        smtp: 'smtp.gmail.com',
        port: 587,
      });
      const nextProviders = await fetchProviders();
      setProviders(nextProviders);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save provider' });
    }
    setLoading(false);
  };

  // Test provider connection
  const handleTestProvider = async (providerId) => {
    setLoading(true);
    try {
      const response = await automationAPI.testProvider(providerId);
      if (response.connected) {
        setMessage({ type: 'success', text: 'Connection successful!' });
      } else {
        setMessage({ type: 'error', text: 'Connection failed' });
      }
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Test failed' });
    }
    setLoading(false);
  };

  // Handle send bulk mail
  const handleSendBulkMail = async (e) => {
    e.preventDefault();
    if (!mailForm.prompt || !mailForm.providerId || !mailForm.subject || !mailForm.csvFile) {
      setMessage({ type: 'error', text: 'Please fill all fields and upload CSV' });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('prompt', mailForm.prompt);
      formData.append('providerId', mailForm.providerId);
      formData.append('subject', mailForm.subject);
      formData.append('csvFile', mailForm.csvFile);

      const response = await automationAPI.sendBulkMail(formData);
      setMessage({
        type: 'success',
        text: `Campaign sent: ${response.summary.successCount}/${response.summary.total} emails delivered`,
      });

      setMailForm({ prompt: '', providerId: '', subject: '', csvFile: null });
      const nextCampaigns = await fetchCampaigns();
      setCampaigns(nextCampaigns);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send emails' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FaEnvelope className="text-2xl text-accent-green" />
        <h2 className="text-2xl font-bold">Automation Mail</h2>
      </div>

      {/* Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: 'setup', label: 'Mail Setup', icon: FaCog },
          { id: 'send', label: 'Send Email', icon: FaEnvelope },
          { id: 'history', label: 'History', icon: FaClock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition ${
              activeTab === tab.id
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-gray-400 hover:text-accent-green'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      <AnimatePresence>
        {activeTab === 'setup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Add Mail Provider</h3>

              <form onSubmit={handleSaveProvider} className="space-y-4">
                {/* Provider Type */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Provider</label>
                  <select
                    value={providerForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setProviderForm({
                        ...providerForm,
                        name,
                        smtp: name === 'gmail' ? 'smtp.gmail.com' : 'smtp.zoho.com',
                        port: name === 'gmail' ? 587 : 587,
                      });
                    }}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white focus:outline-none focus:border-accent-green"
                  >
                    <option value="gmail">Gmail (OAuth)</option>
                    <option value="zoho">Zoho Mail</option>
                  </select>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Email Address (team@spllit)</label>
                  <input
                    type="email"
                    value={providerForm.recipientEmail}
                    onChange={(e) => setProviderForm({ ...providerForm, recipientEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                    placeholder="team@spllit.com"
                    required
                  />
                </div>

                {/* Conditional fields based on provider */}
                {providerForm.name === 'gmail' ? (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Google Refresh Token</label>
                    <input
                      type="password"
                      value={providerForm.refreshToken}
                      onChange={(e) => setProviderForm({ ...providerForm, refreshToken: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green text-xs"
                      placeholder="Paste your Google refresh token"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Get this by authorizing with Google: <code>https://console.cloud.google.com</code>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">SMTP Host</label>
                        <input
                          type="text"
                          value={providerForm.smtp}
                          onChange={(e) => setProviderForm({ ...providerForm, smtp: e.target.value })}
                          className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Port</label>
                        <input
                          type="number"
                          value={providerForm.port}
                          onChange={(e) => setProviderForm({ ...providerForm, port: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Password</label>
                      <input
                        type="password"
                        value={providerForm.password}
                        onChange={(e) => setProviderForm({ ...providerForm, password: e.target.value })}
                        className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                        placeholder="Zoho account password"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-green text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Provider'}
                </button>
              </form>
            </div>

            {/* Saved Providers */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Saved Providers</h3>
              <div className="grid gap-3">
                {providers.map((provider) => (
                  <div key={provider.id} className="bg-white/5 border border-white/10 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium capitalize">{provider.name}</p>
                      <p className="text-sm text-gray-300">{provider.recipientEmail}</p>
                    </div>
                    <button
                      onClick={() => handleTestProvider(provider.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                    >
                      Test
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Tab */}
      <AnimatePresence>
        {activeTab === 'send' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Send Bulk Mail</h3>

              <form onSubmit={handleSendBulkMail} className="space-y-4">
                {/* Provider Select */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Select Provider</label>
                  <select
                    value={mailForm.providerId}
                    onChange={(e) => setMailForm({ ...mailForm, providerId: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white focus:outline-none focus:border-accent-green"
                    required
                  >
                    <option value="">Choose a provider...</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} - {provider.recipientEmail}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Email Subject</label>
                  <input
                    type="text"
                    value={mailForm.subject}
                    onChange={(e) => setMailForm({ ...mailForm, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                    placeholder="e.g., Join our community today!"
                    required
                  />
                </div>

                {/* AI Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">AI Prompt (Convert to Email)</label>
                  <textarea
                    value={mailForm.prompt}
                    onChange={(e) => setMailForm({ ...mailForm, prompt: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green h-24 resize-none"
                    placeholder="e.g., Write a professional email inviting users to join our new ride-sharing feature..."
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Your prompt will be converted to a professional email message using AI
                  </p>
                </div>

                {/* CSV Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Upload CSV File (Email List)</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setMailForm({ ...mailForm, csvFile: e.target.files?.[0] || null })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white file:text-white focus:outline-none focus:border-accent-green"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    CSV should have an 'email' column. Example: email,name
                  </p>
                </div>

                {/* File preview */}
                {mailForm.csvFile && (
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <FaCheckCircle size={14} />
                    {mailForm.csvFile.name}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-green text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : <>
                    <FaPaperPlane size={14} />
                    Send Bulk Mail
                  </>}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Tab */}
      <AnimatePresence>
        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <h3 className="text-lg font-semibold">Campaign History</h3>
            <div className="grid gap-3">
              {campaigns.length === 0 ? (
                <p className="text-gray-400">No campaigns yet</p>
              ) : (
                campaigns.map((campaign) => (
                  <div key={campaign.id} className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{campaign.subject}</p>
                        <p className="text-sm text-gray-300">{campaign.providerName}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${
                          campaign.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm mt-3">
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="font-semibold">{campaign.recipientCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Success</p>
                        <p className="font-semibold text-green-600">{campaign.successCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Failed</p>
                        <p className="font-semibold text-red-600">{campaign.failureCount}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{new Date(campaign.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutomationMail;
