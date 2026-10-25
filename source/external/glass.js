(()=>{
'use strict';

const KERNEL_KEY=Symbol.for('studyDirector.presentationKernel.v1');
const STYLE_ID='sd-glass-presentation-v1';
const PROFILE=Object.freeze({
  contractVersion:2,
  id:'glass',
  label:'Glass',
  typography:'glass',
  shape:'glass',
  material:'glass',
  depth:'glass',
  density:'standard',
  responsive:'adaptive',
  motion:'precise',
  charts:'analytical'
});

const CSS=`
/* GLASS PRESENTATION PACK
   Presentation-only skin. Semantic theme colours and app logic remain under
   the host contract; Glass owns its material, hierarchy and calm finish. */
html[data-typography="glass"]{
  --sd-font-mono:"Share Tech Mono",monospace;
  --sd-font-condensed:"Barlow",sans-serif;
  --sd-font-body:"Barlow",sans-serif;
  --sd-font-display:"Barlow",sans-serif;
  --sd-font-weight-regular:400;
  --sd-font-weight-medium:500;
  --sd-font-weight-semibold:600;
  --sd-font-weight-bold:700;
  --sd-font-weight-extrabold:700;
  --sd-font-weight-black:700;
  --sd-type-role-overline-size:.625rem;
  --sd-type-role-label-size:.6875rem;
  --sd-type-role-caption-size:.71875rem;
  --sd-type-role-copy-compact-size:.75rem;
  --sd-type-role-copy-size:.8125rem;
  --sd-type-role-body-size:.875rem;
  --sd-type-role-control-size:.875rem;
  --sd-type-role-input-size:.9375rem;
  --sd-type-role-reading-size:1rem;
  --sd-type-role-metric-size:1.125rem;
  --sd-type-role-section-size:1.375rem;
  --sd-type-role-title-size:1.875rem;
  --sd-type-role-display-size:2.125rem;
  --sd-type-role-hero-size:2.75rem;
  --sd-type-role-countdown-size:6.25rem;
  --sd-type-role-chart-label-size:.8rem;
  --sd-type-role-chart-axis-size:.85rem;
  --sd-type-role-execute-secret-size:clamp(1.125rem,1.5vw,1.375rem);
  --sd-type-role-execute-title-size:clamp(1.5rem,2.4vw,2rem);
  --sd-type-role-timer-countdown-size:clamp(4.25rem,8.5vw,6.25rem);
  --sd-type-role-pacer-clock-size:clamp(1.75rem,3vw,2.3125rem);
  --sd-type-role-mobile-countdown-size:clamp(3.25rem,15vw,4.625rem);
  --sd-type-role-landscape-countdown-size:clamp(3.25rem,9vw,4.875rem);
  --sd-type-transform-label:none;
  --sd-type-transform-control:none;
  --sd-type-transform-title:none;
  --sd-type-label-family:var(--sd-font-body);
  --sd-type-label-size:var(--sd-text-label);
  --sd-type-label-weight:var(--sd-font-weight-semibold);
  --sd-type-label-tracking:.015em;
  --sd-type-label-transform:var(--sd-type-transform-label);
  --sd-type-body-family:var(--sd-font-body);
  --sd-type-body-size:var(--sd-text-body);
  --sd-type-body-weight:var(--sd-font-weight-regular);
  --sd-type-body-leading:var(--sd-leading-roomy);
  --sd-type-body-tracking:0;
  --sd-type-mono-family:var(--sd-font-mono);
  --sd-type-mono-size:var(--sd-text-small);
  --sd-type-mono-leading:var(--sd-leading-normal);
  --sd-type-mono-tracking:.02em;
  --sd-type-control-family:var(--sd-font-body);
  --sd-type-control-weight:var(--sd-font-weight-semibold);
  --sd-type-control-leading:1.2;
  --sd-type-control-transform:var(--sd-type-transform-control);
  --sd-type-control-tracking:.01em;
  --sd-type-title-family:var(--sd-font-display);
  --sd-type-title-size:var(--sd-text-title);
  --sd-type-title-weight:var(--sd-font-weight-semibold);
  --sd-type-title-tracking:-.025em;
  --sd-type-title-transform:var(--sd-type-transform-title);
}

html[data-shape="glass"]{
  --sd-shape-field-radius:10px;
  --sd-shape-editor-radius:8px;
  --sd-shape-disclosure-radius:20px;
  --sd-shape-chip-radius:999px;
  --sd-shape-progress-radius:999px;
  --sd-shape-round:50%;
  --sd-shape-inspector-radius:10px;
  --sd-shape-inset-radius:12px;
  --sd-shape-canvas-radius:8px;
  --sd-shape-card-clip:var(--sd-value-none);
  --sd-shape-panel-clip:var(--sd-value-none);
  --sd-shape-control-clip:var(--sd-value-none);
  --sd-shape-modal-panel-clip:var(--sd-value-none);
  --sd-shape-nameplate-clip:var(--sd-value-none);
  --sd-shape-countdown-clip:var(--sd-value-none);
  --sd-shape-floating-clip:var(--sd-value-none);
  --sd-shape-state-overlay-clip:var(--sd-value-none);
  --sd-shape-review-collapse-clip:var(--sd-value-none);
  --sd-shape-compact-panel-clip:var(--sd-value-none);
  --sd-shape-static-row-clip:var(--sd-value-none);
  --sd-shape-open-card-clip:var(--sd-value-none);
  --sd-shape-card-radius:16px;
  --sd-shape-panel-radius:22px;
  --sd-shape-control-radius:11px;
  --sd-shape-nameplate-radius:20px;
  --sd-shape-countdown-radius:22px;
  --sd-shape-floating-radius:20px;
  --sd-shape-state-overlay-radius:20px;
}

html[data-material="glass"]{
  --sd-glass-surface-alpha:.54;
  --sd-glass-surface-soft-alpha:.34;
  --sd-glass-panel-alpha:.48;
  --sd-glass-field-alpha:.52;
  --sd-glass-floating-alpha:.78;
  --sd-glass-navigation-alpha:.58;
  --sd-glass-readable-alpha:.78;
  --sd-glass-sticky-alpha:.86;
  --sd-glass-filter:blur(20px) saturate(1.28);
  --sd-glass-filter-soft:blur(14px) saturate(1.18);
  --sd-glass-filter-strong:blur(28px) saturate(1.36);
  --sd-glass-specular:rgba(var(--sd-rgb-on-strong),.10);
  --sd-glass-specular-soft:rgba(var(--sd-rgb-on-strong),.055);
  --sd-glass-edge:rgba(var(--sd-rgb-on-strong),.12);
  --sd-glass-control-edge:var(--sd-glass-edge);

  --sd-material-document:
    radial-gradient(circle at 11% -7%,rgba(var(--sd-rgb-accent-primary),.075),transparent 31rem),
    radial-gradient(circle at 96% 4%,rgba(var(--sd-rgb-info),.075),transparent 34rem),
    radial-gradient(circle at 62% 106%,rgba(var(--sd-rgb-accent-secondary),.055),transparent 32rem),
    var(--sd-color-canvas);
  --sd-material-surface-primary:rgba(var(--sd-rgb-surface-1),var(--sd-glass-surface-alpha));
  --sd-material-card:
    linear-gradient(145deg,var(--sd-glass-specular),transparent 38%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-surface-alpha));
  --sd-material-card-soft:
    linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-surface-soft-alpha));
  --sd-material-inset:
    linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 52%),
    rgba(var(--sd-rgb-surface-1),.30);
  --sd-material-canvas:rgba(var(--sd-rgb-surface-1),.78);
  --sd-countdown-paused-content-opacity:.68;
  --sd-material-content-faint:rgba(var(--sd-rgb-surface-1),.16);
  --sd-material-content-subtle:rgba(var(--sd-rgb-surface-1),.24);
  --sd-material-content-raised:rgba(var(--sd-rgb-surface-1),.32);
  --sd-material-surface:
    linear-gradient(145deg,var(--sd-glass-specular),transparent 40%),
    linear-gradient(320deg,rgba(var(--sd-rgb-info),.018),transparent 54%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-panel-alpha));
  --sd-material-panel:
    linear-gradient(145deg,var(--sd-glass-specular),transparent 38%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-panel-alpha));
  --sd-material-accent-workbench:
    linear-gradient(145deg,var(--sd-glass-specular),transparent 36%),
    rgba(var(--sd-rgb-surface-1),.54);
  --sd-material-disclosure:
    linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),
    rgba(var(--sd-rgb-surface-1),calc(var(--sd-glass-panel-alpha) + .04));
  --sd-material-control:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.055),transparent 54%),
    rgba(var(--sd-rgb-surface-1),.26);
  --sd-material-field:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.045),transparent 50%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-field-alpha));
  --sd-material-navigation:
    linear-gradient(180deg,rgba(var(--sd-rgb-accent-secondary),.095),transparent 180px),
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.065),transparent 46%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-navigation-alpha));
  --sd-material-navigation-filter:var(--sd-glass-filter-strong);
  --sd-material-shell-header:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.10),transparent 37%),
    linear-gradient(135deg,rgba(var(--sd-rgb-accent-secondary),.40),rgba(var(--sd-rgb-shell-brand-deep),.34) 58%,rgba(var(--sd-rgb-shell-deep),.56));
  --sd-material-floating:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.12),transparent 38%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-floating-alpha));
  --sd-material-nudge:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.12),transparent 38%),
    rgba(var(--sd-rgb-surface-1),var(--sd-glass-floating-alpha));
  --sd-material-nudge-filter:var(--sd-glass-filter-strong);
  --sd-material-modal-backdrop:rgba(var(--sd-rgb-canvas),.58);
  --sd-material-modal-filter:blur(14px) saturate(1.08);
  --sd-material-setup-backdrop:rgba(var(--sd-rgb-canvas),.54);
  --sd-material-setup-filter:blur(16px) saturate(1.10);
  --sd-material-state-overlay:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.09),transparent 38%),
    rgba(var(--sd-rgb-surface-1),.66);
  --sd-material-state-overlay-filter:var(--sd-glass-filter);
  --sd-material-chart-surface:rgba(var(--sd-rgb-surface-1),.13);
  --sd-material-chart-tooltip:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.08),transparent 50%),
    rgba(var(--sd-rgb-surface-1),.82);
  --sd-material-chart-inspect-box:rgba(var(--sd-rgb-surface-1),.78);
  --sd-material-countdown:
    radial-gradient(circle at 18% 18%,rgba(var(--sd-rgb-execute-lime),.045),transparent 36%),
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.075),transparent 40%),
    linear-gradient(135deg,rgba(var(--sd-rgb-execute-lime),.014),rgba(var(--sd-rgb-execute-blue),.006)),
    rgba(var(--sd-rgb-surface-1),.57);
  --sd-material-countdown-paused:
    radial-gradient(circle at 18% 18%,rgba(var(--sd-rgb-execute-amber),.050),transparent 38%),
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.070),transparent 40%),
    linear-gradient(135deg,rgba(var(--sd-rgb-execute-amber),.018),rgba(var(--sd-rgb-execute-danger),.008)),
    rgba(var(--sd-rgb-surface-1),.59);
  --sd-material-execute-command-rail:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.075),transparent 42%),
    linear-gradient(135deg,rgba(var(--sd-rgb-execute-lime),.035),rgba(var(--sd-rgb-execute-blue),.012)),
    rgba(var(--sd-rgb-surface-1),.46);
  --sd-material-review-section:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.07),transparent 42%),
    linear-gradient(135deg,var(--sd-state-accent-bg-soft),var(--sd-state-info-bg-faint)),
    rgba(var(--sd-rgb-surface-1),.46);
  --sd-material-review-collapse:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.065),transparent 42%),
    linear-gradient(135deg,rgba(var(--sd-rgb-execute-blue),.040),rgba(var(--sd-rgb-accent-primary),.012)),
    rgba(var(--sd-rgb-surface-1),.43);
  --sd-material-plan-composer:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.065),transparent 42%),
    rgba(var(--sd-rgb-surface-1),.43);
  --sd-material-pacer:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.065),transparent 42%),
    linear-gradient(135deg,rgba(var(--sd-rgb-pacer-primary),.015),transparent 58%),
    rgba(var(--sd-rgb-surface-1),.53);
  --sd-material-guide-hover:rgba(var(--sd-rgb-surface-1),.34);
  --sd-material-guide-selected:rgba(var(--sd-rgb-accent-primary),.085);
  --sd-material-guide-selected-hover:rgba(var(--sd-rgb-accent-primary),.12);
  --sd-material-guide-save:rgba(var(--sd-rgb-info),.065);
  --sd-material-progress-current:currentColor;
  --sd-material-insights-navigation:
    linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.065),transparent 42%),
    linear-gradient(135deg,rgba(var(--sd-rgb-insights-nav-1),.48),rgba(var(--sd-rgb-insights-nav-2),.38));
  --sd-material-insights-window-control:rgba(var(--sd-rgb-surface-1),.28);
}

html[data-theme="director-light"][data-material="glass"]{
  --sd-glass-surface-alpha:.74;
  --sd-glass-surface-soft-alpha:.56;
  --sd-glass-panel-alpha:.68;
  --sd-glass-field-alpha:.72;
  --sd-glass-floating-alpha:.84;
  --sd-glass-navigation-alpha:.78;
  --sd-glass-readable-alpha:.88;
  --sd-glass-sticky-alpha:.92;
  --sd-glass-specular:rgba(var(--sd-rgb-on-strong),.22);
  --sd-glass-specular-soft:rgba(var(--sd-rgb-on-strong),.12);
  --sd-glass-edge:rgba(var(--sd-rgb-shadow),.30);
  --sd-glass-control-edge:rgba(var(--sd-rgb-shadow),.46);
}

html[data-depth="glass"]{
  --sd-depth-card:0 10px 26px rgba(var(--sd-rgb-shadow),.13),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.09);
  --sd-depth-panel:0 14px 34px rgba(var(--sd-rgb-shadow),.15),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10);
  --sd-depth-inset:inset 0 1px 0 var(--sd-glass-specular-soft);
  --sd-depth-canvas:inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.035);
  --sd-depth-accent-workbench:0 18px 48px rgba(var(--sd-rgb-shadow),.16),0 0 28px var(--sd-state-accent-glow),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10);
  --sd-depth-navigation:12px 0 42px rgba(var(--sd-rgb-shadow),.15),inset -1px 0 rgba(var(--sd-rgb-on-strong),.09);
  --sd-depth-floating:0 18px 52px rgba(var(--sd-rgb-shadow),.24),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.12);
  --sd-depth-overlay:0 28px 86px rgba(var(--sd-rgb-shadow),.30),0 0 30px rgba(var(--sd-rgb-info),.055),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.12);
  --sd-depth-focus:0 0 0 1px rgba(var(--sd-rgb-accent-primary),.18),0 0 0 4px rgba(var(--sd-rgb-accent-primary),.055),0 8px 24px rgba(var(--sd-rgb-shadow),.12);
  --sd-depth-countdown:0 18px 46px rgba(var(--sd-rgb-shadow),.18),inset 0 0 36px rgba(var(--sd-rgb-execute-lime),.022),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10);
  --sd-depth-countdown-paused:0 18px 46px rgba(var(--sd-rgb-shadow),.18),inset 0 0 36px rgba(var(--sd-rgb-execute-amber),.022),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10);
  --sd-depth-execute-command-rail:0 16px 38px rgba(var(--sd-rgb-shadow),.14),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
  --sd-depth-review-collapse:0 14px 34px rgba(var(--sd-rgb-shadow),.13),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
  --sd-depth-pacer:0 16px 38px rgba(var(--sd-rgb-shadow),.14),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
  --sd-depth-runtime-card:0 16px 38px rgba(var(--sd-rgb-shadow),.14),0 0 18px var(--sd-state-accent-glow),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
  --sd-depth-runtime-card-compact:0 10px 24px rgba(var(--sd-rgb-shadow),.12),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
  --sd-depth-runtime-actions-collapsed:0 10px 28px rgba(var(--sd-rgb-shadow),.12),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
  --sd-depth-execute-note-workbench:0 12px 30px rgba(var(--sd-rgb-shadow),.12),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
  --sd-depth-focus-rhythm-compact:0 10px 26px rgba(var(--sd-rgb-shadow),.12),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
  --sd-depth-session-guard-compact:0 10px 26px rgba(var(--sd-rgb-shadow),.12),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
  --sd-depth-insights-navigation:0 12px 34px rgba(var(--sd-rgb-shadow),.13),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
  --sd-depth-insights-definition:inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07),0 10px 28px rgba(var(--sd-rgb-shadow),.10);
  --sd-depth-insights-coach-primary:inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07),0 12px 30px rgba(var(--sd-rgb-shadow),.11);
  --sd-depth-disabled-filter:grayscale(.28) saturate(.72);
  --sd-depth-current-progress:0 0 10px currentColor;
}

/* GLASS IDENTITY LAYER --------------------------------------------------
   V1 material character, but a different spatial and typographic system.
   This is intentionally static: geometry and hierarchy create the identity,
   not animation, pointer tracking, or continuously recomposited effects. */
html[data-presentation="glass"] .ui-card{--card-border-width:1px}
html[data-presentation="glass"] .ui-panel{border-width:1px}
html[data-presentation="glass"] .ui-inset,
html[data-presentation="glass"] .ui-canvas{border-color:var(--sd-glass-edge)}
html[data-presentation="glass"] .ui-disclosure{border-width:1px}
html[data-presentation="glass"] .status-bar{
  border-width:1px;border-radius:var(--sd-shape-card-radius);box-shadow:0 9px 28px rgba(var(--sd-rgb-shadow),.10),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
}
html[data-presentation="glass"] .status-seg{border-right-width:1px}
html[data-presentation="glass"] .block-label::after{opacity:.45}
html[data-presentation="glass"] .pnote-block::before,
html[data-presentation="glass"] .practice-pacer::before,
html[data-presentation="glass"] .review-hero::before{display:none}
html[data-presentation="glass"] #pane-execute .nameplate::before{display:none}
html[data-presentation="glass"] .secret{
  border:1px solid var(--sd-glass-edge);border-left-width:1px;border-radius:22px;
  background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 44%),rgba(var(--sd-rgb-surface-1),.36);
  font-family:var(--sd-font-body);font-style:normal;font-weight:600;letter-spacing:0;text-shadow:none;
}
html[data-presentation="glass"] .review-section-title,
html[data-presentation="glass"] .rt-actions-title,
html[data-presentation="glass"] .journal-title,
html[data-presentation="glass"] .pnote-title,
html[data-presentation="glass"] .practice-pacer-title{letter-spacing:.01em}
html[data-presentation="glass"] .focus-rhythm-title,
html[data-presentation="glass"] .backup-section-title,
html[data-presentation="glass"] .execute-overlay-kicker,
html[data-presentation="glass"] .interaction-eyebrow{letter-spacing:var(--sd-type-label-tracking)}
html[data-presentation="glass"] #pane-execute .execute-note-desk .pnote-hdr{
  display:grid;grid-template-columns:minmax(0,1fr) 26px;align-items:center;gap:10px;
}
html[data-presentation="glass"] #pane-execute .execute-note-desk .pnote-title-row{gap:6px}
html[data-presentation="glass"] #pane-execute .execute-note-desk .pnote-title{
  min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--sd-type-role-section-size);line-height:1.12;letter-spacing:.01em;
}
html[data-presentation="glass"] .next-strip .nxt,
html[data-presentation="glass"] .practice-inline-btn,
html[data-presentation="glass"] .practice-variable-examples span{
  font-family:var(--sd-font-body);text-transform:none;letter-spacing:.01em;
}

/* Subtle Glass-specific rhythm and chart finish; no continuous animation. */
html[data-presentation="glass"]{
  --sd-motion-duration-quick:.14s;
  --sd-motion-duration-fast:.17s;
  --sd-motion-duration-standard:.18s;
  --sd-motion-ease-standard:cubic-bezier(.2,.75,.25,1);
  --sd-chart-grid-color:rgba(var(--sd-rgb-neutral-overlay),.095);
  --sd-chart-line-width:1.5;
  --sd-chart-line-strong-width:2.7;
  --sd-chart-dot-stroke-width:1;
  --sd-chart-tooltip-border:var(--sd-glass-control-edge);
  --sd-chart-inspect-box-border:var(--sd-glass-control-edge);
}

html[data-presentation="glass"] .display-tools-trigger{
  border-width:1px;border-radius:999px;background:var(--sd-material-floating);
  color:var(--sd-color-text-secondary-strong);
  box-shadow:var(--sd-depth-floating);backdrop-filter:var(--sd-glass-filter-soft);-webkit-backdrop-filter:var(--sd-glass-filter-soft);
}
/* Glass changes only the finish of the shared compact Display Controls grid. */
html[data-presentation="glass"] .display-tools-menu{
  gap:5px;padding:9px;border:1px solid var(--sd-glass-control-edge);border-radius:22px;
}
html[data-presentation="glass"] .display-tools-menu>.type-btn,
html[data-presentation="glass"] .display-tools-menu>#fs-btn{
  width:36px;height:36px;min-width:36px;min-height:36px;padding:0;border:1px solid var(--sd-glass-control-edge);border-radius:11px;
  color:var(--sd-color-text-secondary-strong);background:rgba(var(--sd-rgb-surface-1),.28);box-shadow:inset 0 1px 0 var(--sd-glass-specular-soft);
}
html[data-presentation="glass"] .display-tools-menu>.type-btn:hover,
html[data-presentation="glass"] .display-tools-menu>#fs-btn:hover{
  color:var(--sd-color-text-primary);border-color:rgba(var(--sd-rgb-accent-primary),.34);background:rgba(var(--sd-rgb-surface-1),.40);
}
html[data-presentation="glass"] .display-tools-menu>#fs-btn{font-size:0;position:relative}
html[data-presentation="glass"] .display-tools-menu>#fs-btn::before{
  content:"";width:13px;height:13px;border:1.5px solid currentColor;border-radius:2px;box-sizing:border-box;
}
html[data-presentation="glass"] .theme-controls,
html[data-presentation="glass"] .presentation-controls{
  padding-top:7px;border-top-color:rgba(var(--sd-rgb-on-strong),.075);
}
html[data-presentation="glass"] .theme-controls-label,
html[data-presentation="glass"] .presentation-controls-label{
  color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-label-size);font-weight:500;letter-spacing:.01em;
}
html[data-presentation="glass"] .theme-btn,
html[data-presentation="glass"] .presentation-btn{
  height:34px;padding:0 8px;border:1px solid var(--sd-glass-control-edge);border-radius:10px;
  color:var(--sd-color-text-secondary-strong);background:rgba(var(--sd-rgb-surface-1),.22);font-weight:600;
}
html[data-presentation="glass"] .theme-btn:hover,
html[data-presentation="glass"] .presentation-btn:hover{
  color:var(--sd-color-text-primary);border-color:rgba(var(--sd-rgb-accent-primary),.34);background:rgba(var(--sd-rgb-surface-1),.34);
}
html[data-presentation="glass"] .theme-btn[aria-pressed="true"],
html[data-presentation="glass"] .presentation-btn[aria-pressed="true"]{
  color:var(--sd-color-accent-primary);border-color:rgba(var(--sd-rgb-accent-primary),.48);
  background:linear-gradient(180deg,rgba(var(--sd-rgb-accent-primary),.105),rgba(var(--sd-rgb-accent-primary),.055));
  box-shadow:inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.07);
}

@media(min-width:901px) and (min-height:601px),(min-width:901px) and (hover:hover),(min-width:901px) and (pointer:fine){
  html[data-presentation="glass"] .sidebar{
    left:14px!important;top:14px!important;bottom:14px!important;
    width:calc(var(--sd-responsive-sidebar-width) - 4px)!important;
    height:auto!important;min-height:0!important;
    border:1px solid var(--sd-glass-edge)!important;border-radius:30px;
    box-shadow:0 24px 70px rgba(var(--sd-rgb-shadow),.22),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10)!important;
  }
  html[data-presentation="glass"] .main{
    margin-left:calc(var(--sd-responsive-sidebar-width) + 18px)!important;
    padding-right:14px;
  }
  html[data-presentation="glass"] .pane{padding-top:max(30px,var(--sd-density-pane-padding-top))}
}

html[data-presentation="glass"] .sidebar::before{
  background:linear-gradient(180deg,rgba(var(--sd-rgb-on-strong),.035),transparent 28%,rgba(var(--sd-rgb-accent-primary),.018) 100%);
}
html[data-presentation="glass"] .sidebar::after{display:none}
html[data-presentation="glass"] .sb-head{
  min-height:0;padding:22px 18px 12px;background:transparent;border-bottom:0;overflow:visible;
}
html[data-presentation="glass"] .sb-head::before,
html[data-presentation="glass"] .sb-head::after{display:none}
html[data-presentation="glass"] .sb-eyebrow{margin-bottom:5px;opacity:.72}
html[data-presentation="glass"] .sb-name{
  font-family:var(--sd-font-body);font-weight:600;text-transform:none;letter-spacing:-.025em;line-height:1.08;text-shadow:none;
}
html[data-presentation="glass"] .sb-race{margin-top:8px;opacity:.78}
html[data-theme="director-light"][data-presentation="glass"] .sb-eyebrow,
html[data-theme="director-light"][data-presentation="glass"] .sb-race{color:var(--sd-color-text-secondary-strong);opacity:1}
html[data-theme="director-light"][data-presentation="glass"] .sb-name{color:var(--sd-color-text-primary)}
html[data-presentation="glass"] .sb-clock{
  margin:0 12px;padding:10px 12px;border:1px solid var(--sd-glass-edge);border-radius:18px;
  background:rgba(var(--sd-rgb-surface-1),.22);box-shadow:inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.055);
}
html[data-presentation="glass"] #clock{font-size:var(--sd-type-role-section-size);letter-spacing:.035em;filter:none}
html[data-presentation="glass"] .sb-nav{padding:14px 10px 10px}
html[data-presentation="glass"] .nav-item{
  box-sizing:border-box;width:100%;margin:0 0 5px;padding:8px 10px;border:1px solid transparent!important;border-radius:17px;gap:10px;
  color:var(--sd-color-text-secondary);background:transparent;
}
html[data-presentation="glass"] .nav-item:hover{
  border-color:var(--sd-glass-edge)!important;background:rgba(var(--sd-rgb-surface-1),.20);color:var(--sd-color-text-primary);
}
html[data-presentation="glass"] .nav-item.on{
  border-color:var(--sd-glass-edge)!important;background:linear-gradient(145deg,rgba(var(--sd-rgb-on-strong),.07),transparent 58%),rgba(var(--sd-rgb-surface-1),.39);
  color:var(--sd-color-text-primary);box-shadow:0 7px 20px rgba(var(--sd-rgb-shadow),.10),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.08);
}
html[data-presentation="glass"] .nav-icon{
  width:30px;height:30px;display:grid;place-items:center;border-radius:11px;
  background:rgba(var(--sd-rgb-surface-1),.18);font-size:var(--sd-type-role-body-size);
}
html[data-presentation="glass"] .nav-item.on .nav-icon{background:rgba(var(--sd-rgb-accent-primary),.11);color:var(--sd-color-accent-primary)}
html[data-presentation="glass"] .sb-stats{
  margin:8px 10px 10px;padding:12px;border:1px solid var(--sd-glass-edge);border-radius:20px;
  background:rgba(var(--sd-rgb-surface-1),.20);
}

/* Mobile becomes a true floating tab bar. Same DOM, same controls, different
   presentation only. */
@media(max-width:900px),(hover:none) and (pointer:coarse) and (max-height:600px){
  /* One source of truth for the floating mobile shell. Every bottom-floating
     Glass surface consumes the same clearance, so lazy tabs, safe areas and
     compact breakpoints cannot desynchronise navigation from content. */
  html[data-presentation="glass"]{
    --sd-glass-mobile-bar-height:64px;
    --sd-glass-mobile-bar-offset:max(10px,var(--sd-safe-bottom));
    --sd-glass-mobile-content-clearance:calc(var(--sd-glass-mobile-bar-height) + var(--sd-glass-mobile-bar-offset) + 12px);
  }
  html[data-presentation="glass"] .sidebar{
    position:fixed!important;
    left:max(10px,var(--sd-safe-left),calc((100vw - 720px)/2))!important;
    right:max(10px,var(--sd-safe-right),calc((100vw - 720px)/2))!important;
    top:auto!important;bottom:var(--sd-glass-mobile-bar-offset)!important;
    width:auto!important;height:var(--sd-glass-mobile-bar-height)!important;min-height:var(--sd-glass-mobile-bar-height)!important;
    box-sizing:border-box;padding:5px!important;border:1px solid var(--sd-glass-edge)!important;border-radius:24px!important;
    box-shadow:0 18px 52px rgba(var(--sd-rgb-shadow),.28),inset 0 1px 0 rgba(var(--sd-rgb-on-strong),.10)!important;
  }
  html[data-presentation="glass"] .sb-nav{
    display:grid!important;grid-auto-flow:column;grid-template-columns:none;grid-template-rows:minmax(0,1fr);
    grid-auto-columns:minmax(44px,1fr);gap:2px;width:100%;height:100%;padding:0!important;
    overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;scroll-snap-type:none;scrollbar-width:none;
  }
  html[data-presentation="glass"] .sb-nav::-webkit-scrollbar{display:none}
  html[data-presentation="glass"] .nav-item{
    min-width:44px!important;width:100%!important;min-height:44px!important;height:100%!important;margin:0!important;padding:5px 2px!important;
    flex-direction:column;justify-content:center;gap:2px;border:1px solid transparent!important;border-radius:17px!important;
    font-size:max(10px,.625rem)!important;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:clip;scroll-snap-align:none;
  }
  html[data-presentation="glass"] .nav-item.on{border-bottom-color:var(--sd-glass-edge)!important}
  html[data-presentation="glass"] .nav-icon{display:grid!important;width:22px;height:22px;border-radius:8px;font-size:var(--sd-type-role-copy-size)}
  html[data-presentation="glass"] .main{margin-left:0!important;padding-right:0;padding-bottom:0}
  html[data-presentation="glass"] .pane,
  html[data-presentation="glass"] #pane-plan{padding-top:max(18px,var(--sd-density-pane-padding-top));padding-bottom:var(--sd-glass-mobile-content-clearance)}
  html[data-presentation="glass"] .display-tools,
  html[data-presentation="glass"] #nudge-overlay,
  html[data-presentation="glass"] .pwa-update-control,
  html[data-presentation="glass"] .ownership-banner{bottom:var(--sd-glass-mobile-content-clearance)}
  html[data-presentation="glass"] .status-bar{border-radius:20px;overflow-x:auto}
  html[data-presentation="glass"] .display-tools-menu>.type-btn,
  html[data-presentation="glass"] .display-tools-menu>#fs-btn{width:44px;height:44px;min-width:44px;min-height:44px}
  html[data-presentation="glass"] .theme-btn,
  html[data-presentation="glass"] .presentation-btn{min-height:44px;height:44px}
}

@media(max-width:560px){
  html[data-presentation="glass"] #pane-execute .execute-note-desk .pnote-title{font-size:clamp(1rem,5vw,var(--sd-type-role-metric-size))}
}

@media(max-width:480px){
  html[data-presentation="glass"]{
    --sd-glass-mobile-bar-offset:max(7px,var(--sd-safe-bottom));
  }
  html[data-presentation="glass"] .sidebar{
    left:max(7px,var(--sd-safe-left))!important;right:max(7px,var(--sd-safe-right))!important;border-radius:22px!important;
  }
}

@media(max-width:359px){
  html[data-presentation="glass"]{
    --sd-glass-mobile-bar-height:60px;
    --sd-glass-mobile-bar-offset:max(6px,var(--sd-safe-bottom));
  }
  html[data-presentation="glass"] .sidebar{
    left:max(6px,var(--sd-safe-left))!important;right:max(6px,var(--sd-safe-right))!important;padding:4px!important;border-radius:20px!important;
  }
  html[data-presentation="glass"] .sb-nav{gap:1px}
  html[data-presentation="glass"] .nav-item{padding:3px 1px!important;gap:1px;border-radius:14px!important;font-size:max(10px,.625rem)!important}
  html[data-presentation="glass"] .nav-icon{width:20px;height:20px;border-radius:7px;font-size:var(--sd-type-role-label-size)}
}

@media(max-width:900px) and (max-height:520px) and (orientation:landscape),(hover:none) and (pointer:coarse) and (max-height:520px) and (orientation:landscape){
  html[data-presentation="glass"]{
    --sd-glass-mobile-bar-height:58px;
    --sd-glass-mobile-bar-offset:max(5px,var(--sd-safe-bottom));
  }
  html[data-presentation="glass"] .sidebar{padding:4px!important;border-radius:20px!important}
  html[data-presentation="glass"] .sb-nav{gap:2px}
  html[data-presentation="glass"] .nav-item{padding:3px 2px!important;gap:0;border-radius:14px!important;font-size:max(10px,.625rem)!important}
  html[data-presentation="glass"] .nav-icon{width:20px;height:20px;border-radius:7px;font-size:var(--sd-type-role-label-size)}
}

@media(hover:none) and (pointer:coarse){
  html[data-presentation="glass"] .display-tools-menu>.type-btn,
  html[data-presentation="glass"] .display-tools-menu>#fs-btn{width:44px;height:44px;min-width:44px;min-height:44px}
  html[data-presentation="glass"] .theme-btn,
  html[data-presentation="glass"] .presentation-btn{min-height:44px;height:44px}
}

/* Floating surfaces share the mobile navigation anchor but must never occupy
   the same interaction region. The coordinator keeps application state intact:
   only the highest-priority visible surface is presented, and queued surfaces
   return automatically when the active surface closes. */
html[data-presentation="glass"] .sd-glass-surface-suppressed{display:none!important}
html[data-presentation="glass"][data-glass-overlay-blocks-tools="true"] .display-tools{
  visibility:hidden!important;pointer-events:none!important;
}

/* Readability-critical Glass surfaces remain translucent but carry enough
   material density to keep labels legible over scrolling/dynamic content. */
html[data-material="glass"] .pnote-info-popover{
  background:linear-gradient(145deg,var(--sd-glass-specular),transparent 42%),rgba(var(--sd-rgb-surface-1),var(--sd-glass-readable-alpha));
  border-color:var(--sd-glass-control-edge);
  color:var(--sd-color-text-primary);
  backdrop-filter:var(--sd-glass-filter-strong);
  -webkit-backdrop-filter:var(--sd-glass-filter-strong);
}
html[data-presentation="glass"] .pnote-info-btn{
  border-color:var(--sd-glass-control-edge);
  background:var(--sd-material-control);
  color:var(--sd-color-text-secondary-strong);
}
html[data-material="glass"] .library-notes-nav-head{
  background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 46%),rgba(var(--sd-rgb-surface-1),var(--sd-glass-sticky-alpha));
  box-shadow:0 1px 0 var(--sd-glass-edge);
  backdrop-filter:var(--sd-glass-filter-soft);
  -webkit-backdrop-filter:var(--sd-glass-filter-soft);
}
html[data-material="glass"] .library-notes-trash{
  border-top-color:var(--sd-glass-edge);
  background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 46%),rgba(var(--sd-rgb-surface-1),var(--sd-glass-sticky-alpha));
  backdrop-filter:var(--sd-glass-filter-soft);
  -webkit-backdrop-filter:var(--sd-glass-filter-soft);
}

/* Data & Backup keeps Director's information hierarchy while adopting Glass
   materials instead of its legacy near-transparent local washes. */
html[data-material="glass"] :is(.backup-location-row,.backup-inline-settings,.backup-compact-row,.backup-security-group){
  border-color:var(--sd-glass-edge);
  background:var(--sd-material-card-soft);
}
html[data-material="glass"] :is(.backup-model-disclosure,.backup-advanced-disclosure){
  border-color:var(--sd-glass-edge);
  background:var(--sd-material-disclosure);
}
html[data-material="glass"] :is(.backup-location-row,.backup-inline-settings,.backup-compact-row,.backup-security-group,.backup-model-disclosure,.backup-advanced-disclosure){
  border-radius:var(--sd-shape-control-radius);
}
html[data-material="glass"] .backup-advanced-disclosure>summary{
  background:var(--sd-material-inset);
  border-bottom-color:var(--sd-glass-edge);
}
html[data-material="glass"] .backup-model-disclosure>summary{color:var(--sd-color-text-secondary-strong)}
html[data-material="glass"] .backup-section-title{color:var(--sd-color-text-secondary-strong)}
html[data-material="glass"] .backup-security-group .backup-compact-row{border:0;border-radius:0;background:transparent}

/* True backdrop blur is reserved for visually meaningful surfaces. Nested
   analytical cells stay translucent/specular without creating hundreds of
   compositor layers. */
html[data-material="glass"] .sidebar,
html[data-material="glass"] .ui-panel,
html[data-material="glass"] .plan-composer-body,
html[data-material="glass"] .plan-field-popover,
html[data-material="glass"] .display-tools-menu,
html[data-material="glass"] .interaction-dialog,
html[data-material="glass"] .legal-center-dialog,
html[data-material="glass"] #pane-execute .cd-card,
html[data-material="glass"] .guide-hero,
html[data-material="glass"] .guide-handbook{
  backdrop-filter:var(--sd-glass-filter-soft);
  -webkit-backdrop-filter:var(--sd-glass-filter-soft);
}
html[data-material="glass"] .display-tools-menu,
html[data-material="glass"] .interaction-dialog,
html[data-material="glass"] .legal-center-dialog{
  backdrop-filter:var(--sd-glass-filter-strong);
  -webkit-backdrop-filter:var(--sd-glass-filter-strong);
}

/* Retarget legacy solid local surfaces to the Glass material tokens without
   changing their semantic state colours or behavioural classes. */
html[data-material="glass"] .rstat,
html[data-material="glass"] .rmetric,
html[data-material="glass"] .hstat{--card-bg:var(--sd-material-card-soft)}
html[data-material="glass"] .rcard,
html[data-material="glass"] .library-card,
html[data-material="glass"] .si-card{--card-bg:var(--sd-material-card)}
html[data-material="glass"] #fs-btn,
html[data-material="glass"] .display-tools-trigger,
html[data-material="glass"] .theme-btn,
html[data-material="glass"] .presentation-btn,
html[data-material="glass"] .type-btn{background:var(--sd-material-control)}
html[data-material="glass"] .gap-box,
html[data-material="glass"] .practice-unit-row.head{background:var(--sd-material-inset)}

html[data-material="glass"] .sd-rte{background:var(--sd-material-canvas);border-color:var(--sd-glass-edge)}
html[data-material="glass"] .sd-rte-toolbar{background:var(--sd-material-inset);border-bottom-color:var(--sd-glass-edge)}
html[data-presentation="glass"] .library-note-nav-item,
html[data-presentation="glass"] .library-note-nav-path,
html[data-presentation="glass"] .library-notes-editor-empty,
html[data-presentation="glass"] .library-note-read.empty,
html[data-presentation="glass"] .library-diary-read.empty{color:var(--sd-color-text-secondary)}
html[data-presentation="glass"] .library-note-nav-item.has-note{color:var(--sd-color-text-primary)}
html[data-presentation="glass"] .library-note-nav-item.empty-note{color:var(--sd-color-text-muted)}
html[data-material="glass"] #pane-execute .nameplate{
  background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,var(--sd-surface-neutral-wash),rgba(var(--sd-rgb-execute-lime),.018)),rgba(var(--sd-rgb-surface-1),.42);
  border-radius:var(--sd-shape-nameplate-radius);
  backdrop-filter:var(--sd-glass-filter-soft);
  -webkit-backdrop-filter:var(--sd-glass-filter-soft);
}
html[data-presentation="glass"][data-shape="glass"] .execute-command-rail .ctrl-block,
html[data-presentation="glass"][data-shape="glass"] .progress-rail{border-radius:var(--sd-shape-card-radius)}
html[data-presentation="glass"][data-shape="glass"] .pwa-update-control,
html[data-presentation="glass"][data-shape="glass"] .ownership-banner{border-radius:var(--sd-shape-floating-radius)}
html[data-material="glass"] .progress-rail{
  background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,var(--execute-blue-soft),rgba(var(--sd-rgb-execute-lime),.012)),rgba(var(--sd-rgb-surface-1),.40);
}
html[data-material="glass"] #pane-execute .execute-note-desk{--panel-bg:var(--sd-material-panel)}
html[data-material="glass"] .rt-panel-compact .rt-card{background:var(--sd-material-card-soft)}
html[data-material="glass"] .rt-actions-collapsed{background:var(--sd-material-disclosure);--panel-bg:var(--sd-material-disclosure)}
html[data-material="glass"] .focus-rhythm,
html[data-material="glass"] .pomodoro-rhythm,
html[data-material="glass"] .session-panel.execute-session-panel,
html[data-material="glass"] .review-unfinished{--panel-bg:var(--sd-material-panel)}
html[data-material="glass"] .rcard.full{--card-bg:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,rgba(var(--sd-rgb-success),.038),rgba(var(--sd-rgb-neutral-overlay),.012)),rgba(var(--sd-rgb-surface-1),.43)}
html[data-material="glass"] .rcard.partial{--card-bg:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,rgba(var(--sd-rgb-warning),.038),rgba(var(--sd-rgb-neutral-overlay),.012)),rgba(var(--sd-rgb-surface-1),.43)}
html[data-material="glass"] .rcard.skipped,
html[data-material="glass"] .rcard.zero-output{--card-bg:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,var(--sd-state-danger-bg-soft),rgba(var(--sd-rgb-warning),.014)),rgba(var(--sd-rgb-surface-1),.43)}
html[data-material="glass"] .rcard.finished-unverified{--card-bg:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(135deg,var(--sd-state-warn-bg-soft),rgba(var(--sd-rgb-neutral-overlay),.010)),rgba(var(--sd-rgb-surface-1),.43)}

/* Guide and Insights arrive lazily. Higher-specificity Glass rules keep their
   local solid fallbacks inside the same material language. */
html[data-material="glass"] .legal-center-overlay{background:var(--sd-material-modal-backdrop);backdrop-filter:var(--sd-material-modal-filter);-webkit-backdrop-filter:var(--sd-material-modal-filter)}
html[data-material="glass"] .legal-center-dialog{background:var(--sd-material-floating);clip-path:none;border-radius:var(--sd-shape-panel-radius);box-shadow:var(--sd-depth-overlay)}
html[data-material="glass"] .legal-center-head{background:linear-gradient(145deg,var(--sd-glass-specular-soft),transparent 42%),linear-gradient(100deg,rgba(var(--sd-rgb-info),.08),transparent 52%)}
html[data-material="glass"] .legal-center-nav{background:rgba(var(--sd-rgb-surface-1),.25)}

/* SVG Insights charts must never sit below a filtered compositing ancestor.
   Some WebKit/Chromium GPU paths can leave a live SVG tree unpainted when an
   ancestor uses backdrop-filter. Keep the Glass material, but remove only the
   compositor filter inside the Insights pane. Analytics/rendering code stays
   completely untouched. */
html[data-material="glass"] #pane-insights .ui-panel,
html[data-material="glass"] #pane-insights .ui-disclosure{
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

@media(max-width:900px),(hover:none) and (pointer:coarse) and (max-height:600px){
  html[data-material="glass"]{
    --sd-glass-filter:blur(16px) saturate(1.20);
    --sd-glass-filter-soft:blur(10px) saturate(1.14);
    --sd-glass-filter-strong:blur(20px) saturate(1.24);
  }
}

@media(prefers-reduced-transparency:reduce){
  html[data-material="glass"]{
    --sd-glass-surface-alpha:.90;
    --sd-glass-surface-soft-alpha:.82;
    --sd-glass-panel-alpha:.88;
    --sd-glass-field-alpha:.90;
    --sd-glass-floating-alpha:.94;
    --sd-glass-navigation-alpha:.94;
    --sd-material-inset:rgba(var(--sd-rgb-surface-1),.92);
    --sd-material-canvas:rgba(var(--sd-rgb-surface-1),.96);
    --sd-glass-filter:none;
    --sd-glass-filter-soft:none;
    --sd-glass-filter-strong:none;
    --sd-material-navigation-filter:none;
    --sd-material-nudge-filter:none;
    --sd-material-modal-backdrop:rgba(var(--sd-rgb-canvas),.94);
    --sd-material-modal-filter:none;
    --sd-material-setup-backdrop:rgba(var(--sd-rgb-canvas),.96);
    --sd-material-setup-filter:none;
    --sd-material-state-overlay-filter:none;
  }
}

@supports not (backdrop-filter:blur(1px)){
  html[data-material="glass"]{
    --sd-glass-surface-alpha:.86;
    --sd-glass-surface-soft-alpha:.76;
    --sd-glass-panel-alpha:.84;
    --sd-glass-field-alpha:.86;
    --sd-glass-floating-alpha:.92;
    --sd-glass-navigation-alpha:.92;
    --sd-material-inset:rgba(var(--sd-rgb-surface-1),.90);
    --sd-material-canvas:rgba(var(--sd-rgb-surface-1),.95);
  }
}

@media(forced-colors:active){
  html[data-material="glass"]{
    --sd-glass-filter:none;
    --sd-glass-filter-soft:none;
    --sd-glass-filter-strong:none;
    --sd-material-navigation-filter:none;
    --sd-material-nudge-filter:none;
    --sd-material-modal-filter:none;
    --sd-material-setup-filter:none;
    --sd-material-state-overlay-filter:none;
  }
  html[data-material="glass"] .ui-card,
  html[data-material="glass"] .ui-panel,
  html[data-material="glass"] .ui-disclosure,
  html[data-material="glass"] .display-tools-menu{box-shadow:none}
}
`;

function install(){
  const kernel=window[KERNEL_KEY];
  if(!kernel||kernel.format!=='study-director.presentation-kernel'||kernel.version!==1)return false;
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.dataset.sdPresentationPack=PROFILE.id;
    style.textContent=CSS;
    document.head.appendChild(style);
  }
  const registered=kernel.registerPresentation(PROFILE);
  installOverlayCoordinator();
  return registered;
}

function installOverlayCoordinator(){
  const root=document.documentElement;
  if(!root||root.dataset.glassOverlayCoordinator==='installed')return;
  const surfaces=[
    {id:'owner',element:document.querySelector('.ownership-banner'),visible:element=>element.classList.contains('on'),blocksTools:true},
    {id:'update',element:document.querySelector('.pwa-update-control'),visible:element=>!element.hidden,blocksTools:false},
    {id:'nudge',element:document.getElementById('nudge-overlay'),visible:element=>element.classList.contains('on'),blocksTools:true}
  ].filter(surface=>surface.element);
  const menu=document.getElementById('display-tools-menu');
  const trigger=document.getElementById('display-tools-trigger');
  let queued=false,running=false;
  const reconcile=()=>{
    queued=false;
    if(running)return;
    running=true;
    try{
      const glass=root.dataset.presentation==='glass';
      const visible=glass?surfaces.filter(surface=>surface.visible(surface.element)):[];
      const winner=visible[0]||null;
      surfaces.forEach(surface=>surface.element.classList.toggle('sd-glass-surface-suppressed',!!winner&&surface!==winner));
      if(winner){root.dataset.glassOverlayActive=winner.id;root.dataset.glassOverlayBlocksTools=winner.blocksTools?'true':'false';}
      else{delete root.dataset.glassOverlayActive;delete root.dataset.glassOverlayBlocksTools;}
      if(winner&&winner.blocksTools&&menu&&!menu.hidden){menu.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false');}
    }finally{running=false;}
  };
  const schedule=()=>{if(queued)return;queued=true;queueMicrotask(reconcile);};
  const observer=new MutationObserver(schedule);
  observer.observe(root,{attributes:true,attributeFilter:['data-presentation']});
  surfaces.forEach(surface=>observer.observe(surface.element,{attributes:true,attributeFilter:['class','hidden']}));
  root.dataset.glassOverlayCoordinator='installed';
  reconcile();
}

if(!install())window.addEventListener('studydirector:ready',install,{once:true});
})();
