import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { FaUniversity, FaUsers, FaMoneyBillWave, FaShieldAlt, FaMapMarkedAlt, FaClock } from 'react-icons/fa';

const IITMadras = () => {
    return (
        <>
            <SEO
                title="Spllit - IIT Madras Ride Sharing & Carpooling App | Save 60% on Chennai Commute"
                description="Official carpooling platform for IIT Madras students & staff. Share rides between campus and Chennai city, airport, GER. Safe, verified co-riders. Real-time matching. Automated UPI fare splitting. Join 1000+ IITM students saving daily!"
                keywords="Spllit IIT Madras, IITM carpool, IIT Madras ride sharing, Chennai to IIT Madras, IIT Madras to airport, IIT Madras student transport, IITM GER carpool, IIT Madras Chennai carpool, IITM campus ride share, IIT Madras commute app, student carpool IIT, IITM to Velachery, IIT Madras Adyar ride, IITM daily commute, IIT Madras shared cab"
            />

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-bg-primary via-bg-secondary to-accent-green/10 pt-24 pb-16 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="mb-6">
                        <span className="inline-block px-4 py-2 bg-accent-green/20 text-accent-green rounded-full text-sm font-semibold mb-4">
                            🎓 Official IIT Madras Carpooling Platform
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-text-primary mb-6">
                        <span className="text-accent-green">Spllit</span> for IIT Madras
                    </h1>
                    <p className="text-xl md:text-2xl text-text-secondary mb-8 max-w-3xl mx-auto">
                        The #1 Ride-Sharing App for IIT Madras Students, Faculty & Staff
                    </p>
                    <p className="text-lg text-text-secondary mb-8">
                        Daily commute? Airport trips? Late-night returns? <br />
                        <strong className="text-accent-green">1000+ IITM students already saving 60% on rides</strong>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link 
                            to="/login" 
                            className="px-8 py-4 bg-accent-green text-bg-primary rounded-lg font-semibold hover:bg-accent-green/90 transition-all transform hover:scale-105"
                        >
                            Join Spllit - It's Free
                        </Link>
                        <Link 
                            to="/how-it-works" 
                            className="px-8 py-4 bg-bg-secondary/50 backdrop-blur-sm text-text-primary rounded-lg font-semibold hover:bg-bg-secondary transition-all border border-accent-green/20"
                        >
                            See How It Works
                        </Link>
                    </div>
                </div>
            </section>

            {/* Popular Routes */}
            <section className="py-16 px-6 bg-bg-secondary">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-12">
                        Popular <span className="text-accent-green">IIT Madras Routes</span>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { from: 'IIT Madras', to: 'Chennai Airport', time: '40 min', cost: '₹150', saved: '₹350' },
                            { from: 'Adyar', to: 'IIT Madras', time: '15 min', cost: '₹50', saved: '₹100' },
                            { from: 'IIT Madras', to: 'Velachery', time: '20 min', cost: '₹60', saved: '₹140' },
                            { from: 'T Nagar', to: 'IIT Madras', time: '25 min', cost: '₹80', saved: '₹170' },
                            { from: 'IIT Madras GER', to: 'Campus', time: '10 min', cost: '₹40', saved: '₹60' },
                            { from: 'Guindy', to: 'IIT Madras', time: '12 min', cost: '₹45', saved: '₹85' },
                        ].map((route, idx) => (
                            <div key={idx} className="bg-bg-primary/50 backdrop-blur-sm border border-accent-green/20 rounded-xl p-6 hover:border-accent-green/50 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <FaMapMarkedAlt className="text-accent-green text-2xl mb-2" />
                                        <h3 className="font-bold text-text-primary mb-1">{route.from}</h3>
                                        <p className="text-sm text-text-secondary">→ {route.to}</p>
                                    </div>
                                    <FaClock className="text-text-secondary" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Time:</span>
                                        <span className="text-text-primary font-semibold">{route.time}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Your Cost:</span>
                                        <span className="text-accent-green font-bold">{route.cost}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">You Save:</span>
                                        <span className="text-green-400 font-bold">{route.saved} 💰</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why IIT Madras Students Love Spllit */}
            <section className="py-16 px-6 bg-bg-primary">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-12">
                        Why <span className="text-accent-green">IIT Madras Students</span> Choose Spllit
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUniversity className="text-accent-green text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Made for IITM Campus</h3>
                            <p className="text-text-secondary">
                                Understand campus gates, hostels, departments, GER. Pre-set common meeting points.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUsers className="text-accent-green text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Verified IITM Community</h3>
                            <p className="text-text-secondary">
                                Only verified IIT Madras students, faculty, and staff. Safe co-riders you can trust.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaMoneyBillWave className="text-accent-green text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Auto UPI Splitting</h3>
                            <p className="text-text-secondary">
                                No awkward cash exchanges. Automated fare splitting via UPI. ₹0 platform fees.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaShieldAlt className="text-accent-green text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Safety First</h3>
                            <p className="text-text-secondary">
                                Live location sharing, emergency contacts, trip history. Your parents will approve!
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaClock className="text-accent-green text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Real-Time Matching</h3>
                            <p className="text-text-secondary">
                                Find rides in seconds. Going to library? Airport? Late-night mess run? We got you.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-accent-green text-3xl">🌱</span>
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3">Eco-Friendly Campus</h3>
                            <p className="text-text-secondary">
                                Reduce carbon footprint. Track CO₂ saved. Make IITM greener, one ride at a time.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Student Testimonials */}
            <section className="py-16 px-6 bg-bg-secondary">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-12">
                        What <span className="text-accent-green">IIT Madras Students</span> Say
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                name: 'Rahul M.',
                                role: 'BTech CS, 3rd Year',
                                text: 'Use Spllit daily from GER to main campus. Saved ₹3000+ last month. More money for chai at Tea Board! 🍵',
                                rating: 5
                            },
                            {
                                name: 'Priya S.',
                                role: 'MTech EE, 1st Year',
                                text: 'Airport trips are so much cheaper now. Found a ride within 5 minutes during Diwali rush. Absolute lifesaver! 🙏',
                                rating: 5
                            },
                            {
                                name: 'Ankit V.',
                                role: 'PhD Aerospace, 2nd Year',
                                text: 'Late-night lab work? No problem. Found co-riders going to Adyar even at 11 PM. Safe and affordable. 🚗',
                                rating: 5
                            }
                        ].map((testimonial, idx) => (
                            <div key={idx} className="bg-bg-primary/50 backdrop-blur-sm border border-accent-green/20 rounded-xl p-6">
                                <div className="flex mb-4">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <span key={i} className="text-accent-green">★</span>
                                    ))}
                                </div>
                                <p className="text-text-secondary mb-4 italic">"{testimonial.text}"</p>
                                <div>
                                    <p className="font-bold text-text-primary">{testimonial.name}</p>
                                    <p className="text-sm text-text-secondary">{testimonial.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works for IITM */}
            <section className="py-16 px-6 bg-bg-primary">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-12">
                        Get Started in <span className="text-accent-green">3 Simple Steps</span>
                    </h2>
                    <div className="space-y-8">
                        {[
                            {
                                step: '1',
                                title: 'Sign Up with IITM Email',
                                desc: 'Register using your @smail.iitm.ac.in or @iitm.ac.in email. Instant verification for campus community.'
                            },
                            {
                                step: '2',
                                title: 'Find or Offer a Ride',
                                desc: 'Enter your route (e.g., "Taramani Gate to Velachery"). Get matched with co-riders in real-time.'
                            },
                            {
                                step: '3',
                                title: 'Share, Split, Save',
                                desc: 'Meet at the pickup point. Share the ride. Fare automatically splits via UPI. Done! 🎉'
                            }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-6 items-start">
                                <div className="w-12 h-12 bg-accent-green rounded-full flex items-center justify-center text-bg-primary font-bold text-xl flex-shrink-0">
                                    {item.step}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-text-primary mb-2">{item.title}</h3>
                                    <p className="text-text-secondary">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 px-6 bg-bg-secondary">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-accent-green mb-2">1000+</div>
                            <div className="text-text-secondary">IITM Students</div>
                        </div>
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-accent-green mb-2">50K+</div>
                            <div className="text-text-secondary">Rides Shared</div>
                        </div>
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-accent-green mb-2">₹20L+</div>
                            <div className="text-text-secondary">Money Saved</div>
                        </div>
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-accent-green mb-2">5 Tons</div>
                            <div className="text-text-secondary">CO₂ Reduced</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 px-6 bg-bg-primary">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-12">
                        <span className="text-accent-green">FAQs</span> for IIT Madras Students
                    </h2>
                    <div className="space-y-6">
                        {[
                            {
                                q: 'Is Spllit only for IIT Madras students?',
                                a: 'While Spllit is open to everyone, we have a verified IIT Madras community filter. You can choose to ride only with IITM students, faculty, and staff.'
                            },
                            {
                                q: 'How do I verify my IITM email?',
                                a: 'Simply sign up using your @smail.iitm.ac.in or @iitm.ac.in email. We\'ll send a verification link. Once verified, you get the IITM badge on your profile.'
                            },
                            {
                                q: 'What if I\'m going to the airport at odd hours?',
                                a: 'Spllit works 24/7! Many IITM students travel to the airport for internships and home visits. Post your trip in advance and get matched.'
                            },
                            {
                                q: 'Is it safe for female students?',
                                a: 'Absolutely! Spllit has robust safety features: verified profiles, live location sharing, emergency SOS, and women-only ride options. 40% of our IITM users are female students.'
                            },
                            {
                                q: 'How much can I really save?',
                                a: 'On average, IITM students save ₹2500-4000 per month on commute costs. Airport trips alone save ₹400-600 per ride.'
                            }
                        ].map((faq, idx) => (
                            <div key={idx} className="bg-bg-secondary/50 backdrop-blur-sm border border-accent-green/20 rounded-xl p-6">
                                <h3 className="font-bold text-text-primary mb-3 text-lg">{faq.q}</h3>
                                <p className="text-text-secondary">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6 bg-gradient-to-br from-accent-green/20 via-bg-secondary to-bg-primary">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-bold text-text-primary mb-6">
                        Ready to Save on Your <span className="text-accent-green">IIT Madras Commute?</span>
                    </h2>
                    <p className="text-xl text-text-secondary mb-8">
                        Join 1000+ IITM students already carpooling with Spllit
                    </p>
                    <Link 
                        to="/login" 
                        className="inline-block px-10 py-5 bg-accent-green text-bg-primary rounded-lg font-bold text-lg hover:bg-accent-green/90 transition-all transform hover:scale-105"
                    >
                        Start Saving Today - Free Forever 🚀
                    </Link>
                    <p className="text-sm text-text-secondary mt-6">
                        No credit card required • ₹0 platform fees • Cancel anytime
                    </p>
                </div>
            </section>

            {/* SEO Footer Content (hidden but crawlable) */}
            <div className="sr-only">
                <h2>Spllit IIT Madras - Complete Carpooling Solution</h2>
                <p>
                    Spllit is the leading ride-sharing and carpooling platform for IIT Madras students, faculty, and staff. 
                    Whether you're commuting from GER to main campus, heading to Chennai airport, or traveling from Adyar, Velachery, 
                    Guindy, or T Nagar to IIT Madras, Spllit connects you with verified co-riders traveling the same route.
                </p>
                <h3>Why Choose Spllit for IIT Madras Carpooling?</h3>
                <ul>
                    <li>Verified IIT Madras student community</li>
                    <li>Automated UPI fare splitting - no cash hassles</li>
                    <li>Real-time ride matching for instant connections</li>
                    <li>Save 50-60% on daily commute costs</li>
                    <li>Live location tracking and safety features</li>
                    <li>Reduces carbon footprint - eco-friendly campus initiative</li>
                    <li>24/7 availability for airport trips and late-night returns</li>
                </ul>
                <h3>Popular IIT Madras Carpool Routes on Spllit</h3>
                <p>
                    IIT Madras to Chennai Airport, Adyar to IIT Madras, IIT Madras to Velachery, T Nagar to IIT Madras, 
                    IIT Madras GER to Main Campus, Guindy to IIT Madras, Saidapet to IIT Madras, Taramani to IIT Madras,
                    IIT Madras to Egmore Railway Station, IIT Madras to Chennai Central Station, IIT Madras to OMR Tech Park
                </p>
            </div>
        </>
    );
};

export default IITMadras;
