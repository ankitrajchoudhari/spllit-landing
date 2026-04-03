import React from 'react';
import { motion } from 'framer-motion';

const CTA = () => {
    return (
        <section className="py-20 sm:py-24 relative overflow-hidden bg-bg-secondary">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-green/12 via-transparent to-accent-emerald/10" />
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] bg-accent-green/10 blur-[140px] rounded-full" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="max-w-4xl mx-auto rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-10"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-green/25 bg-accent-green/10 mb-6">
                        <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                        <span className="text-[11px] font-bold tracking-[0.28em] text-accent-green uppercase">Join Early Access</span>
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
                        Ready to make your commute cheaper and smarter?
                    </h2>
                    <p className="text-base sm:text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
                        Get into the early community and start splitting rides with verified people around your campus or workplace.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <a
                            href="/login?signin=1"
                            className="w-full sm:w-auto bg-gradient-to-r from-accent-green to-accent-emerald text-black px-8 py-3.5 rounded-xl font-bold text-base hover:shadow-[0_0_35px_rgba(16,185,129,0.45)] transition-all transform hover:-translate-y-1"
                        >
                            Join Early Access
                        </a>
                        <a
                            href="/how-it-works"
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
                        >
                            Explore How It Works
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default CTA;
