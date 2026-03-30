/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                'deep-space': '#0F0F1A',
                'midnight': '#1A1A2E',
                'glass': 'rgba(255,255,255,0.03)',
                'glass-border': 'rgba(255,255,255,0.08)',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) scale(1)', opacity: '0.3' },
                    '50%': { transform: 'translateY(-20px) scale(1.2)', opacity: '0.6' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' },
                    '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' },
                },
            },
            animation: {
                float: 'float 6s ease-in-out infinite',
                shimmer: 'shimmer 3s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
