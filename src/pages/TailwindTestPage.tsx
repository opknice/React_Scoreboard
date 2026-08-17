// Tailwind CSS Test Page
// Route: /test-tailwind
// Purpose: Verify Tailwind installation without affecting existing pages

import React from 'react';
import TailwindTestCard from '../components/TailwindTestCard';

export const TailwindTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-app-bg py-8 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Tailwind CSS Integration Test
          </h1>
          <p className="text-text-muted">
            ทดสอบการทำงานของ Tailwind CSS ร่วมกับ CSS เดิม
          </p>
        </div>

        <TailwindTestCard />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Responsive Grid Test */}
          <div className="bg-card-bg p-6 rounded-card border border-border hover:border-accent transition-colors">
            <h3 className="text-lg font-semibold text-accent mb-3">Responsive Grid</h3>
            <p className="text-text-muted text-sm">
              Layout ปรับตามขนาดหน้าจอ: 1 column (mobile), 3 columns (tablet+)
            </p>
          </div>

          <div className="bg-card-bg p-6 rounded-card border border-border hover:border-success transition-colors">
            <h3 className="text-lg font-semibold text-success mb-3">Hover Effects</h3>
            <p className="text-text-muted text-sm">
              Border เปลี่ยนสีเมื่อ hover - smooth transitions
            </p>
          </div>

          <div className="bg-card-bg p-6 rounded-card border border-border hover:border-warning transition-colors">
            <h3 className="text-lg font-semibold text-warning mb-3">Custom Colors</h3>
            <p className="text-text-muted text-sm">
              ใช้สีจาก CSS variables ผ่าน Tailwind config
            </p>
          </div>
        </div>

        <div className="mt-8 bg-card-bg p-6 rounded-card border border-border">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Flexbox & Spacing Test</h2>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-full"></div>
              <span className="text-text-primary">Flex Item 1</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success rounded-full"></div>
              <span className="text-text-primary">Flex Item 2</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning rounded-full"></div>
              <span className="text-text-primary">Flex Item 3</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger rounded-full"></div>
              <span className="text-text-primary">Flex Item 4</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับไปหน้าหลัก
          </a>
        </div>
      </div>
    </div>
  );
};

export default TailwindTestPage;
