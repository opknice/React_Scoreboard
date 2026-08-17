# ⚡ Tailwind CSS Quick Start

## 🎯 TL;DR

✅ **Tailwind CSS พร้อมใช้งานแล้ว!**

- 🔗 Test page: http://localhost:5174/React_Scoreboard/test-tailwind
- 📦 Version: Tailwind v3.4.17
- 🎨 Custom colors: Mapped จาก CSS variables เดิม
- 🔄 Compatible: ใช้ร่วมกับ CSS เดิมได้

---

## 🚀 ใช้งานทันที

### 1. เขียน Component ใหม่
```tsx
export const MyComponent = () => {
  return (
    <div className="bg-card-bg rounded-card p-6 border border-border">
      <h2 className="text-2xl font-bold text-accent mb-4">
        Hello Tailwind!
      </h2>
      <button className="px-4 py-2 bg-success hover:bg-success-hover text-white rounded-lg transition-all">
        Click Me
      </button>
    </div>
  );
};
```

### 2. Color Cheat Sheet
```tsx
// Backgrounds
bg-app-bg        // #0f1115 (dark background)
bg-card-bg       // #181b22 (card background)

// Text
text-text-primary   // #f3f4f6 (white text)
text-text-muted     // #9ca3af (gray text)

// Status Colors
bg-accent        // #3b82f6 (blue)
bg-success       // #10b981 (green)
bg-warning       // #f59e0b (orange)
bg-danger        // #ef4444 (red)

// Border
border-border    // #2a2e37 (gray border)
rounded-card     // 12px radius
```

### 3. Common Utilities
```tsx
// Layout
flex items-center justify-between gap-4
grid grid-cols-2 md:grid-cols-4 gap-6

// Spacing
p-4     // padding: 1rem
m-auto  // margin: auto
gap-3   // gap: 0.75rem

// Sizing
w-full  // width: 100%
h-screen // height: 100vh
max-w-md // max-width: 28rem

// Responsive
hidden md:block          // แสดงบน tablet+
text-sm md:text-base     // ขนาด text ปรับตามหน้าจอ
```

---

## 📱 Responsive Breakpoints
```tsx
// Mobile First (default = mobile)
sm:   // 640px+  (tablet)
md:   // 768px+  (desktop)
lg:   // 1024px+ (large desktop)
xl:   // 1280px+ (extra large)

// Example
<div className="
  w-full          // mobile: 100% width
  md:w-1/2        // desktop: 50% width
  lg:w-1/3        // large: 33.33% width
">
  Responsive Box
</div>
```

---

## 💡 Pro Tips

### 1. ใช้ร่วมกับ CSS เดิม
```tsx
<div className="card flex items-center gap-3">
  {/* 'card' จาก CSS เดิม + Tailwind utilities */}
</div>
```

### 2. Hover & Focus States
```tsx
<button className="
  bg-accent 
  hover:bg-accent-hover 
  focus:ring-2 
  focus:ring-accent
  transition-all
">
  Hover Me
</button>
```

### 3. Dark Mode (ถ้าใช้)
```tsx
<div className="bg-white dark:bg-card-bg">
  Auto dark mode
</div>
```

### 4. Custom Values (เมื่อ preset ไม่พอ)
```tsx
<div className="w-[250px] h-[35px] bg-[#123456]">
  Custom values with []
</div>
```

---

## 🔧 VS Code Setup

### Extension แนะนำ
1. **Tailwind CSS IntelliSense** (must-have!)
   - Autocomplete class names
   - Preview colors
   - Linting

### Settings
```json
{
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*[\"']([^\"']*)[\"']", "([a-zA-Z0-9-:]+)"]
  ]
}
```

---

## 🐛 Troubleshooting

### คลาสไม่ทำงาน
1. ✅ เช็คว่า import `./index.css` ใน `main.tsx`
2. ✅ Restart dev server: `npm run dev`
3. ✅ Clear cache: ลบ `node_modules/.vite`

### Autocomplete ไม่ขึ้น
1. ติดตั้ง "Tailwind CSS IntelliSense" extension
2. Reload VS Code window

### Build ช้า
- Tailwind purge ทำงานตอน production build (ปกติ)
- Dev mode = fast (ไม่ purge)

---

## 📖 เรียนรู้เพิ่มเติม

- [Full Migration Guide](./TAILWIND_MIGRATION_GUIDE.md)
- [Tailwind Docs](https://tailwindcss.com/docs)
- Test Page: `/test-tailwind`

---

**Happy Tailwinding! 🎨✨**
