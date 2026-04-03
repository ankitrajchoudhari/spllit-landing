import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SEO = ({ title, description, keywords, image, url }) => {
    const location = useLocation();
    const siteName = 'Spllit';
    const baseUrl = 'https://spllit.app';

    const fullTitle = title ? `${title} | Spllit` : 'Spllit Official Site | Ride Sharing and Carpooling in India';
    const siteDescription = description || 'Spllit is a ride-sharing and carpooling platform for India with verified riders, route matching, and easy fare splitting.';
    const defaultKeywords = 'spllit, Spllit, spllit app, Spllit official site, ride sharing India, carpooling India, IIT Madras carpool, Chennai ride sharing';
    const siteKeywords = keywords || defaultKeywords;

    // Construct the current URL dynamically
    const currentUrl = url || `${baseUrl}${location.pathname}${location.search}`;
    const siteImage = image || `${baseUrl}/logo-full.png`;
    const pageType = location.pathname === '/' ? 'WebSite' : 'WebPage';

    const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                name: 'Spllit',
                alternateName: ['spllit', 'Spllit App'],
                url: baseUrl,
                logo: `${baseUrl}/logo-full.png`,
                sameAs: [
                    'https://www.linkedin.com/company/spllit/',
                    'https://www.instagram.com/spllit_official/'
                ]
            },
            {
                '@type': pageType,
                name: fullTitle,
                url: currentUrl,
                description: siteDescription,
                inLanguage: 'en-IN',
                isPartOf: {
                    '@type': 'WebSite',
                    name: siteName,
                    url: baseUrl
                },
                publisher: {
                    '@type': 'Organization',
                    name: siteName,
                    url: baseUrl
                }
            }
        ]
    };

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={siteDescription} />
            <meta name="keywords" content={siteKeywords} />
            <link rel="canonical" href={currentUrl} />
            
            {/* Brand-specific meta tags */}
            <meta name="application-name" content="Spllit" />
            <meta name="apple-mobile-web-app-title" content="Spllit" />
            <meta name="theme-color" content="#10B981" />
            
            {/* Enhanced Robot directives */}
            <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
            <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
            <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={siteDescription} />
            <meta property="og:image" content={siteImage} />
            <meta property="og:site_name" content="Spllit" />
            <meta property="og:locale" content="en_IN" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={currentUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={siteDescription} />
            <meta name="twitter:image" content={siteImage} />
            <meta name="twitter:site" content="@spllit_official" />
            <meta name="twitter:creator" content="@spllit_official" />
            
            {/* Additional SEO */}
            <meta name="author" content="Spllit Team" />
            <meta name="publisher" content="Spllit" />
            <meta name="copyright" content="Spllit" />
            <meta name="language" content="English" />
            <meta name="revisit-after" content="7 days" />
            <meta name="distribution" content="global" />
            <meta name="rating" content="general" />

            <script type="application/ld+json">
                {JSON.stringify(structuredData)}
            </script>
        </Helmet>
    );
};

export default SEO;

