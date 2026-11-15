/**
 * @name BlackAstaCompanion
 * @description Control panel + companion for the Black Asta theme: pick a palette, switch effects on/off, choose the home icon or wallpaper source, tune glass; also colours role titles, tags the title bar, and plays the Anti-Magic mention edge wave.
 * @version 1.4.0
 * @author amirabbas2556
 * @source https://github.com/AmirAbbas8585/Black-Asta-BetterDiscord
 * @website https://github.com/AmirAbbas8585/Black-Asta-BetterDiscord
 * @updateUrl https://raw.githubusercontent.com/AmirAbbas8585/Black-Asta-BetterDiscord/main/BlackAstaCompanion.plugin.js
 */

const PLUGIN_ID = "BlackAstaCompanion";
const PLUGIN_VERSION = "1.4.0";
const REPO_API_LATEST = "https://api.github.com/repos/AmirAbbas8585/Black-Asta-BetterDiscord/releases/latest";
const RELEASES_URL = "https://github.com/AmirAbbas8585/Black-Asta-BetterDiscord/releases";
const STYLE_ID = "BlackAstaCompanion-panel";
const GROUP_SELECTOR = '[class*="membersGroup"], [class*="members_"] h3, [class*="membersWrap"] h3, [role="list"] > h3';
const DASH_COUNT = /\s*[\u2014\u2013-]\s*\d+\s*$/;     // "Admin — 3"  ->  "Admin"
const PING_SIGNAL = "ab-ping-detect";
const WAVE_ID = "ab-edge-wave";
const ZOOM_HUD_ID = "ab-zoom-hud";
const COOLDOWN_MS = 1500;
const SWITCH_GRACE_MS = 1500;

const WALLPAPERS = {
    github:  "https://raw.githubusercontent.com/AmirAbbas8585/Black-Asta-BetterDiscord/main/assets/wallpaper.jpg",
    uupload: "https://s50.uupload.ir/files/amirabbas8585/amirabbas/better/new.jpg",
};

/* ---------------------------------------------------------------- settings model */

const PALETTES = {
    antimagic: { name: "Anti-Magic",        note: "default: black + crimson", red: "214 40 57",  hi: "245 78 96",  deep: "120 22 34" },
    wind:      { name: "Wind",              note: "green",                    red: "52 190 120", hi: "110 225 165", deep: "18 105 66" },
    water:     { name: "Water",             note: "blue",                     red: "60 140 235", hi: "120 185 250", deep: "22 70 140" },
    fire:      { name: "Fire",              note: "orange",                   red: "235 105 30", hi: "255 150 70",  deep: "140 52 10" },
    lightning: { name: "Lightning",         note: "gold",                     red: "225 180 25", hi: "250 210 70",  deep: "130 90 10" },
    dark:      { name: "Dark",              note: "violet",                   red: "150 80 235", hi: "185 130 250", deep: "80 30 130" },
};

const DEFAULTS = {
    palette: "antimagic",
    homeIcon: "artwork",       // artwork | clover | circle | default
    wallpaperSource: "github", // github | uupload | custom
    customWallpaper: "",
    embers: true,              // drifting embers over the wallpaper
    slash: true,               // blade of light on hover (buttons, server icons, tabs)
    dispel: true,              // anti-magic field: hide other people's avatar decorations / nameplates / profile effects
    mentionWave: true,         // crimson wave from the window edge when you are mentioned
    roleColors: true,          // role titles in the members list take the role's colour
    titleBar: true,            // let the theme style the title bar + window buttons
    ctrlZoom: true,            // Ctrl + Scroll / Ctrl + +/-/0 browser-style zoom
    zoom: 100,                 // % - UI zoom (60 - 180)
    checkUpdates: true,        // check GitHub releases for updates on startup
    panelOpacity: 34,          // % - glass panels (lower = more artwork)
    blur: 6,                   // px - glass blur
    dim: 6,                    // % - dark veil over the wallpaper
};

function loadSettings() {
    try {
        const saved = BdApi.Data && BdApi.Data.load ? BdApi.Data.load(PLUGIN_ID, "settings") : BdApi.loadData(PLUGIN_ID, "settings");
        return Object.assign({}, DEFAULTS, saved || {});
    } catch (e) {
        return Object.assign({}, DEFAULTS);
    }
}

function saveSettings(s) {
    try {
        if (BdApi.Data && BdApi.Data.save) BdApi.Data.save(PLUGIN_ID, "settings", s);
        else BdApi.saveData(PLUGIN_ID, "settings", s);
    } catch (e) { console.warn("[BlackAstaCompanion] could not save settings", e); }
}

const APPLIED_VARS = [
    "--ab-red", "--ab-red-hi", "--ab-red-deep", "--ab-embers-alpha", "--ab-embers",
    "--ab-slash", "--ab-dispel", "--ab-glass-a", "--ab-chat-a", "--ab-glass-blur",
    "--ab-dim", "--ab-image"
];

function sanitizeUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!/^https?:\/\//i.test(trimmed)) return "";
    return trimmed.replace(/["\\\n\r()]/g, "");
}

// Settings -> CSS variables on <html>. The theme reads these, so every change is instant.
function applySettings(s) {
    const root = document.documentElement;
    const set = (k, v) => root.style.setProperty(k, v);
    const pal = PALETTES[s.palette] || PALETTES.antimagic;
    set("--ab-red", pal.red);
    set("--ab-red-hi", pal.hi);
    set("--ab-red-deep", pal.deep);
    set("--ab-embers-alpha", s.embers ? ".7" : "0");
    set("--ab-embers", s.embers ? "ab-rise" : "none");
    set("--ab-slash", s.slash ? "ab-slash" : "none");
    set("--ab-dispel", s.dispel ? "hidden" : "visible");
    set("--ab-glass-a", (s.panelOpacity / 100).toFixed(2));
    set("--ab-chat-a", (s.panelOpacity / 100 * 0.65).toFixed(2));
    set("--ab-glass-blur", s.blur + "px");
    set("--ab-dim", (s.dim / 100).toFixed(2));
    root.setAttribute("data-ab-home", s.homeIcon);

    if (s.wallpaperSource === "uupload") {
        set("--ab-image", `url("${WALLPAPERS.uupload}")`);
    } else if (s.wallpaperSource === "custom") {
        const safe = sanitizeUrl(s.customWallpaper);
        if (safe) set("--ab-image", `url("${safe}")`);
        else root.style.removeProperty("--ab-image");
    } else {
        root.style.removeProperty("--ab-image");
    }

    const mount = document.getElementById("app-mount");
    if (mount) {
        const z = Math.min(180, Math.max(60, Number(s.zoom) || 100));
        mount.style.zoom = z === 100 ? "" : (z / 100).toFixed(2);
    }
}

function clearApplied() {
    const root = document.documentElement;
    for (const k of APPLIED_VARS) root.style.removeProperty(k);
    root.removeAttribute("data-ab-home");
    const mount = document.getElementById("app-mount");
    if (mount) mount.style.zoom = "";
}

/* ---------------------------------------------------------------- role colours */

function getRoleColorMap() {
    try {
        const W = BdApi.Webpack;
        const guildStore = W.getStore ? W.getStore("SelectedGuildStore") : W.getByKeys("getGuildId", "getLastSelectedGuildId");
        const roleStore = W.getStore ? W.getStore("GuildRoleStore") : W.getByKeys("getSortedRoles");
        const guildId = guildStore && guildStore.getGuildId && guildStore.getGuildId();
        if (!guildId || !roleStore) return null;
        const roles = roleStore.getSortedRoles ? roleStore.getSortedRoles(guildId) : Object.values(roleStore.getRoles(guildId) || {});
        const map = new Map();
        for (const r of roles) {
            const color = r.colorString || (r.color ? "#" + r.color.toString(16).padStart(6, "0") : "");
            if (color && r.name) map.set(String(r.name).trim().toLowerCase(), color);
        }
        return map;
    } catch (e) {
        return null;
    }
}

function colorFromMembers(header) {
    let el = header.closest('[role="listitem"]') || header;
    el = el.nextElementSibling;
    for (let steps = 0; el && steps < 6; steps++, el = el.nextElementSibling) {
        if (el.matches && el.matches(GROUP_SELECTOR)) break;
        if (el.querySelector && el.querySelector(GROUP_SELECTOR)) break;
        const styled = el.querySelectorAll ? el.querySelectorAll("[style]") : [];
        for (const node of styled) {
            const c = node.style && node.style.color;
            if (c) return c;
        }
    }
    return "";
}

function paintHeader(header, color) {
    if (header.dataset.abRole === (color || "")) return;
    header.dataset.abRole = color || "";
    const nodes = [header, ...header.querySelectorAll("span, div")];
    for (const n of nodes) {
        if (color) n.style.setProperty("color", color, "important");
        else n.style.removeProperty("color");
    }
    if (color) header.style.setProperty("--ab-role-color", color);
    else header.style.removeProperty("--ab-role-color");
}

function updateRoleHeaders(stats, enabled) {
    const headers = new Set(document.querySelectorAll(GROUP_SELECTOR));
    stats.headers = headers.size;
    stats.coloured = 0;
    if (!enabled) {
        for (const h of headers) paintHeader(h, "");
        return;
    }
    const map = getRoleColorMap();
    stats.method = map ? "role list" : "member names";
    for (const header of headers) {
        const name = header.textContent.replace(DASH_COUNT, "").trim().toLowerCase();
        const color = (map && map.get(name)) || colorFromMembers(header);
        paintHeader(header, color);
        if (color) stats.coloured++;
    }
}

/* ---------------------------------------------------------------- title bar detection */

function findTitleBar() {
    const direct = document.querySelector('[class*="titleBar_"], [class*="systemBar_"]');
    if (direct) {
        const r = direct.getBoundingClientRect();
        if (r.top <= 2 && r.height > 0 && r.height <= 48 && r.width >= window.innerWidth * 0.6) return direct;
    }
    const w = window.innerWidth;
    let el = document.elementFromPoint(Math.floor(w / 2), 3);
    if (el && el.closest && el.closest('[class*="layerContainer"], [class*="backdrop"]')) return null;
    let best = null;
    while (el && el !== document.body && el !== document.documentElement) {
        const r = el.getBoundingClientRect();
        if (r.top <= 1 && r.height > 0 && r.height <= 48 && r.width >= w - 4) best = el;
        el = el.parentElement;
    }
    return best;
}

function findWindowButtons(bar) {
    const w = window.innerWidth;
    let el = document.elementFromPoint(w - 12, 12);
    let close = null;
    while (el && el !== bar && el !== document.body) {
        const r = el.getBoundingClientRect();
        if (r.width >= 24 && r.width <= 64 && r.height <= 48 && r.right >= w - 2) close = el;
        el = el.parentElement;
    }
    if (!close) return { close: null, others: [] };
    const cr = close.getBoundingClientRect();
    const others = [];
    for (let i = 1; i <= 2; i++) {
        let n = document.elementFromPoint(Math.floor(cr.left - cr.width * (i - 0.5)), 12);
        while (n && n !== bar && n !== document.body) {
            const r = n.getBoundingClientRect();
            if (r.width >= 24 && r.width <= 64 && r.height <= 48 && Math.abs(r.right - (cr.left - cr.width * (i - 1))) <= 3) {
                others.push(n);
                break;
            }
            n = n.parentElement;
        }
    }
    return { close, others };
}

function tagTitleBar(state) {
    const bar = findTitleBar();
    if (!bar) return false;
    if (state.bar && state.bar !== bar) clearTitleBar(state);
    bar.setAttribute("data-ab", "titlebar");
    state.bar = bar;
    const { close, others } = findWindowButtons(bar);
    for (const old of state.buttons) if (old !== close && !others.includes(old)) old.removeAttribute("data-ab");
    state.buttons = [];
    if (close) { close.setAttribute("data-ab", "winclose"); state.buttons.push(close); }
    for (const o of others) { o.setAttribute("data-ab", "winbtn"); state.buttons.push(o); }
    return true;
}

function clearTitleBar(state) {
    if (state.bar) state.bar.removeAttribute("data-ab");
    for (const b of state.buttons) b.removeAttribute("data-ab");
    state.bar = null;
    state.buttons = [];
}

/* ---------------------------------------------------------------- settings panel UI */

const PANEL_CSS = `
.abp { color: var(--text-normal, #eee); font-size: 14px; padding: 4px 2px 16px; }
.abp h2 { margin: 0 0 2px; font-size: 20px; }
.abp .abp-sub { opacity: .7; margin-bottom: 14px; }
.abp h3 { margin: 18px 0 8px; font-size: 12px; letter-spacing: .09em; text-transform: uppercase; opacity: .75;
          padding-bottom: 4px; border-bottom: 1px solid rgb(var(--ab-red, 214 40 57) / .35); }
.abp .abp-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 10px; margin: 2px 0;
          border-radius: 2px 12px 2px 12px; background: rgb(255 255 255 / .04); }
.abp .abp-row:hover { background: rgb(255 255 255 / .07); }
.abp .abp-label small { display: block; opacity: .65; margin-top: 2px; }
.abp .abp-switch { flex: none; width: 42px; height: 22px; border-radius: 11px; background: rgb(255 255 255 / .18); position: relative; cursor: pointer; transition: background .15s; }
.abp .abp-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.abp .abp-switch.on { background: rgb(var(--ab-red, 214 40 57)); }
.abp .abp-switch.on::after { transform: translateX(20px); }
.abp .abp-swatches, .abp .abp-choices { display: flex; flex-wrap: wrap; gap: 10px; padding: 6px 2px; }
.abp .abp-swatch { width: 74px; text-align: center; cursor: pointer; font-size: 12px; opacity: .85; }
.abp .abp-swatch:hover { opacity: 1; }
.abp .abp-chip { height: 34px; border-radius: 3px 14px 3px 14px; border: 2px solid transparent; margin-bottom: 4px; }
.abp .abp-swatch.sel .abp-chip { border-color: #fff; box-shadow: 0 0 12px currentColor; }
.abp .abp-choice { padding: 7px 14px; cursor: pointer; border-radius: 3px 14px 3px 14px; background: rgb(255 255 255 / .07); border: 1px solid transparent; }
.abp .abp-choice.sel { background: rgb(var(--ab-red, 214 40 57) / .25); border-color: rgb(var(--ab-red, 214 40 57)); }
.abp .abp-slider { display: flex; align-items: center; gap: 10px; flex: none; width: 240px; }
.abp .abp-slider input { flex: 1; accent-color: rgb(var(--ab-red, 214 40 57)); }
.abp .abp-slider span { width: 46px; text-align: right; opacity: .8; }
.abp .abp-input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px 10px; color: #fff;
          background: rgb(0 0 0 / .35); border: 1px solid rgb(255 255 255 / .14); border-radius: 3px 14px 3px 14px; }
.abp .abp-input:focus { outline: none; border-color: rgb(var(--ab-red, 214 40 57)); }
.abp .abp-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.abp button.abp-btn { padding: 8px 16px; cursor: pointer; color: #fff; border: 1px solid rgb(var(--ab-red-hi, 245 78 96) / .6);
          border-radius: 3px 14px 3px 14px; background: rgb(var(--ab-red, 214 40 57) / .25); }
.abp button.abp-btn:hover { background: rgb(var(--ab-red, 214 40 57) / .45); }
#ab-zoom-hud { position: fixed; top: 48px; right: 20px; z-index: 99999; pointer-events: none;
               padding: 6px 14px; font-size: 13px; font-weight: 600; color: #fff;
               background: rgb(10 8 13 / .88); border: 1px solid rgb(var(--ab-red-hi, 245 78 96) / .8);
               border-radius: 3px 14px 3px 14px; box-shadow: 0 4px 16px rgb(0 0 0 / .45);
               opacity: 0; transform: translateY(-6px); transition: opacity .16s, transform .16s; }
#ab-zoom-hud.show { opacity: 1; transform: translateY(0); }
`;

function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in (props || {})) {
        if (k === "class") el.className = props[k];
        else if (k === "style") el.style.cssText = props[k];
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), props[k]);
        else el.setAttribute(k, props[k]);
    }
    for (const kid of kids) if (kid != null) el.append(kid);
    return el;
}

function addStyle(id, css) {
    if (BdApi.DOM && BdApi.DOM.addStyle) BdApi.DOM.addStyle(id, css);
    else BdApi.injectCSS(id, css);
}

function removeStyle(id) {
    if (BdApi.DOM && BdApi.DOM.removeStyle) BdApi.DOM.removeStyle(id);
    else BdApi.clearCSS(id);
}

function isNewerVersion(remote, local) {
    const a = String(remote || "").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    const b = String(local || "").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) > (b[i] || 0)) return true;
        if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return false;
}

function showToast(msg, type) {
    try {
        const fn = BdApi.UI && BdApi.UI.showToast ? BdApi.UI.showToast : BdApi.showToast;
        if (fn) fn(msg, { type: type || "info" });
    } catch (e) {}
}

/* ---------------------------------------------------------------- plugin */

module.exports = class BlackAstaCompanion {
    start() {
        this.s = loadSettings();
        this.stats = { headers: 0, coloured: 0, method: "" };
        this.title = { bar: null, buttons: [] };
        this.lastPing = 0;
        this.lastSwitch = Date.now();
        this.seenPings = new Set();

        addStyle(STYLE_ID, PANEL_CSS);
        try { applySettings(this.s); } catch (e) { console.warn("[BlackAstaCompanion] apply", e); }

        // Mention edge wave (unified from AntiMagicPulse + fixed against channel-switch false triggers)
        try {
            const stale = document.getElementById(WAVE_ID);
            if (stale) stale.remove();

            this.wave = document.createElement("div");
            this.wave.id = WAVE_ID;
            document.body.appendChild(this.wave);

            this.onAnimation = (e) => {
                try {
                    if (e.animationName !== PING_SIGNAL || !this.s.mentionWave) return;
                    const now = Date.now();
                    if (now - this.lastSwitch < SWITCH_GRACE_MS) return;

                    const msg = e.target && e.target.closest ? e.target.closest('li[id^="chat-messages-"]') : null;
                    if (msg && msg.id) {
                        if (this.seenPings.has(msg.id)) return;
                        this.seenPings.add(msg.id);
                        if (this.seenPings.size > 200) {
                            const oldest = this.seenPings.values().next().value;
                            this.seenPings.delete(oldest);
                        }
                    }

                    if (now - this.lastPing < COOLDOWN_MS) return;
                    this.lastPing = now;
                    this.triggerWave();
                } catch (err) {
                    console.warn("[BlackAstaCompanion] edge wave", err);
                }
            };
            document.addEventListener("animationstart", this.onAnimation, true);
        } catch (e) { console.warn("[BlackAstaCompanion] edge wave init", e); }

        // Debounced helper updates (MutationObserver + scroll + resize instead of constant polling)
        this.tick = () => {
            try { updateRoleHeaders(this.stats, this.s.roleColors); } catch (e) { console.warn("[BlackAstaCompanion] roles", e); }
            try { if (this.s.titleBar) tagTitleBar(this.title); else clearTitleBar(this.title); } catch (e) { console.warn("[BlackAstaCompanion] title bar", e); }
        };

        this.scheduleTick = (delay = 200) => {
            if (this.tickTimer) return;
            this.tickTimer = setTimeout(() => {
                this.tickTimer = null;
                this.tick();
            }, delay);
        };

        this.onScroll = () => this.scheduleTick(120);
        this.onResize = () => this.scheduleTick(250);
        document.addEventListener("scroll", this.onScroll, true);
        window.addEventListener("resize", this.onResize);

        const mount = document.getElementById("app-mount") || document.body;
        this.observer = new MutationObserver(() => this.scheduleTick(300));
        this.observer.observe(mount, { childList: true, subtree: true });

        // Browser-style Ctrl + Scroll / Ctrl + +/-/0 zoom with HUD percentage pill
        const staleHud = document.getElementById(ZOOM_HUD_ID);
        if (staleHud) staleHud.remove();
        this.zoomHud = document.createElement("div");
        this.zoomHud.id = ZOOM_HUD_ID;
        document.body.appendChild(this.zoomHud);

        this.onWheel = (e) => {
            if (!this.s.ctrlZoom || !e.ctrlKey || !e.deltaY) return;
            e.preventDefault();
            const step = e.deltaY < 0 ? 5 : -5;
            this.setZoom((Number(this.s.zoom) || 100) + step);
        };
        this.onKeyDown = (e) => {
            if (!this.s.ctrlZoom || !e.ctrlKey || e.altKey || e.shiftKey) return;
            if (e.key === "=" || e.key === "+") { e.preventDefault(); this.setZoom((Number(this.s.zoom) || 100) + 5); }
            else if (e.key === "-") { e.preventDefault(); this.setZoom((Number(this.s.zoom) || 100) - 5); }
            else if (e.key === "0") { e.preventDefault(); this.setZoom(100); }
        };
        window.addEventListener("wheel", this.onWheel, { passive: false });
        window.addEventListener("keydown", this.onKeyDown);

        this.tick();
        if (this.s.checkUpdates) {
            this.updateTimer = setTimeout(() => this.checkForUpdates(false), 6000);
        }
    }

    setZoom(next) {
        const clamped = Math.min(180, Math.max(60, Math.round(next / 5) * 5));
        this.change("zoom", clamped);
        if (this.zoomHud) {
            this.zoomHud.textContent = `Zoom: ${clamped}%`;
            this.zoomHud.classList.add("show");
            clearTimeout(this.zoomTimer);
            this.zoomTimer = setTimeout(() => this.zoomHud && this.zoomHud.classList.remove("show"), 1200);
        }
    }

    async checkForUpdates(manual) {
        try {
            const fetcher = (BdApi.Net && BdApi.Net.fetch) ? BdApi.Net.fetch : window.fetch;
            const res = await fetcher(REPO_API_LATEST, { headers: { "Accept": "application/vnd.github+json" } });
            if (!res || !res.ok) {
                if (manual) showToast("Could not check GitHub releases right now.", "warning");
                return;
            }
            const data = await res.json();
            const tag = data && data.tag_name ? data.tag_name : "";
            const themeAddon = BdApi.Themes && BdApi.Themes.get ? BdApi.Themes.get("Black Asta") : null;
            const themeVer = themeAddon && themeAddon.version ? themeAddon.version : "1.8.1";
            const hasUpdate = isNewerVersion(tag, themeVer) || isNewerVersion(tag, PLUGIN_VERSION);
            if (hasUpdate) {
                showToast(`Black Asta ${tag} is available on GitHub Releases!`, "info");
            } else if (manual) {
                showToast(`You are up to date (Release ${tag || PLUGIN_VERSION}).`, "success");
            }
        } catch (e) {
            if (manual) showToast("Update check failed.", "error");
        }
    }

    onSwitch() {
        this.lastSwitch = Date.now();
        this.scheduleTick(150);
    }

    triggerWave() {
        if (!this.wave) return;
        this.wave.classList.remove("ab-on");
        void this.wave.offsetWidth;
        this.wave.classList.add("ab-on");
    }

    stop() {
        clearTimeout(this.tickTimer);
        clearTimeout(this.saveTimer);
        clearTimeout(this.zoomTimer);
        clearTimeout(this.updateTimer);
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        document.removeEventListener("scroll", this.onScroll, true);
        window.removeEventListener("resize", this.onResize);
        window.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("keydown", this.onKeyDown);
        document.removeEventListener("animationstart", this.onAnimation, true);
        if (this.wave) {
            this.wave.remove();
            this.wave = null;
        }
        if (this.zoomHud) {
            this.zoomHud.remove();
            this.zoomHud = null;
        }
        clearTitleBar(this.title);
        for (const header of document.querySelectorAll(GROUP_SELECTOR)) paintHeader(header, "");
        clearApplied();
        removeStyle(STYLE_ID);
        if (this.seenPings) this.seenPings.clear();
    }

    change(key, value, rerender) {
        this.s[key] = value;
        applySettings(this.s);
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => saveSettings(this.s), 250);
        if (key === "roleColors" || key === "titleBar") this.tick();
        if (rerender) rerender();
    }

    getSettingsPanel() {
        const root = h("div", { class: "abp" });
        const render = () => {
            while (root.firstChild) root.removeChild(root.firstChild);
            const s = this.s;
            const set = (k, v) => this.change(k, v, render);

            const toggle = (key, label, note) => h("div", { class: "abp-row" },
                h("div", { class: "abp-label" }, label, note ? h("small", {}, note) : null),
                h("div", { class: "abp-switch" + (s[key] ? " on" : ""), role: "switch", "aria-checked": String(!!s[key]), onclick: () => set(key, !s[key]) }));

            const slider = (key, label, note, min, max, unit) => {
                const out = h("span", {}, s[key] + unit);
                const input = h("input", { type: "range", min: String(min), max: String(max), value: String(s[key]) });
                input.addEventListener("input", () => { out.textContent = input.value + unit; this.change(key, Number(input.value)); });
                return h("div", { class: "abp-row" }, h("div", { class: "abp-label" }, label, h("small", {}, note)), h("div", { class: "abp-slider" }, input, out));
            };

            const swatches = h("div", { class: "abp-swatches" });
            for (const id in PALETTES) {
                const p = PALETTES[id];
                swatches.append(h("div", { class: "abp-swatch" + (s.palette === id ? " sel" : ""), title: p.note, "data-palette": id, onclick: () => set("palette", id) },
                    h("div", { class: "abp-chip", style: `background: linear-gradient(135deg, rgb(${p.hi}), rgb(${p.deep})); color: rgb(${p.red});` }), p.name));
            }

            const choices = h("div", { class: "abp-choices" });
            for (const [id, name] of [["artwork", "Black Clover artwork"], ["clover", "Drawn gold clover"], ["circle", "Magic circle"], ["default", "Discord logo"]]) {
                choices.append(h("div", { class: "abp-choice" + (s.homeIcon === id ? " sel" : ""), "data-home": id, onclick: () => set("homeIcon", id) }, name));
            }

            const wpChoices = h("div", { class: "abp-choices" });
            for (const [id, name] of [["github", "GitHub (Default)"], ["uupload", "uupload Mirror"], ["custom", "Custom URL"]]) {
                wpChoices.append(h("div", { class: "abp-choice" + (s.wallpaperSource === id ? " sel" : ""), onclick: () => set("wallpaperSource", id) }, name));
            }

            let customInput = null;
            if (s.wallpaperSource === "custom") {
                const input = h("input", {
                    class: "abp-input",
                    type: "url",
                    placeholder: "https://example.com/wallpaper.jpg",
                    value: s.customWallpaper || "",
                });
                input.addEventListener("change", () => this.change("customWallpaper", input.value.trim()));
                customInput = h("div", { class: "abp-row", style: "display:block;" },
                    h("div", { class: "abp-label" }, "Custom wallpaper URL", h("small", {}, "Must start with http:// or https://")),
                    input);
            }

            root.append(
                h("h2", {}, "Black Asta"),
                h("div", { class: "abp-sub" }, "Everything here applies instantly and is remembered."),
                h("h3", {}, "Palette"),
                h("div", { class: "abp-sub" }, "Anti-Magic is Asta's own look. The others \"borrow\" a friend's magic attribute."),
                swatches,
                h("h3", {}, "Home button icon"), choices,
                h("h3", {}, "Wallpaper source"), wpChoices, customInput,
                h("h3", {}, "Effects"),
                toggle("embers", "Floating embers", "Turn off to save GPU."),
                toggle("slash", "Anti-magic slash", "A blade of light cuts across buttons, server icons and tabs on hover."),
                toggle("dispel", "Anti-magic field", "Hides other people's avatar decorations, nameplates and profile effects."),
                toggle("mentionWave", "Mention wave", "Crimson wave from the window edge when a new message mentions you."),
                h("h3", {}, "Helpers"),
                toggle("roleColors", "Role title colours", "Role titles in the members list use the server's role colour."),
                toggle("titleBar", "Title bar styling", "Lets the theme style the top bar and the window buttons."),
                toggle("ctrlZoom", "Ctrl + Scroll zoom", "Browser-style zoom with Ctrl + Mouse Wheel (and Ctrl + / - / 0)."),
                slider("zoom", "UI Zoom", "Adjust Discord interface zoom level.", 60, 180, "%"),
                toggle("checkUpdates", "Auto-check GitHub updates", "Checks GitHub Releases on startup and notifies when a new version is out."),
                h("h3", {}, "Glass"),
                slider("panelOpacity", "Panel opacity", "Lower shows more artwork, higher is easier to read.", 10, 70, "%"),
                slider("blur", "Glass blur", "0 = sharp artwork behind panels, also lighter on the GPU.", 0, 20, "px"),
                slider("dim", "Wallpaper dimming", "Dark veil over the artwork.", 0, 50, "%"),
                h("div", { class: "abp-actions" },
                    h("button", { class: "abp-btn", onclick: () => this.triggerWave() }, "Test mention wave"),
                    h("button", { class: "abp-btn", onclick: () => this.checkForUpdates(true) }, "Check for updates"),
                    h("button", { class: "abp-btn", onclick: () => { this.s = Object.assign({}, DEFAULTS); applySettings(this.s); saveSettings(this.s); this.tick(); render(); } }, "Reset everything to default")
                )
            );
        };
        render();
        return root;
    }
};
