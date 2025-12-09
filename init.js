// init.js - moved from inline <script type="module"> in index.html
// import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://nkkwdcsoijwcbgqrublg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ra3dkY3NvaWp3Y2JncXJ1YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTg2MDgsImV4cCI6MjA3OTA3NDYwOH0.z3P1a_zOvjm1EGAggj6JS5u0Eo091mUcZ0wXyfEge-w";

// Initialize Supabase client and expose globally for other modules
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;

// Store last analytics settings
let lastAnalyticsSettings = {
  room: 'all',
  metric: 'room_temp_rh',
  period: '24h'
};

// Save analytics settings on change
window.saveAnalyticsSettings = function() {
  lastAnalyticsSettings = {
    room: document.getElementById('chart-room').value,
    metric: document.getElementById('chart-metric').value,
    period: document.getElementById('chart-period').value
  };
}

// Restore analytics settings to selects
window.restoreAnalyticsSettings = function() {
  const roomEl = document.getElementById('chart-room');
  const metricEl = document.getElementById('chart-metric');
  const periodEl = document.getElementById('chart-period');
  if (roomEl) roomEl.value = lastAnalyticsSettings.room;
  if (metricEl) metricEl.value = lastAnalyticsSettings.metric;
  if (periodEl) periodEl.value = lastAnalyticsSettings.period;
}

window.showTab = function(tabName) {
  // Hide all tab contents and clear active buttons
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

  // Show requested tab content
  const tab = document.getElementById(tabName + '-tab');
  if (tab) tab.classList.add('active');

  // Mark the corresponding button active using data-tab
  const btn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Persist last selected tab across reloads
  try { localStorage.setItem('iotview_last_tab', tabName); } catch (e) {}

  // If switching to analytics, restore last settings and update chart
  if (tabName === 'analytics') {
    window.restoreAnalyticsSettings();
    if (window.updateChart) window.updateChart();
  }
  // If switching to schedule, fetch schedules (to be implemented)
  if (tabName === 'schedule' && window.fetchSchedules) {
    window.fetchSchedules();
  }
};

// Restore last selected tab on page load (default to 'overview')
(function(){
  try {
    const last = localStorage.getItem('iotview_last_tab') || 'overview';
    // Delay slightly to ensure DOM is ready (buttons exist)
    setTimeout(() => {
      if (document.getElementById(last + '-tab')) {
        window.showTab(last);
      } else {
        window.showTab('overview');
      }
    }, 0);
  } catch (e) {
    // fallback
    window.showTab('overview');
  }
})();

// Import main app logic after initializing supabase and exposing globals.
// Use dynamic imports so the client is created and assigned to window.supabase
// before the other modules execute (they may reference window.supabase at load-time).
(async () => {
  try {
    await import('./app.js');
    await import('./schedule.js');
    await import('./sensors.js');
  } catch (e) {
    // If dynamic import fails, log so it's easier to debug in the browser console
    // (this shouldn't happen in normal operation).
    console.error('Failed to dynamically import app modules:', e);
  }
})();
