/**
 * Tailwind CSS Button Examples
 * Reference component showing various button styles using Tailwind
 * 
 * Usage: Import และใช้เป็น reference สำหรับการสร้าง buttons ใหม่
 */

import React from 'react';

export const TailwindButtonExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-text-primary mb-4">
        Button Examples with Tailwind
      </h2>

      {/* Primary Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">1. Primary Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors">
            Default Primary
          </button>
          <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-all hover:scale-105">
            With Scale
          </button>
          <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-all hover:shadow-lg">
            With Shadow
          </button>
          <button className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all">
            Large Button
          </button>
        </div>
      </section>

      {/* Status Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">2. Status Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-success hover:bg-success-hover text-white font-medium rounded-lg transition-colors">
            Success
          </button>
          <button className="px-4 py-2 bg-warning hover:bg-warning-hover text-white font-medium rounded-lg transition-colors">
            Warning
          </button>
          <button className="px-4 py-2 bg-danger hover:bg-danger-hover text-white font-medium rounded-lg transition-colors">
            Danger
          </button>
        </div>
      </section>

      {/* Outline Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">3. Outline Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 border-2 border-accent text-accent hover:bg-accent hover:text-white font-medium rounded-lg transition-colors">
            Primary Outline
          </button>
          <button className="px-4 py-2 border-2 border-success text-success hover:bg-success hover:text-white font-medium rounded-lg transition-colors">
            Success Outline
          </button>
          <button className="px-4 py-2 border-2 border-danger text-danger hover:bg-danger hover:text-white font-medium rounded-lg transition-colors">
            Danger Outline
          </button>
        </div>
      </section>

      {/* Icon Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">4. Icon Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors">
            <i className="fas fa-plus"></i>
            Add Item
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-white font-medium rounded-lg transition-colors">
            <i className="fas fa-check"></i>
            Confirm
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-danger hover:bg-danger-hover text-white font-medium rounded-lg transition-colors">
            <i className="fas fa-trash"></i>
            Delete
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-card-bg border border-border hover:border-accent text-text-primary font-medium rounded-lg transition-colors">
            <i className="fas fa-download"></i>
            Download
          </button>
        </div>
      </section>

      {/* Icon Only Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">5. Icon Only Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="w-10 h-10 flex items-center justify-center bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors">
            <i className="fas fa-plus"></i>
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-success hover:bg-success-hover text-white rounded-lg transition-colors">
            <i className="fas fa-check"></i>
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-danger hover:bg-danger-hover text-white rounded-lg transition-colors">
            <i className="fas fa-trash"></i>
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-card-bg border border-border hover:border-accent text-text-primary rounded-lg transition-colors">
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </section>

      {/* Button Sizes */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">6. Button Sizes</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-2 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded transition-colors">
            Extra Small
          </button>
          <button className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            Small
          </button>
          <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-base font-medium rounded-lg transition-colors">
            Medium (Default)
          </button>
          <button className="px-6 py-3 bg-accent hover:bg-accent-hover text-white text-lg font-medium rounded-lg transition-colors">
            Large
          </button>
          <button className="px-8 py-4 bg-accent hover:bg-accent-hover text-white text-xl font-medium rounded-xl transition-colors">
            Extra Large
          </button>
        </div>
      </section>

      {/* Disabled States */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">7. Disabled States</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            disabled 
            className="px-4 py-2 bg-accent text-white font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            Disabled Primary
          </button>
          <button 
            disabled 
            className="px-4 py-2 bg-success text-white font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            Disabled Success
          </button>
          <button 
            disabled 
            className="px-4 py-2 border-2 border-accent text-accent font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            Disabled Outline
          </button>
        </div>
      </section>

      {/* Loading States */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">8. Loading States</h3>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors">
            <i className="fas fa-spinner fa-spin"></i>
            Loading...
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-success text-white font-medium rounded-lg opacity-75 cursor-wait">
            <i className="fas fa-circle-notch fa-spin"></i>
            Processing
          </button>
        </div>
      </section>

      {/* Button Groups */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">9. Button Groups</h3>
        <div className="inline-flex rounded-lg overflow-hidden border border-border">
          <button className="px-4 py-2 bg-card-bg hover:bg-accent hover:text-white text-text-primary transition-colors">
            Left
          </button>
          <button className="px-4 py-2 bg-card-bg hover:bg-accent hover:text-white text-text-primary border-x border-border transition-colors">
            Center
          </button>
          <button className="px-4 py-2 bg-card-bg hover:bg-accent hover:text-white text-text-primary transition-colors">
            Right
          </button>
        </div>
      </section>

      {/* Gradient Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">10. Gradient Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-6 py-3 bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent text-white font-semibold rounded-lg transition-all">
            Blue Gradient
          </button>
          <button className="px-6 py-3 bg-gradient-to-r from-success to-accent hover:from-accent hover:to-success text-white font-semibold rounded-lg transition-all">
            Green to Blue
          </button>
          <button className="px-6 py-3 bg-gradient-to-r from-warning to-danger hover:from-danger hover:to-warning text-white font-semibold rounded-lg transition-all">
            Warm Gradient
          </button>
        </div>
      </section>
    </div>
  );
};

export default TailwindButtonExamples;
