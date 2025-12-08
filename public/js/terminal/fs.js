/*
 * @file terminal/fs.js
 * @brief Demo filesystem API that will later be replaced by real backend endpoints.
 * @author Syed Taha
 *
 * This module exposes a small set of functions and a demo in-memory `fileSystem` to
 * emulate server-side file operations. For the browser demo these functions are
 * attached to the global window object for easy access from the terminal client.
 *
 * NOTE: This is NOT a secure backend. This module is only for local demo/testing.
 */

(function (global) {
  'use strict';

  /**
   * Simple demo in-memory file system.
   * Equivalent to a server-side filesystem for now; will be replaced later.
   * @type {Object}
   */
  const fileSystem = { type: 'dir', name: '/', children: {
    'example.txt': { type: 'file', content: 'This is an example file', size: 1024 },
    'document.txt': { type: 'file', content: 'Document contents', size: 2048 },
  }};

  /**
   * Resolve a path (absolute or relative) into a canonical absolute path.
   * Handles '.' and '..' parts and empty segments. Relative paths are resolved
   * against a provided currentPath argument.
   * @param {string} p - Either an absolute (`/some/path`) or a relative path.
   * @param {string} currentPath - The current working directory used for relative paths.
   * @return {string} A canonical absolute path (leading '/').
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
   * Find a node in the in-memory `fileSystem` tree given an absolute path.
   * @param {string} path - Absolute path to resolve. Example: "/my/dir/file.txt"
   * @return {(Object|null)} Returns the object { node, parent, name } when found,
   * or null when the path does not exist in the demo filesystem.
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
   * List directory contents.
   * @param {string} path - Absolute path pointing to a directory.
   * @return {(Array|null)} Array of { name, type, size } objects or null when not a directory
   */
  function listDir(path) {
    const r = getNode(path);
    if (!r) return null;
    if (r.node.type !== 'dir') return null;
    return Object.entries(r.node.children || {}).map(([k, v]) => ({ name: k, type: v.type, size: v.size || 0 }));
  }

  /**
   * Make directory in demo fs.
   * @param {string} path - Absolute or relative path.
   * @param {string} currentPath - The current working directory for relative paths.
   * @return {boolean}
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
   * Add a file to the demo fs.
   * @param {string} path - Absolute or relative path.
   * @param {string} content - Text content to store in the file.
   * @param {string} currentPath - Current working directory for relative paths.
   * @return {boolean}
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
   * Remove a file or directory from demo fs.
   * @param {string} path - Absolute or relative path.
   * @param {string} currentPath - Current working directory for relative paths.
   * @return {boolean}
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
   * Read a file contents from demo fs.
   * @param {string} path - Absolute or relative path.
   * @param {string} currentPath - Current working directory for relative paths.
   * @return {(string|null)} File contents or null if not a file or not found.
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
