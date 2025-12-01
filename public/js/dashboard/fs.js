/**
 * @file public/js/dashboard/fs.js
 * @brief Demo filesystem API used by the in-browser dashboard and terminal.
 *
 * This module provides an in-memory demo filesystem for the UI and a small
 * API similar to server-side filesystem operations. The library is intended for
 * demos and testing only and should be replaced with backend endpoints in
 * production deployments.
 *
 * @author Syed Taha
 */

(function (global) {
    'use strict';

    /**
     * @brief Simple demo in-memory file system.
     * @var {Object}
     * This object is used to emulate directories and files in browser memory.
     */
    const fileSystem = {
        type: 'dir', name: '/', children: {
            'example.txt': { type: 'file', content: 'This is an example file', size: 1024 },
            'document.txt': { type: 'file', content: 'Document contents', size: 2048 },
            'myfolder': {
                type: 'dir', name: 'myfolder', children: {
                    'notes.txt': { type: 'file', content: 'These are some notes.', size: 512 },
                    'subfolder': {
                        type: 'dir', name: 'subfolder', children: {
                            'todo.txt': { type: 'file', content: '1. Buy milk\n2. Walk dog', size: 256 },
                        }
                    },
                }
            },
        }
    };

    /**
     * @brief Resolve a path to an absolute canonical path.
     *
     * Accepts both absolute and relative paths. The function handles `.` and `..`
     * path segments and resolves relative paths against the `currentPath`.
     *
     * @param {string} p - Absolute or relative path to resolve.
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {string} Canonical absolute path (always starts with `/`).
     */
    function resolvePath(p, currentPath = '/') {
        if (!p) return currentPath;
        let path;
        if (p.startsWith('/')) path = p;
        else path = currentPath.replace(/\/$/, '') + '/' + p;

        const parts = path.split('/').filter(Boolean);
        const out = [];
        for (const part of parts) {
            if (part === '.') continue;
            if (part === '..') out.pop();
            else out.push(part);
        }
        return '/' + out.join('/');
    }

    /**
     * @brief Find a node in the in-memory `fileSystem` tree.
     *
     * Returns the node, its parent, and the node name for the requested path.
     *
     * @param {string} path - Absolute path to resolve (e.g. `/my/dir/file.txt`).
     * @return {(Object|null)} Object with { node, parent, name } or `null` when
     *                          the path does not exist.
     */
    function getNode(path) {
        if (path === '/') return { node: fileSystem, parent: null, name: '/' };
        const parts = path.split('/').filter(Boolean);
        let node = fileSystem;
        let parent = null;
        let name = '/';
        for (const p of parts) {
            if (!node || node.type !== 'dir' || !node.children) return null;
            parent = node;
            node = node.children[p];
            name = p;
        }
        if (!node) return null;
        return { node, parent, name };
    }

    /**
     * @brief List entries in a directory.
     *
     * @param {string} path - Absolute path referring to a directory.
     * @return {(Array|null)} Array of entries in the directory. Each entry is
     *                        { name, type, size } or `null` when the path
     *                        does not reference a directory.
     */
    function listDir(path) {
        const r = getNode(path);
        if (!r) return null;
        if (r.node.type !== 'dir') return null;
        return Object.entries(r.node.children || {}).map(([k, v]) => ({ name: k, type: v.type, size: v.size || 0 }));
    }

    /**
     * @brief Create a directory in the demo filesystem.
     *
     * @param {string} path - Absolute or relative path to the new directory.
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {boolean} True when directory was created, false on error.
     */
    function mkdirCmd(path, currentPath = '/') {
        const resolved = resolvePath(path, currentPath);
        const parentPath = resolved.replace(/\/[^^/]+$/, '') || '/';
        const name = resolved.split('/').filter(Boolean).pop();
        const parent = getNode(parentPath);
        if (!parent || parent.node.type !== 'dir') return false;
        if (parent.node.children[name]) return false;
        parent.node.children[name] = { type: 'dir', name, children: {} };
        return true;
    }

    /**
     * @brief Add or replace a file in the demo filesystem.
     *
     * The function writes text content for the specified path and updates the
     * reported file size automatically. Parent directories are expected to
     * already exist.
     *
     * @param {string} path - Absolute or relative path for the file.
     * @param {string} [content=''] - Text to store in the file.
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {boolean} True when file was written, false on error.
     */
    function addFile(path, content = '', currentPath = '/') {
        const resolved = resolvePath(path, currentPath);
        const parentPath = resolved.replace(/\/[^^/]+$/, '') || '/';
        const name = resolved.split('/').filter(Boolean).pop();
        const parent = getNode(parentPath);
        if (!parent || parent.node.type !== 'dir') return false;
        parent.node.children[name] = { type: 'file', content: content, size: (content || '').length };
        return true;
    }

    /**
     * @brief Remove a node (file or directory) from the demo filesystem.
     *
     * Directories are removed by deleting the key from their parent node.
     *
     * @param {string} path - Absolute or relative path to the node.
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {boolean} True if the node was removed, false otherwise.
     */
    function rmNode(path, currentPath = '/') {
        const resolved = resolvePath(path, currentPath);
        const parts = resolved.split('/').filter(Boolean);
        const name = parts.pop();
        const parentPath = '/' + parts.join('/');
        const parent = getNode(parentPath);
        if (!parent || parent.node.type !== 'dir') return false;
        if (!parent.node.children[name]) return false;
        delete parent.node.children[name];
        return true;
    }

    /**
     * @brief Read text content of a file in the demo filesystem.
     *
     * @param {string} path - Absolute or relative path to the file.
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {(string|null)} File contents or `null` if the path does not point
     *                        to a regular file or does not exist.
     */
    function readFile(path, currentPath = '/') {
        const resolved = resolvePath(path, currentPath);
        const r = getNode(resolved);
        if (!r || r.node.type !== 'file') return null;
        return r.node.content || '';
    }

    // Expose the API under a single namespace `fs`.
    // Clients should use `fs.resolvePath` etc. (no backwards compatibility globals).
    global.fs = {
        fileSystem,
        resolvePath,
        getNode,
        listDir,
        mkdirCmd,
        addFile,
        rmNode,
        readFile,
    };

})(this);
