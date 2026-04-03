import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaRocket, FaUser, FaEnvelope, FaPhone, FaCheckCircle, FaMicrophone, FaStopCircle, FaLock, FaTimes, FaWhatsapp } from 'react-icons/fa';
import { earlyAccessAPI } from '../services/api';
import useAuthStore from '../store/authStore';

const SpllitSocial = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const whatsappCommunityUrl = import.meta.env.VITE_WHATSAPP_COMMUNITY_URL || '';

  const identifiedEmail = useMemo(() => {
    if (formData.email) return formData.email.trim().toLowerCase();
    return user?.email?.toLowerCase() || '';
  }, [formData.email, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setFormData((prev) => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || ''
    }));
  }, [isAuthenticated, user]);

  useEffect(() => {
    const checkSubmission = async () => {
      if (!identifiedEmail) return;
      try {
        const status = await earlyAccessAPI.checkStatus(identifiedEmail);
        if (status.submitted) {
          setIsSubmitted(true);
          setSubmittedInfo(status.registration || null);
        }
      } catch (e) {
        // No-op for status check failures.
      }
    };
    checkSubmission();
  }, [identifiedEmail]);

  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Please type your message.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setError('Could not capture voice right now. Please try again.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      setFormData((prev) => ({
        ...prev,
        message: transcript
      }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitted) {
      setError('You have already joined early access with this email.');
      return;
    }

    setIsSubmitting(true);
    setSuccess('');
    setError('');

    try {
      const result = await earlyAccessAPI.register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        message: formData.message.trim()
      });

      setSuccess(result.message || 'Registered successfully');
      setIsSubmitted(true);
      setSubmittedInfo(result.registration || null);
      setFormData((prev) => ({ ...prev, message: '' }));
    } catch (err) {
      if (err.response?.data?.code === 'ALREADY_REGISTERED') {
        setIsSubmitted(true);
        setSubmittedInfo(err.response?.data?.registration || null);
        setError('You have already joined early access. Coming soon, stay tuned.');
      } else {
        setError(err.response?.data?.error || 'Failed to submit registration');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseForm = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_32%)] pointer-events-none" />
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-green/10 border border-accent-green/20 text-accent-green font-semibold mb-5">
            <FaRocket />
            Spllit Social
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-3">
            Coming Soon
          </h1>
          <p className="text-lg text-gray-300">
            Stay tuned and join early access to get Pro. Social communities are almost ready.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-xl mx-auto bg-bg-secondary/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative"
        >
          <button
            type="button"
            onClick={handleCloseForm}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center"
            title="Close"
          >
            <FaTimes />
          </button>

          <h2 className="text-2xl font-bold mb-2">Join Early Access</h2>
          <p className="text-sm text-gray-400 mb-5">One-time signup per email. We will notify you when Spllit Social launches.</p>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-300 flex items-center gap-2"
              >
                <FaCheckCircle />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300">
              {error}
            </div>
          )}

          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-accent-green/30 bg-accent-green/10"
            >
              <div className="flex items-start gap-3">
                <FaLock className="text-accent-green mt-1" />
                <div>
                  <p className="text-white font-semibold">You have submitted</p>
                  <p className="text-gray-300 text-sm mt-1">Coming soon. Stay tuned for updates and Pro early benefits.</p>

                  <div className="mt-3 text-xs text-gray-300 space-y-1">
                    <p>
                      <span className="text-gray-400">Email:</span> {submittedInfo?.email || identifiedEmail || 'N/A'}
                    </p>
                    <p>
                      <span className="text-gray-400">Submitted At:</span>{' '}
                      {submittedInfo?.createdAt
                        ? new Date(submittedInfo.createdAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappCommunityUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold ${whatsappCommunityUrl ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30' : 'bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed pointer-events-none'}`}
                >
                  <FaWhatsapp />
                  Join WhatsApp Community
                </a>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </motion.div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              icon={FaUser}
              label="Name"
              type="text"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="Enter your name"
              required
            />
            <InputField
              icon={FaEnvelope}
              label="Email"
              type="email"
              value={formData.email}
              onChange={(value) => setFormData({ ...formData, email: value })}
              placeholder="Enter your email"
              required
            />
            <InputField
              icon={FaPhone}
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              placeholder="Enter your phone number"
              required
            />

            <label className="block">
              <span className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">What should Spllit Social build first?</span>
              <div className="mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-accent-green/50">
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Type your idea, or use mic voice input..."
                  className="w-full bg-transparent outline-none text-white placeholder-gray-500 min-h-[96px] resize-y"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isListening ? 'border-red-400/40 text-red-300 bg-red-500/10' : 'border-white/20 text-gray-200 bg-white/5 hover:bg-white/10'}`}
                  >
                    {isListening ? <FaStopCircle /> : <FaMicrophone />}
                    {isListening ? 'Stop Recording' : 'Voice Record'}
                  </button>
                </div>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-accent-green text-black font-bold hover:bg-accent-green/90 disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Join Early Access'}
            </button>
          </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

const InputField = ({ icon: Icon, label, type, value, onChange, placeholder, required }) => (
  <label className="block">
    <span className="text-xs font-bold text-accent-green ml-4 tracking-widest uppercase">{label}</span>
    <div className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-accent-green/50">
      <Icon className="text-accent-green" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-transparent outline-none text-white placeholder-gray-500"
      />
    </div>
  </label>
);

export default SpllitSocial;
