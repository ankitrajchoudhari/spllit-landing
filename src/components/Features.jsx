import React from 'react';
import { motion } from 'framer-motion';
import { FaReceipt, FaWallet, FaLock, FaChartLine, FaCoins, FaBriefcase } from 'react-icons/fa';

const features = [
    {
        key: 'bill',
        icon: FaReceipt,
        tag: 'Split Engine',
        title: 'Automated Fare Splitting',
        description: 'Each rider share is calculated by route and distance so no one needs to do mental math after the ride.'
    },
    {
        key: 'wallet',
        icon: FaWallet,
        tag: 'Wallet',
        title: 'Digital Wallet Flow',
        description: 'Store ride credits, settle faster, and redeem rewards without jumping across multiple payment apps.'
    },
    {
        key: 'lock',
        icon: FaLock,
        tag: 'Safety',
        title: 'Commitment Micropayments',
        description: 'Small confirmation payments reduce no-shows and keep ride planning reliable for everyone involved.'
    },
    {
        key: 'chart',
        icon: FaChartLine,
        tag: 'Clarity',
        title: 'Transparent Transactions',
        description: 'Every payment shows a full breakdown: total fare, your share, and how much you saved vs solo travel.'
    },
    {
        key: 'coins',
        icon: FaCoins,
        tag: 'Rewards',
        title: 'Credits and Cashback',
        description: 'Frequent users and referrals unlock benefits that make regular commuting lighter on your wallet.'
    },
    {
        key: 'biz',
        icon: FaBriefcase,
        tag: 'Scale',
        title: 'Campus and Corporate Ready',
        description: 'Support pooled billing, reports, and reimbursement logic for colleges, clubs, and companies.'
    }
];

const Features = () => {
    return (
        <section id="features" className="py-20 sm:py-24 bg-bg-primary relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 -left-36 w-80 h-80 bg-accent-green/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 -right-24 w-72 h-72 bg-accent-emerald/10 rounded-full blur-3xl" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-green/25 bg-accent-green/10 mb-6"
                    >
                        <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
                        <span className="text-[11px] font-bold tracking-[0.28em] text-accent-green uppercase">Feature Stack</span>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 text-white"
                    >
                        Built for smooth group commuting.
                    </motion.h2>
                    <p className="text-text-secondary text-base sm:text-lg">
                        One cohesive platform for matching, payments, safety, and savings.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;

                        return (
                            <motion.article
                                key={feature.key}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.06 }}
                                className="group rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] backdrop-blur-xl p-5 sm:p-6 hover:border-accent-green/35 hover:shadow-[0_18px_35px_rgba(16,185,129,0.14)] transition-all"
                            >
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-green">{feature.tag}</span>
                                    <div className="w-11 h-11 rounded-xl border border-accent-green/25 bg-accent-green/12 flex items-center justify-center text-accent-green group-hover:scale-105 transition-transform">
                                        <Icon className="text-base" />
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white leading-snug">{feature.title}</h3>
                                <p className="mt-3 text-sm sm:text-[15px] text-text-secondary leading-relaxed">{feature.description}</p>
                            </motion.article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Features;
