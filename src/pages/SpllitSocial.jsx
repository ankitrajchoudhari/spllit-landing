import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaRocket, FaUser, FaEnvelope, FaPhone, FaCheckCircle } from 'react-icons/fa';
import { earlyAccessAPI } from '../services/api';

const SpllitSocial = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess('');
    setError('');

    try {
      const result = await earlyAccessAPI.register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim()
      });

      setSuccess(result.message || 'Registered successfully');
      setFormData({ name: '', email: '', phone: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16 px-4 sm:px-6">
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
            Stay tuned and join early access to get Pro.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-xl mx-auto bg-bg-secondary border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl"
        >
          <h2 className="text-2xl font-bold mb-5">Join Early Access</h2>

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-300 flex items-center gap-2">
              <FaCheckCircle />
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300">
              {error}
            </div>
          )}

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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-accent-green text-black font-bold hover:bg-accent-green/90 disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Join Early Access'}
            </button>
          </form>
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
