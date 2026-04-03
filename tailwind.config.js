/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-primary': '#0a0f0a',
                'bg-secondary': '#0d130d',
                'bg-card': '#111811',
                'accent-green': '#10b981',
                'accent-emerald': '#34d399',
                'accent-lime': '#84cc16',
                'text-primary': '#ffffff',
                'text-secondary': '#9ca3af',
                'text-muted': '#6b7280',
            },
            fontFamily: {
                sans: ['Space Grotesk', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
