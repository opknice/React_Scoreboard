/**
 * Tailwind CSS Card Examples
 * Reference component showing various card layouts using Tailwind
 * 
 * Usage: Import และใช้เป็น reference สำหรับการสร้าง cards ใหม่
 */

import React from 'react';

export const TailwindCardExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-text-primary mb-4">
        Card Examples with Tailwind
      </h2>

      {/* Basic Cards */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">1. Basic Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Simple Card */}
          <div className="bg-card-bg rounded-card p-6 border border-border">
            <h4 className="text-lg font-semibold text-text-primary mb-2">Simple Card</h4>
            <p className="text-text-muted text-sm">
              Basic card with border and rounded corners
            </p>
          </div>

          {/* Card with Shadow */}
          <div className="bg-card-bg rounded-card p-6 border border-border shadow-lg">
            <h4 className="text-lg font-semibold text-text-primary mb-2">Card with Shadow</h4>
            <p className="text-text-muted text-sm">
              Enhanced with shadow for depth
            </p>
          </div>

          {/* Hover Card */}
          <div className="bg-card-bg rounded-card p-6 border border-border hover:border-accent hover:shadow-xl transition-all cursor-pointer">
            <h4 className="text-lg font-semibold text-text-primary mb-2">Hover Card</h4>
            <p className="text-text-muted text-sm">
              Interactive card with hover effects
            </p>
          </div>
        </div>
      </section>

      {/* Cards with Icons */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">2. Cards with Icons</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card-bg rounded-card p-6 border border-border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-futbol text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-2">Matches</h4>
                <p className="text-text-muted text-sm">View all match results</p>
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-card p-6 border border-border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-success rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-trophy text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-2">Standings</h4>
                <p className="text-text-muted text-sm">Check league table</p>
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-card p-6 border border-border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-warning rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-users text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-2">Teams</h4>
                <p className="text-text-muted text-sm">Manage team info</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat Cards */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">3. Statistic Cards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-accent to-accent-hover rounded-card p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Total Matches</span>
              <i className="fas fa-futbol"></i>
            </div>
            <div className="text-3xl font-bold">42</div>
            <div className="text-xs opacity-75 mt-2">+5 this week</div>
          </div>

          <div className="bg-gradient-to-br from-success to-success-hover rounded-card p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Goals Scored</span>
              <i className="fas fa-bullseye"></i>
            </div>
            <div className="text-3xl font-bold">128</div>
            <div className="text-xs opacity-75 mt-2">+12 this week</div>
          </div>

          <div className="bg-gradient-to-br from-warning to-warning-hover rounded-card p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Teams</span>
              <i className="fas fa-users"></i>
            </div>
            <div className="text-3xl font-bold">16</div>
            <div className="text-xs opacity-75 mt-2">No change</div>
          </div>

          <div className="bg-gradient-to-br from-danger to-danger-hover rounded-card p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Red Cards</span>
              <i className="fas fa-rectangle-ad"></i>
            </div>
            <div className="text-3xl font-bold">7</div>
            <div className="text-xs opacity-75 mt-2">+2 this week</div>
          </div>
        </div>
      </section>

      {/* Team Card */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">4. Team Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-card-bg rounded-card border border-border overflow-hidden hover:border-accent transition-colors">
            <div className="h-24 bg-gradient-to-r from-accent to-accent-hover"></div>
            <div className="p-6 -mt-12">
              <div className="w-20 h-20 bg-white rounded-full border-4 border-card-bg mb-4 flex items-center justify-center">
                <i className="fas fa-shield-alt text-accent text-2xl"></i>
              </div>
              <h4 className="text-xl font-bold text-text-primary mb-2">Team Alpha</h4>
              <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                <span><i className="fas fa-trophy text-warning"></i> 5 Wins</span>
                <span><i className="fas fa-futbol text-success"></i> 18 Goals</span>
              </div>
              <button className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors">
                View Details
              </button>
            </div>
          </div>

          <div className="bg-card-bg rounded-card border border-border overflow-hidden hover:border-success transition-colors">
            <div className="h-24 bg-gradient-to-r from-success to-success-hover"></div>
            <div className="p-6 -mt-12">
              <div className="w-20 h-20 bg-white rounded-full border-4 border-card-bg mb-4 flex items-center justify-center">
                <i className="fas fa-star text-success text-2xl"></i>
              </div>
              <h4 className="text-xl font-bold text-text-primary mb-2">Team Beta</h4>
              <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                <span><i className="fas fa-trophy text-warning"></i> 8 Wins</span>
                <span><i className="fas fa-futbol text-success"></i> 24 Goals</span>
              </div>
              <button className="w-full px-4 py-2 bg-success hover:bg-success-hover text-white rounded-lg transition-colors">
                View Details
              </button>
            </div>
          </div>

          <div className="bg-card-bg rounded-card border border-border overflow-hidden hover:border-warning transition-colors">
            <div className="h-24 bg-gradient-to-r from-warning to-warning-hover"></div>
            <div className="p-6 -mt-12">
              <div className="w-20 h-20 bg-white rounded-full border-4 border-card-bg mb-4 flex items-center justify-center">
                <i className="fas fa-fire text-warning text-2xl"></i>
              </div>
              <h4 className="text-xl font-bold text-text-primary mb-2">Team Gamma</h4>
              <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                <span><i className="fas fa-trophy text-warning"></i> 6 Wins</span>
                <span><i className="fas fa-futbol text-success"></i> 21 Goals</span>
              </div>
              <button className="w-full px-4 py-2 bg-warning hover:bg-warning-hover text-white rounded-lg transition-colors">
                View Details
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Cards */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">5. Content Cards</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Article Card */}
          <div className="bg-card-bg rounded-card border border-border overflow-hidden hover:shadow-xl transition-shadow">
            <div className="h-48 bg-gradient-to-br from-accent/20 to-success/20 flex items-center justify-center">
              <i className="fas fa-newspaper text-accent text-6xl opacity-50"></i>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-full">News</span>
                <span className="text-xs text-text-muted">2 hours ago</span>
              </div>
              <h4 className="text-xl font-bold text-text-primary mb-3">
                Championship Finals This Weekend
              </h4>
              <p className="text-text-muted text-sm mb-4">
                The highly anticipated championship match will take place this Saturday. 
                Both teams have shown exceptional performance throughout the season.
              </p>
              <button className="flex items-center gap-2 text-accent hover:text-accent-hover transition-colors">
                Read More <i className="fas fa-arrow-right text-sm"></i>
              </button>
            </div>
          </div>

          {/* Player Card */}
          <div className="bg-card-bg rounded-card border border-border overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-hover rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  JS
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-text-primary">John Smith</h4>
                  <p className="text-text-muted text-sm">Forward • Team Alpha</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded">Top Scorer</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-text-primary">24</div>
                  <div className="text-xs text-text-muted">Goals</div>
                </div>
                <div className="text-center border-x border-border">
                  <div className="text-2xl font-bold text-text-primary">12</div>
                  <div className="text-xs text-text-muted">Assists</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text-primary">35</div>
                  <div className="text-xs text-text-muted">Matches</div>
                </div>
              </div>
              <button className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors">
                View Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Cards */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-accent">6. Interactive Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Toggle Card */}
          <div className="bg-card-bg rounded-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <i className="fas fa-bell text-warning text-xl"></i>
                <div>
                  <h4 className="text-lg font-semibold text-text-primary">Notifications</h4>
                  <p className="text-text-muted text-xs">Receive match alerts</p>
                </div>
              </div>
              <button className="w-12 h-6 bg-accent rounded-full relative transition-colors">
                <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
              </button>
            </div>
            <p className="text-text-muted text-sm">
              Get notified when your favorite teams are playing
            </p>
          </div>

          {/* Action Card */}
          <div className="bg-gradient-to-br from-accent/10 to-success/10 rounded-card border border-accent/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <i className="fas fa-plus text-white"></i>
              </div>
              <h4 className="text-lg font-semibold text-text-primary">Quick Action</h4>
            </div>
            <p className="text-text-muted text-sm mb-4">
              Create a new match, team, or tournament
            </p>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors">
                New Match
              </button>
              <button className="flex-1 px-3 py-2 bg-card-bg border border-border hover:border-accent text-text-primary text-sm rounded-lg transition-colors">
                New Team
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TailwindCardExamples;
