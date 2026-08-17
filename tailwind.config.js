/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map existing CSS variables to Tailwind
        'app-bg': '#0f1115',
        'card-bg': '#181b22',
        'text-primary': '#f3f4f6',
        'text-muted': '#9ca3af',
        'accent': '#3b82f6',
        'accent-hover': '#2563eb',
        'danger': '#ef4444',
        'danger-hover': '#dc2626',
        'success': '#10b981',
        'success-hover': '#059669',
        'warning': '#f59e0b',
        'warning-hover': '#d97706',
        'border': '#2a2e37',
      },
      fontFamily: {
        sans: ['Inter', 'Kanit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
  // IMPORTANT: Disable preflight to preserve existing styles
  corePlugins: {
    preflight: false,
  },
}
