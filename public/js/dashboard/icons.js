/**
 * @file public/js/dashboard/icons.js
 * @brief Small SVG icon factory and insertion helpers used by the dashboard UI.
 *
 * This file centralizes all SVG icon creation in a single place and exposes
 * a minimal API to create or insert icons into DOM elements. Use `icons.createIcon`
 * to obtain an `SVGElement` node and `icons.insertIcon` to replace an element's
 * children with a generated icon.
 *
 * @author Syed Taha
 */
(function (global) {
    'use strict';
    const ns = 'http://www.w3.org/2000/svg';

    /**
     * @brief Create a basic empty SVG element for use by icon factories.
     * @param {number} [width=16] - The SVG width in px.
     * @param {number} [height=16] - The SVG height in px.
     * @return {SVGSVGElement} A new SVG element with viewBox 0 0 24 24.
     */
    function makeSvg(width = 16, height = 16) {
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        return svg;
    }

    /**
     * @brief Create a single SVG path element with common attributes.
     * @param {string} d - The `d` attribute for the path (SVG path data).
     * @param {string} [color='#484B6A'] - Stroke color of the path. Pass 'currentColor' to inherit.
     * @param {number} [strokeWidth=2] - Stroke width used by the path.
     * @param {Object} [opts={}] - Extra options for path creation. Recognized: `fill`.
     * @return {SVGPathElement} The configured path element.
     */
    function makePath(d, color = '#484B6A', strokeWidth = 2, opts = {}) {
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', opts.fill || 'none');
        p.setAttribute('stroke', color);
        p.setAttribute('stroke-width', String(strokeWidth));
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        return p;
    }

    /**
     * @brief Icon factory mapping.
     * @type {Object.<string, function(string):SVGSVGElement>}
     * Each entry is a function taking a color string and returning an SVG node.
     */
    const iconDefs = {
        folder: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M3 7c0-1.1.9-2 2-2h4l2 2h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7z', color));
            return svg;
        },
        file: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8z', color));
            svg.appendChild(makePath('M14 2v6h6', color));
            return svg;
        },
        eye: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', color));
            svg.appendChild(makePath('M12 15a3 3 0 100-6 3 3 0 000 6z', color));
            return svg;
        },
        download: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', color));
            svg.appendChild(makePath('M7 10l5 5 5-5', color));
            svg.appendChild(makePath('M12 15V3', color));
            return svg;
        },
        chev: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M9 18l6-6-6-6', color));
            return svg;
        },
        pencil: (color) => {
            const svg = makeSvg();
            // Combined pencil body and tip
            svg.appendChild(makePath('M3 21v-3l12-12 3 3L6 21H3z', color));
            svg.appendChild(makePath('M18.5 5.5l-1 1', color));
            return svg;
        },
        trash: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M3 6h18', color));
            svg.appendChild(makePath('M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6', color));
            svg.appendChild(makePath('M10 6V4h4v2', color));
            return svg;
        },
        refresh: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M21 12a9 9 0 1 1-3-6.71', color));
            svg.appendChild(makePath('M21 3v6h-6', color));
            return svg;
        },
        plus: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M12 5v14', color));
            svg.appendChild(makePath('M5 12h14', color));
            return svg;
        },
        upload: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', color));
            svg.appendChild(makePath('M7 10l5-5 5 5', color));
            svg.appendChild(makePath('M12 5v14', color));
            return svg;
        },
        close: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M6 6 L18 18', color));
            svg.appendChild(makePath('M6 18 L18 6', color));
            return svg;
        },
        user: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', color));
            svg.appendChild(makePath('M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', color));
            return svg;
        },
        chevronDown: (color) => {
            const svg = makeSvg();
            svg.appendChild(makePath('M6 9l6 6 6-6', color));
            return svg;
        }
    };

    /**
     * @brief Create an icon SVG element by name.
     * @param {string} name - Icon name (folder, file, eye, download, chev, pencil, trash, refresh, plus, upload, close, user, chevronDown)
     * @param {string} [color] - Stroke color for the icon; pass `currentColor` to inherit.
     * @return {SVGSVGElement} Generated icon SVG element or an empty placeholder when name is not known.
     */
    function createIcon(name, color) {
        const fn = iconDefs[name];
        if (!fn) {
            // Return a small empty SVG placeholder
            const svg = makeSvg(16, 16);
            return svg;
        }
        return fn(color || '#484B6A');
    }

    /**
     * @brief Insert a generated icon into a DOM element, replacing any children.
     * @param {Element} el - The element to insert into (e.g. a <button> or a <span>).
     * @param {string} name - Icon name from `iconDefs`.
     * @param {string} [color] - Optional color to pass to the generated icon.
     */
    function insertIcon(el, name, color) {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(createIcon(name, color));
    }

    global.icons = global.icons || {};
    global.icons.createIcon = createIcon;
    global.icons.insertIcon = insertIcon;

})(this);
