import type { ScanReport } from '@forkpoint/agent-lighthouse-core';
import { buildReportView } from './view-model';

declare const __PACKAGE_VERSION__: string;

const REPORT_VERSION = typeof __PACKAGE_VERSION__ === 'string' ? __PACKAGE_VERSION__ : 'unknown';

/**
 * Generates a standalone, zero-dependency, self-contained HTML report
 * with interactive tabs, category accordions, copyable code snippets,
 * and circular SVG score gauges.
 */
export function generateHtmlReport(report: ScanReport): string {
  const view = buildReportView(report);

  function getGaugeColor(score: number): string {
    if (score >= 90) return '#10b981'; // emerald-500
    if (score >= 70) return '#3b82f6'; // blue-500
    if (score >= 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  }

  function renderGaugeSvg(score: number, size = 120, strokeWidth = 10): string {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getGaugeColor(score);

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="gauge-svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="#334155" stroke-opacity="0.3" stroke-width="${strokeWidth}" fill="none" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" fill="none" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition: stroke-dashoffset 0.8s ease;" />
        <text x="${size / 2}" y="${size / 2 + 8}" text-anchor="middle" font-size="${size * 0.28}px" font-weight="800" fill="${color}">${score}</text>
      </svg>
    `;
  }

  // Pre-render Category Cards
  const categoryCards = view.groups.map(group => {
    return `
      <div class="group-section mb-12" data-group="${escapeHtml(group.key)}">
        <div class="flex items-center justify-between pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(group.label)}</h3>
          </div>
          <span class="text-sm font-bold px-3 py-1 rounded-full" style="background-color: ${getGaugeColor(group.score)}15; color: ${getGaugeColor(group.score)}">
            ${group.score} / 100
          </span>
        </div>

        <div class="grid grid-cols-1 gap-6">
          ${group.categories.map(cat => `
            <div class="cat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h4 class="text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(cat.name)}</h4>
                  <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${cat.counts.pass} Passed</span>
                    <span>•</span>
                    <span class="text-amber-600 dark:text-amber-400 font-semibold">${cat.counts.warn} Warnings</span>
                    <span>•</span>
                    <span class="text-red-600 dark:text-red-400 font-semibold">${cat.counts.fail} Failed</span>
                    ${cat.counts.na > 0 ? `<span>•</span><span>${cat.counts.na} N/A</span>` : ''}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  ${renderGaugeSvg(cat.score, 68, 7)}
                </div>
              </div>

              <!-- Checks Accordion -->
              <div class="checks-container mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
                ${cat.checks.map(c => `
                  <details class="check-item py-3 group cursor-pointer" data-status="${c.status}">
                    <summary class="flex items-start justify-between gap-3 list-none select-none">
                      <div class="flex items-start gap-3">
                        <span class="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                          c.status === 'pass'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                            : c.status === 'warn'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                            : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800'
                        }">
                          ${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}
                        </span>
                        <div>
                          <div class="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                            <span>${escapeHtml(c.title)}</span>
                            <span class="text-[10px] uppercase tracking-wider font-mono text-slate-400">[${escapeHtml(c.id)}]</span>
                          </div>
                          ${c.displayValue ? `<div class="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(c.displayValue)}</div>` : ''}
                        </div>
                      </div>
                      <span class="text-xs text-slate-400 group-open:rotate-180 transition-transform mt-1">▼</span>
                    </summary>

                    <div class="mt-3 pl-8 text-xs text-slate-600 dark:text-slate-400 space-y-3 cursor-text">
                      ${c.explanation ? `<p class="leading-relaxed font-medium text-slate-700 dark:text-slate-300">${escapeHtml(c.explanation)}</p>` : ''}
                      
                      ${c.impact ? `
                        <div class="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                          <strong class="text-slate-900 dark:text-slate-200 block mb-1">Impact on AI Agents:</strong>
                          <span>${escapeHtml(c.impact)}</span>
                        </div>
                      ` : ''}

                      ${c.fix ? `
                        <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200/50 dark:border-indigo-900/30">
                          <strong class="text-indigo-900 dark:text-indigo-300 block mb-1">How to Fix:</strong>
                          <span>${escapeHtml(c.fix)}</span>
                        </div>
                      ` : ''}

                      ${c.details?.code ? `
                        <div class="mt-2">
                          <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                            <span>Recommended Code Snippet:</span>
                            <button onclick="copySnippet(this)" class="hover:text-slate-200 font-sans">Copy Code</button>
                          </div>
                          <pre class="bg-slate-950 text-slate-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800"><code>${escapeHtml(c.details.code)}</code></pre>
                        </div>
                      ` : ''}
                    </div>
                  </details>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Lighthouse Report — ${escapeHtml(report.domain)}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🗼</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              500: '#6366f1',
              600: '#4f46e5',
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'Menlo', 'monospace'],
          }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .gauge-svg text { font-family: 'Inter', sans-serif; font-weight: 800; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen py-10 px-4 sm:px-6 lg:px-8 antialiased selection:bg-indigo-500 selection:text-white">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <header class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-10">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-5">
          <div class="text-5xl">🗼</div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white">Agent Lighthouse</h1>
              <span class="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">v${escapeHtml(REPORT_VERSION)}</span>
            </div>
            <p class="text-sm text-slate-400 mt-1.5">
              Audit for <a href="${escapeHtml(report.url)}" target="_blank" rel="noopener" class="text-indigo-400 hover:underline font-mono font-medium">${escapeHtml(report.url)}</a>
            </p>
            <div class="flex items-center gap-3 text-xs text-slate-500 mt-2">
              <span>Duration: ${(view.durationMs / 1000).toFixed(1)}s</span>
              <span>•</span>
              <span>Pages: ${view.pagesScanned.length} scanned</span>
              <span>•</span>
              <span>${new Date(report.scannedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div class="flex flex-col items-center">
          ${renderGaugeSvg(view.overallScore, 120, 9)}
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">${view.scoreTier}</span>
        </div>
      </div>

      <!-- Vitals Summary Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800">
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Commerce Readiness</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.commerce}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Content Legibility</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.content}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">AI Bot Accessibility</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.botAccessibility}%</div>
        </div>
        <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div class="text-[11px] text-slate-400 font-medium">Technical Foundation</div>
          <div class="text-base font-bold text-slate-200 mt-0.5">${view.vitals.technical}%</div>
        </div>
      </div>
    </header>

    ${view.wafProtection?.isBlocked ? `
    <!-- WAF / Bot Wall Alert Banner -->
    <div class="bg-red-950/70 border-2 border-red-500/80 rounded-2xl p-5 mb-8 text-red-100 flex items-start gap-4 shadow-xl">
      <div class="text-3xl">🛡️</div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-bold text-red-200">Bot Defense Wall Detected (${escapeHtml(view.wafProtection.name)})</h3>
          <span class="text-[10px] uppercase font-bold tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/40">Access Blocked</span>
        </div>
        <p class="text-xs text-red-300/90 mt-1.5 leading-relaxed font-medium">
          <strong>Diagnosis:</strong> ${escapeHtml(view.wafProtection.reason)}.<br>
          This website is actively dropping, challenging, or blocking automated crawler requests. AI search agents (like ChatGPT, Claude, and Perplexity) cannot access or index pages on this storefront unless allowlisted in your firewall/CDN settings.
        </p>
      </div>
    </div>
    ` : ''}

    <!-- Filter Tabs -->
    <div class="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
      <button onclick="filterStatus('all')" class="filter-btn active bg-slate-800 text-white hover:bg-slate-700 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors">
        All Audits
      </button>
      <button onclick="filterStatus('fail')" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors">
        Opportunities & Failures
      </button>
      <button onclick="filterStatus('warn')" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors">
        Warnings
      </button>
      <button onclick="filterStatus('pass')" class="filter-btn bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-800 transition-colors">
        Passed Audits
      </button>
    </div>

    <!-- Category Groups -->
    <main id="audits-main">
      ${categoryCards}
    </main>

    <!-- Footer -->
    <footer class="mt-16 text-center text-xs text-slate-500 border-t border-slate-800/80 pt-6">
      <p>Generated by <a href="https://github.com/ForkPoint/agent-lighthouse" target="_blank" rel="noopener" class="font-semibold text-slate-400 hover:underline">Agent Lighthouse</a> — The Open-Source Lighthouse for the Agentic Web</p>
    </footer>
  </div>

  <script>
    function filterStatus(status) {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('bg-slate-900', 'text-slate-400');
      });
      event.target.classList.remove('bg-slate-900', 'text-slate-400');
      event.target.classList.add('bg-slate-800', 'text-white');

      document.querySelectorAll('.check-item').forEach(item => {
        if (status === 'all' || item.getAttribute('data-status') === status) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    }

    function copySnippet(btn) {
      const code = btn.closest('div').nextElementSibling.innerText;
      navigator.clipboard.writeText(code);
      btn.innerText = 'Copied! ✓';
      setTimeout(() => btn.innerText = 'Copy Code', 2000);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
