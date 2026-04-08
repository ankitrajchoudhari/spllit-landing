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
    message: '',
    aiMode: 'yes',
    sendMode: 'bulk',
    providerId: '',
    subject: '',
    recipientEmail: '',
    recipientName: '',
    csvFile: null,
  });
  const [previewData, setPreviewData] = useState(null);
  const [csvMeta, setCsvMeta] = useState({ totalRows: 0, validEmails: 0, firstEmail: '' });

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
  const handleSendMail = async (e) => {
    e.preventDefault();
    const usingAI = mailForm.aiMode === 'yes';
    const isBulk = mailForm.sendMode === 'bulk';

    if (!mailForm.providerId || !mailForm.subject) {
      setMessage({ type: 'error', text: 'Please select provider and subject' });
      return;
    }

    if (usingAI && !mailForm.prompt) {
      setMessage({ type: 'error', text: 'Please enter AI prompt' });
      return;
    }

    if (!usingAI && !mailForm.message) {
      setMessage({ type: 'error', text: 'Please enter message content' });
      return;
    }

    if (isBulk && !mailForm.csvFile) {
      setMessage({ type: 'error', text: 'Please upload CSV file for bulk mode' });
      return;
    }

    if (!isBulk && !mailForm.recipientEmail) {
      setMessage({ type: 'error', text: 'Please enter recipient email for single mode' });
      return;
    }

    setLoading(true);
    try {
      if (isBulk) {
        const formData = new FormData();
        formData.append('prompt', mailForm.prompt);
        formData.append('message', mailForm.message);
        formData.append('aiMode', mailForm.aiMode);
        formData.append('providerId', mailForm.providerId);
        formData.append('subject', mailForm.subject);
        formData.append('csvFile', mailForm.csvFile);

        const response = await automationAPI.sendBulkMail(formData);
        setMessage({
          type: 'success',
          text: `Campaign sent: ${response.summary.successCount}/${response.summary.total} emails delivered`,
        });
      } else {
        const response = await automationAPI.sendSingleMail({
          prompt: mailForm.prompt,
          message: mailForm.message,
          aiMode: mailForm.aiMode,
          providerId: mailForm.providerId,
          subject: mailForm.subject,
          recipientEmail: mailForm.recipientEmail,
          recipientName: mailForm.recipientName,
        });
        setMessage({ type: 'success', text: `Email sent to ${response.summary.to}` });
      }

      setMailForm({
        prompt: '',
        message: '',
        aiMode: 'yes',
        sendMode: mailForm.sendMode,
        providerId: '',
        subject: '',
        recipientEmail: '',
        recipientName: '',
        csvFile: null,
      });
      setPreviewData(null);
      setCsvMeta({ totalRows: 0, validEmails: 0, firstEmail: '' });
      const nextCampaigns = await fetchCampaigns();
      setCampaigns(nextCampaigns);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send emails' });
    }
    setLoading(false);
  };

  const handlePreview = async () => {
    const usingAI = mailForm.aiMode === 'yes';
    if (!mailForm.providerId || !mailForm.subject) {
      setMessage({ type: 'error', text: 'Select provider and subject before preview' });
      return;
    }
    if (usingAI && !mailForm.prompt) {
      setMessage({ type: 'error', text: 'Enter prompt to preview AI result' });
      return;
    }
    if (!usingAI && !mailForm.message) {
      setMessage({ type: 'error', text: 'Enter message to preview final result' });
      return;
    }

    setLoading(true);
    try {
      const preview = await automationAPI.previewMessage({
        prompt: mailForm.prompt,
        message: mailForm.message,
        aiMode: mailForm.aiMode,
        providerId: mailForm.providerId,
        subject: mailForm.subject,
        recipientEmail:
          mailForm.sendMode === 'single'
            ? mailForm.recipientEmail
            : csvMeta.firstEmail || 'sample.user@example.com',
        recipientName: mailForm.sendMode === 'single' ? mailForm.recipientName : 'CSV Recipient',
      });
      setPreviewData(preview.preview);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to generate preview' });
    }
    setLoading(false);
  };

  const handleCsvUpload = async (file) => {
    if (!file) {
      setCsvMeta({ totalRows: 0, validEmails: 0, firstEmail: '' });
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    let validEmails = 0;
    let firstEmail = '';

    for (const line of lines) {
      const match = line.match(emailRegex);
      if (match?.[0]) {
        validEmails += 1;
        if (!firstEmail) firstEmail = match[0];
      }
    }

    setCsvMeta({ totalRows: lines.length, validEmails, firstEmail });
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
              <h3 className="text-lg font-semibold mb-4">Send Automation Mail</h3>

              <form onSubmit={handleSendMail} className="space-y-4">
                {/* Send mode checkboxes */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Send Mode</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={mailForm.sendMode === 'single'}
                        onChange={() => setMailForm({ ...mailForm, sendMode: 'single' })}
                        className="accent-accent-green"
                      />
                      Single Mail
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={mailForm.sendMode === 'bulk'}
                        onChange={() => setMailForm({ ...mailForm, sendMode: 'bulk' })}
                        className="accent-accent-green"
                      />
                      Bulk Mail
                    </label>
                  </div>
                </div>

                {/* AI mode dropdown */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Content Mode</label>
                  <select
                    value={mailForm.aiMode}
                    onChange={(e) => setMailForm({ ...mailForm, aiMode: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white focus:outline-none focus:border-accent-green"
                  >
                    <option value="yes">Use AI from Prompt</option>
                    <option value="no">Manual Message</option>
                  </select>
                </div>
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

                {/* AI prompt or manual message */}
                {mailForm.aiMode === 'yes' ? (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">AI Prompt (Convert to Email)</label>
                    <textarea
                      value={mailForm.prompt}
                      onChange={(e) => setMailForm({ ...mailForm, prompt: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green h-24 resize-none"
                      placeholder="Write the exact intent. Example: welcome users to Spllit and ask them to join next ride week."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Tip: Use {'{{name}}'} or {'{{email}}'} placeholders in prompt context if needed.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Manual Message Body</label>
                    <textarea
                      value={mailForm.message}
                      onChange={(e) => setMailForm({ ...mailForm, message: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green h-28 resize-none"
                      placeholder="Enter final mail HTML/text. You can use {{name}} and {{email}} placeholders."
                    />
                  </div>
                )}

                {/* Single recipient */}
                {mailForm.sendMode === 'single' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Recipient Email</label>
                      <input
                        type="email"
                        value={mailForm.recipientEmail}
                        onChange={(e) => setMailForm({ ...mailForm, recipientEmail: e.target.value })}
                        className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Recipient Name (optional)</label>
                      <input
                        type="text"
                        value={mailForm.recipientName}
                        onChange={(e) => setMailForm({ ...mailForm, recipientName: e.target.value })}
                        className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-accent-green"
                        placeholder="Ankit"
                      />
                    </div>
                  </>
                )}

                {/* CSV Upload for bulk */}
                {mailForm.sendMode === 'bulk' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Upload CSV File (Email List)</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={async (e) => {
                        const nextFile = e.target.files?.[0] || null;
                        setMailForm({ ...mailForm, csvFile: nextFile });
                        await handleCsvUpload(nextFile);
                      }}
                      className="w-full px-3 py-2 bg-bg-secondary border border-white/15 rounded-lg text-white file:text-white focus:outline-none focus:border-accent-green"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Works with `email,name` header or plain rows like `user@example.com,Ankit`.
                    </p>
                    {mailForm.csvFile && (
                      <div className="mt-2 text-xs text-gray-300 space-y-1">
                        <p>File: {mailForm.csvFile.name}</p>
                        <p>Rows: {csvMeta.totalRows} | Valid emails found: {csvMeta.validEmails}</p>
                        {csvMeta.firstEmail && <p>Preview target: {csvMeta.firstEmail}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Final preview button and output */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={loading}
                    className="px-4 py-2 border border-accent-green text-accent-green rounded-lg hover:bg-accent-green/10 transition disabled:opacity-50"
                  >
                    Preview Final Result
                  </button>
                  <span className="text-xs text-gray-400">
                    Shows exactly who receives and how the final message looks.
                  </span>
                </div>

                {previewData && (
                  <div className="bg-bg-secondary border border-white/15 rounded-lg p-4 text-sm space-y-2">
                    <p><span className="text-gray-400">From:</span> {previewData.from}</p>
                    <p><span className="text-gray-400">To:</span> {previewData.to}</p>
                    <p><span className="text-gray-400">Subject:</span> {previewData.subject}</p>
                    <div>
                      <p className="text-gray-400 mb-1">Body Preview:</p>
                      <div className="bg-black/20 border border-white/10 rounded p-3 whitespace-pre-wrap text-gray-200 max-h-48 overflow-auto">
                        {previewData.body}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-green text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : <>
                    <FaPaperPlane size={14} />
                    {mailForm.sendMode === 'bulk' ? 'Send Bulk Mail' : 'Send Single Mail'}
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
