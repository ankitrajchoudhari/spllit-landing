import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';

// Core Components
import Hero from './components/Hero';
import SEO from './components/SEO';

// Lazy Loaded Pages
const About = lazy(() => import('./pages/About'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const IITMadras = lazy(() => import('./pages/IITMadras'));
const Blog = lazy(() => import('./pages/Blog'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Login = lazy(() => import('./pages/Login'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SpllitSocial = lazy(() => import('./pages/SpllitSocial'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const HomeHowItWorks = lazy(() => import('./components/HowItWorks'));
const HomeFeatures = lazy(() => import('./components/Features'));
const HomeIntegrations = lazy(() => import('./components/Integrations'));
const HomeTestimonials = lazy(() => import('./components/Testimonials'));
const HomeCTA = lazy(() => import('./components/CTA'));
import { PrivacyPolicy, TermsOfService, CookiePolicy } from './pages/Legal';

// Loading Fallback
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-bg-primary">
    <div className="w-12 h-12 border-4 border-accent-green border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const DeferredSection = ({ children, rootMargin = '300px 0px' }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || shouldRender) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={sectionRef}>
      {shouldRender ? children : <div className="min-h-[40vh]" aria-hidden="true" />}
    </div>
  );
};

const Home = () => (
  <>
    <SEO
      title="Split Your Ride, Not Your Wallet"
      description="Join Spllit to save up to 60% on your daily commute. Safe, verified, and automated ride-sharing for students and professionals."
    />
    <Hero />

    <DeferredSection>
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
        <HomeHowItWorks />
      </Suspense>
    </DeferredSection>

    <DeferredSection>
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
        <HomeFeatures />
      </Suspense>
    </DeferredSection>

    <DeferredSection>
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
        <HomeIntegrations />
      </Suspense>
    </DeferredSection>

    <DeferredSection>
      <Suspense fallback={<div className="min-h-[36vh]" aria-hidden="true" />}>
        <HomeTestimonials />
      </Suspense>
    </DeferredSection>

    <DeferredSection>
      <Suspense fallback={<div className="min-h-[32vh]" aria-hidden="true" />}>
        <HomeCTA />
      </Suspense>
    </DeferredSection>
  </>
);

// Scroll to Top Helper
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

function App() {
  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Admin Routes - WITHOUT Layout */}
            <Route path="/admin/login" element={
              <>
                <SEO
                  title="Admin Login | Spllit"
                  description="Admin access to Spllit platform."
                />
                <AdminLogin />
              </>
            } />
            <Route path="/admin/dashboard" element={
              <>
                <SEO
                  title="Admin Dashboard | Spllit"
                  description="Manage Spllit platform and monitor activity."
                />
                <AdminDashboard />
              </>
            } />

            {/* Public Routes - WITH Layout */}
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={
                    <>
                      <SEO
                        title="About Our Mission"
                        description="Learn about Spllit's journey to solve India's urban mobility crisis. Committed to safe, sustainable, and affordable shared transit."
                      />
                      <About />
                    </>
                  } />
                  <Route path="/features" element={
                    <>
                      <SEO
                        title="Smart Features for Shared Rides"
                        description="Explore Spllit's features: Automated fare splitting, digital wallet, real-time matching, and corporate solutions."
                      />
                      <FeaturesPage />
                    </>
                  } />
                  <Route path="/how-it-works" element={
                    <>
                      <SEO
                        title="How Spllit Works | Seamless Ride Sharing"
                        description="Step-by-step guide to using Spllit. From finding a ride to automated UPI settlements, we've simplified your commute."
                      />
                      <HowItWorksPage />
                    </>
                  } />
                  <Route path="/iit-madras" element={<IITMadras />} />
                  <Route path="/blog" element={
                    <>
                      <SEO
                        title="Blog | Insights on Campus Mobility"
                        description="Read the latest stories about campus life, student transport hacks, and the future of shared mobility in India."
                      />
                      <Blog />
                    </>
                  } />
                  <Route path="/faq" element={
                    <>
                      <SEO
                        title="Frequently Asked Questions"
                        description="Got questions about Spllit? Find answers about safety, payments, verification, and more in our FAQ."
                      />
                      <FAQ />
                    </>
                  } />
                  <Route path="/pricing" element={
                    <>
                      <SEO
                        title="Transparent Pricing & Savings"
                        description="Save up to 60% on your daily travel. See how Spllit's automated fare splitting works for you."
                      />
                      <Pricing />
                    </>
                  } />
                  <Route path="/login" element={
                    <>
                      <SEO
                        title="Login to Spllit"
                        description="Access your Spllit account to manage your rides, wallet, and rewards."
                      />
                      <Login />
                    </>
                  } />
                  <Route path="/quiz1" element={<QuizPage />} />
                  <Route path="/dashboard" element={
                    <>
                      <SEO
                        title="Dashboard | Spllit"
                        description="Manage your rides, matches, and profile on Spllit."
                      />
                      <Dashboard />
                    </>
                  } />
                  <Route path="/spllit-social" element={
                    <>
                      <SEO
                        title="Spllit Social | Coming Soon"
                        description="Join early access for Spllit Social and get Pro updates first."
                      />
                      <SpllitSocial />
                    </>
                  } />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </Suspense>
      </Router>
    </HelmetProvider>
  );
}

export default App;
