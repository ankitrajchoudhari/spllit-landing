import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Navbar from './Navbar';

const Footer = lazy(() => import('./Footer'));

const Layout = ({ children }) => {
    const [showFooter, setShowFooter] = useState(false);
    const footerTriggerRef = useRef(null);

    useEffect(() => {
        const node = footerTriggerRef.current;
        if (!node || showFooter) return;

        if (!('IntersectionObserver' in window)) {
            setShowFooter(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setShowFooter(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '350px 0px' }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [showFooter]);

    return (
        <div className="min-h-screen bg-bg-primary text-white font-sans selection:bg-accent-green/30 selection:text-white relative">
            <Navbar />
            <main>
                {children}
            </main>
            <div ref={footerTriggerRef} aria-hidden="true" className="h-px w-full" />
            {showFooter ? (
                <Suspense fallback={<div className="h-24 w-full" aria-hidden="true" />}>
                    <Footer />
                </Suspense>
            ) : (
                <div className="h-24 w-full" aria-hidden="true" />
            )}
        </div>
    );
};

export default Layout;
