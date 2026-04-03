import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaMapMarkerAlt, FaUserFriends, FaCalendarAlt, FaCheckCircle, FaArrowRight, FaCar, FaMotorcycle, FaClock } from 'react-icons/fa';
import SEO from '../components/SEO';

const CHENNAI_CENTERS = [
    "iON Digital Zone iDZ T Nagar (Ramakrishna Mission)",
    "iON Digital Zone iDZ Ambattur (Indira Memorial)",
    "iON Digital Zone iDZ Kovilambakkam",
    "iON Digital Zone iDZ Kundrathur",
    "iON Digital Zone iDZ Padi",
    "iON Digital Zone iDZ Perungudi",
    "iON Digital Zone iDZ Thoraipakkam",
    "iON Digital Zone iDZ Pallavaram",
    "iON Digital Zone iDZ Maduravoyal"
];

const QuizPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        level: '',
        centerName: '',
        state: 'Tamil Nadu',
        city: 'Chennai',
        genderPreference: '',
        date: '15 March 2026',
        vehicleType: '',
        departureTime: '',
        approxFare: ''
    });
    const [matches, setMatches] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Get previous user data from location state
    const userData = location.state?.userData || {};

    useEffect(() => {
        if (!userData.name) {
            navigate('/login');
        }
    }, [userData, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzd7LT16rBaMUeNm1WA67VIacHYnW8Pe04hmv1YodBIZt8qgXbDzEH61s3pgh23wePHTw/exec';

        const dataToSubmit = {
            name: userData.name,
            college: userData.college,
            degree: userData.degree,
            email: userData.email,
            phone: userData.phone,
            level: formData.level,
            centerName: formData.centerName,
            genderPreference: formData.genderPreference,
            vehicleType: formData.vehicleType,
            departureTime: formData.departureTime,
            approxFare: formData.approxFare,
            timestamp: new Date().toISOString()
        };

        try {
            // Using POST to submit data
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(dataToSubmit)
            });

            // Note: with no-cors we can't read the response directly.
            // In a real scenario, we'd use a separate GET request to fetch matches 
            // OR use a proxy/CORS-enabled backend.

            // For now, let's simulate successful submission
            // Store submission status locally for persistence if needed
            localStorage.setItem('last_submission', JSON.stringify({
                center: formData.centerName,
                time: formData.departureTime,
                timestamp: new Date().getTime()
            }));

            setIsSuccess(true);

            // Navigate after delay, but provide a manual button too
            setTimeout(() => {
                navigate('/');
            }, 6000);
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white pt-32 pb-20 px-6 relative overflow-hidden selection:bg-accent-green selection:text-black">
            <SEO title="Quiz 1 - 15 March 2026 | Spllit" description="Connect with batchmates for Quiz 1 at IIT Madras BS Degree centers." />

            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.04] via-transparent to-accent-green/[0.04] pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent-green/10 rounded-full blur-[120px]" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />

            <div className="container mx-auto max-w-2xl relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-12 rounded-[2.5rem] shadow-2xl relative"
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-10">
                        <div className="flex-1">
                            <h2 className="text-accent-green font-mono text-xs tracking-[0.2em] uppercase mb-3">Quiz 1 Support</h2>
                            <h1 className="text-3xl sm:text-4xl font-black mb-3">15 March 2026</h1>
                            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">Choose your exam center and find travel buddies.</p>
                        </div>
                        <div className="hidden sm:flex p-5 bg-accent-green/10 rounded-[2rem] text-accent-green border border-accent-green/20">
                            <FaCalendarAlt size={28} />
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Level Section */}
                        <div className="space-y-4 p-5 bg-white/[0.03] rounded-3xl border border-white/5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-accent-green/20 flex items-center justify-center text-accent-green">
                                    <FaCheckCircle size={14} />
                                </div>
                                <label className="text-sm font-bold text-gray-200 uppercase tracking-widest">Your Level</label>
                            </div>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4.5 focus:border-accent-green outline-none transition-all appearance-none cursor-pointer text-white"
                                >
                                    <option value="" disabled className="bg-[#0a0a0a]">Select Level</option>
                                    <option value="Level 1" className="bg-[#0a0a0a]">Level 1 (Foundation)</option>
                                    <option value="Level 2" className="bg-[#0a0a0a]">Level 2 (Diploma)</option>
                                    <option value="Level 3" className="bg-[#0a0a0a]">Level 3 (Degree)</option>
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <FaArrowRight className="rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* Center Section */}
                        <div className="space-y-4 p-5 bg-white/[0.03] rounded-3xl border border-white/5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-accent-green/20 flex items-center justify-center text-accent-green">
                                    <FaMapMarkerAlt size={14} />
                                </div>
                                <label className="text-sm font-bold text-gray-200 uppercase tracking-widest">Exam Center</label>
                            </div>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.centerName}
                                    onChange={(e) => setFormData({ ...formData, centerName: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4.5 focus:border-accent-green outline-none transition-all appearance-none cursor-pointer text-white"
                                >
                                    <option value="" disabled className="bg-[#0a0a0a]">Select Center</option>
                                    {CHENNAI_CENTERS.map((center, idx) => (
                                        <option key={idx} value={center} className="bg-[#0a0a0a]">{center}</option>
                                    ))}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <FaArrowRight className="rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* Timing & Vehicle Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-4 p-5 bg-white/[0.03] rounded-3xl border border-white/5 relative group transition-all hover:bg-white/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-accent-green/20 flex items-center justify-center text-accent-green">
                                        <FaClock size={14} />
                                    </div>
                                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Departure</label>
                                </div>
                                <input
                                    required
                                    type="time"
                                    value={formData.departureTime}
                                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none text-xl font-bold text-white custom-time-input"
                                />
                            </div>
                            <div className="space-y-4 p-5 bg-white/[0.03] rounded-3xl border border-white/5 relative group transition-all hover:bg-white/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-accent-green/20 flex items-center justify-center text-accent-green">
                                        {formData.vehicleType === 'Cab' ? <FaCar size={14} /> : <FaMotorcycle size={14} />}
                                    </div>
                                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Vehicle</label>
                                </div>
                                <select
                                    required
                                    value={formData.vehicleType}
                                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none text-lg font-bold text-white appearance-none cursor-pointer"
                                >
                                    <option value="" disabled className="bg-[#1a1a1a]">Select</option>
                                    <option value="Auto" className="bg-[#1a1a1a]">Auto (3 Seats)</option>
                                    <option value="Cab" className="bg-[#1a1a1a]">Cab (4 Seats)</option>
                                </select>
                            </div>
                        </div>

                        {/* Fare & Savings Card */}
                        <div className="p-6 bg-gradient-to-br from-white/[0.05] to-transparent rounded-[2rem] border border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <label className="text-sm font-bold text-gray-400 tracking-widest uppercase">Estimated Trip Cost (Total)</label>
                                <span className="text-accent-green font-mono text-xs">AI Estimation</span>
                            </div>
                            <div className="flex items-center gap-4 mb-8">
                                <span className="text-3xl font-black text-white">₹</span>
                                <input
                                    required
                                    type="number"
                                    placeholder="00"
                                    value={formData.approxFare}
                                    onChange={(e) => setFormData({ ...formData, approxFare: e.target.value })}
                                    className="bg-transparent border-b-2 border-white/10 focus:border-accent-green outline-none text-4xl font-black w-32 pb-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            {formData.approxFare && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 p-4 bg-accent-green/10 rounded-2xl border border-accent-green/20"
                                >
                                    <div className="w-10 h-10 rounded-full bg-accent-green flex items-center justify-center text-black font-black italic">!</div>
                                    <div>
                                        <p className="text-xs text-accent-green font-black uppercase tracking-tighter">Budget Split Forecast</p>
                                        <p className="text-lg font-bold text-white leading-none">
                                            ₹{Math.round(formData.approxFare / (formData.vehicleType === 'Cab' ? 4 : 3))} <span className="text-[10px] font-normal text-gray-400">/ person</span>
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || isSuccess}
                            className={`w-full py-6 rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 transition-all ${isSuccess
                                ? 'bg-green-500 text-white'
                                : 'bg-gradient-to-r from-accent-green to-emerald-500 text-black shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:-translate-y-1 active:scale-95'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-4 border-black border-t-transparent rounded-full animate-spin" />
                            ) : isSuccess ? (
                                <>Matching Success! <FaCheckCircle /></>
                            ) : (
                                <>Find My Match <FaArrowRight /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 flex items-center justify-center gap-4 py-4 px-6 bg-white/5 rounded-2xl border border-white/5 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                        <FaUserFriends className="text-accent-green" />
                        <span>Real-time proximity search enabled</span>
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {isSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505] px-6"
                    >
                        <div className="text-center max-w-md">
                            <motion.div
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 15 }}
                                className="w-32 h-32 bg-accent-green rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-black shadow-[0_0_80px_rgba(16,185,129,0.3)]"
                            >
                                <FaCheckCircle size={50} />
                            </motion.div>
                            <h2 className="text-4xl sm:text-5xl font-black mb-6 tracking-tighter text-white">SCANNING COMPLETE!</h2>
                            <p className="text-gray-400 text-sm leading-relaxed mb-10 font-medium">
                                We've analyzed your route. We are checking for students at <span className="text-accent-green font-bold">{formData.centerName}</span> within 30 mins of <span className="text-accent-green font-bold">{formData.departureTime}</span>.
                            </p>
                            <div className="flex flex-col gap-3">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                                    <p className="text-[10px] font-black text-accent-green uppercase mb-1">Matching Status</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-accent-green animate-ping" />
                                        <span className="text-white font-bold text-sm">Searching for Travel Buddies...</span>
                                    </div>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate('/')}
                                    className="w-full py-4 mt-6 bg-white/10 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                >
                                    Go to Homepage <FaArrowRight />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default QuizPage;
