/**
 * @file public/js/dashboard/fs.js
 * @brief API-based filesystem interface for the distributed file storage system.
 *
 * This module replaces the in-memory demo filesystem with actual API calls
 * to the backend server. It provides the same interface as before but now
 * connects to the real distributed storage system.
 *
 * @author Syed Taha
 */

(function (global) {
    'use strict';

    // Current user's working directory ID (user's root directory by default)
    let currentDirId = 0; // Will be set to user's root directory ID after login
    let userRootId = null; // Store the user's root directory ID when determined

    /**
     * @brief Resolve a path to an absolute canonical path.
     * For API-based system, this works with virtual paths but we track directory IDs
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
     * @brief Find a node in the API-based file system.
     * This now makes an API call to get item information
     *
     * Returns the node, its parent, and the node name for the requested path.
     * This is more complex with an API backend since paths map to IDs
     *
     * @param {string} path - Absolute path to resolve (e.g. `/my/dir/file.txt`).
     * @return {(Object|null)} Object with { node, parent, name } or `null` when
     *                          the path does not exist.
     */
    async function getNode(path) {
        // For the API-based system, we need to implement path resolution differently
        // This is a simplified version - in a real system, we'd need to resolve path to ID
        console.log("getNode not fully implemented in API version yet, path:", path);
        return null;
    }

    /**
     * @brief List entries in a directory via API.
     * @param {number} parentID - ID of the parent directory
     * @return {Promise<Array|null>} Array of entries in the directory or `null` on error.
     */
    async function listDirApi(parentID) {
        try {
            // If parentID is 0 or 1 and we have a user root directory, use the user's root directory
            let actualParentID = parentID;
            if ((parentID === 0 || parentID === 1) && userRootId !== null) {
                actualParentID = userRootId;
            }

            const response = await fetch(`/api/files/list?parentID=${actualParentID}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                // If this is the first time getting the user's root directory, store it
                if ((parentID === 0 || parentID === 1) && userRootId === null && result.data.length >= 0) {
                    // We need to determine the user's root directory - for now, we'll set it to the first
                    // available directory if we don't know it yet
                    if (result.data.length > 0) {
                        // Look for a directory that could be the root (e.g., one with no parent or a 'Home' directory)
                        const rootDir = result.data.find(item => item.Name === 'Home') || result.data[0];
                        if (rootDir && rootDir.type === 'folder') {
                            userRootId = rootDir.id;
                            currentDirId = rootDir.id;
                        }
                    }
                }

                // Map API response to the format expected by the UI
                return result.data.map(item => ({
                    name: item.Name,
                    type: item.ItemType.toLowerCase(),
                    size: item.Size || 0,
                    id: item.ItemID
                }));
            } else {
                console.error('API Error:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Network error:', error);
            return null;
        }
    }

    /**
     * @brief Create a directory via API.
     * @param {string} name - Name of the new directory.
     * @param {number} parentID - ID of the parent directory.
     * @return {Promise<boolean>} True when directory was created, false on error.
     */
    async function mkdirApi(name, parentID) {
        try {
            const response = await fetch('/api/files/mkdir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    parentID: parentID
                })
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Network error:', error);
            return false;
        }
    }

    /**
     * @brief Upload a file via API.
     * @param {string} filename - Name of the file.
     * @param {string} content - Content of the file.
     * @param {number} parentID - ID of the parent directory.
     * @return {Promise<boolean>} True when file was uploaded, false on error.
     */
    async function uploadFileApi(filename, content, parentID) {
        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: filename,
                    content: content,
                    parentID: parentID
                })
            });
            
            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Network error:', error);
            return false;
        }
    }

    /**
     * @brief Remove a file or directory via API.
     * @param {number} itemID - ID of the item to remove.
     * @return {Promise<boolean>} True if the item was removed, false otherwise.
     */
    async function rmNodeApi(itemID) {
        try {
            const response = await fetch(`/api/files/delete/${itemID}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Network error:', error);
            return false;
        }
    }

    /**
     * @brief Read text content of a file via API.
     * @param {number} fileID - ID of the file to read.
     * @return {Promise<string|null>} File contents or `null` if the file does not exist or error occurs.
     */
    async function readFileApi(fileID) {
        try {
            const response = await fetch(`/api/files/read?id=${fileID}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                // Return the file content if available, otherwise return metadata
                if (result.data.content) {
                    return result.data.content;
                } else {
                    return `File: ${result.data.name}, Size: ${result.data.size} bytes, Chunks: ${result.data.chunkCount}`;
                }
            } else {
                console.error('API Error:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Network error:', error);
            return null;
        }
    }

    // Keep the original sync functions for backward compatibility with UI
    // But update them to use async API calls internally
    
    /**
     * @brief List entries in a directory.
     * @param {string} path - Absolute path referring to a directory.
     * @return {(Array|null)} Array of entries in the directory. Each entry is
     *                        { name, type, size } or `null` when the path
     *                        does not reference a directory.
     */
    function listDir(path) {
        console.warn("listDir should be called with directory ID, not path in API version");
        // In a real implementation, this would need to work with directory IDs
        // For now, return a placeholder
        return [];
    }

    /**
     * @brief Create a directory.
     * @param {string} path - Path to the new directory (not used in API version).
     * @param {string} currentPath - Current path (not used in API version).
     * @return {boolean} True when directory was created, false on error.
     */
    function mkdirCmd(path, currentPath = '/') {
        console.warn("mkdirCmd should be replaced with async mkdirApi in UI");
        // This function exists for compatibility with the UI, but real operation should be async
        return false;
    }

    /**
     * @brief Add or replace a file.
     * @param {string} path - Path for the file (not used in API version).
     * @param {string} [content=''] - Text to store in the file.
     * @param {string} [currentPath='/'] - Current working directory.
     * @return {boolean} True when file was written, false on error.
     */
    function addFile(path, content = '', currentPath = '/') {
        console.warn("addFile should be replaced with async uploadFileApi in UI");
        // This function exists for compatibility with the UI, but real operation should be async
        return false;
    }

    /**
     * @brief Remove a node (file or directory).
     * @param {string} path - Path to the node (not used in API version).
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {boolean} True if the node was removed, false otherwise.
     */
    function rmNode(path, currentPath = '/') {
        console.warn("rmNode should be replaced with async rmNodeApi in UI");
        // This function exists for compatibility with the UI, but real operation should be async
        return false;
    }

    /**
     * @brief Read text content of a file.
     * @param {string} path - Path to the file (not used in API version).
     * @param {string} [currentPath='/'] - Current working directory for relative paths.
     * @return {(string|null)} File contents or `null` if the path does not point
     *                        to a regular file or does not exist.
     */
    function readFile(path, currentPath = '/') {
        console.warn("readFile should be replaced with async readFileApi in UI");
        // This function exists for compatibility with the UI, but real operation should be async
        return null;
    }

    // Expose both the original interface (for UI compatibility) and the new API functions
    global.fs = {
        // Original synchronous interface (for UI compatibility)
        resolvePath,
        getNode,
        listDir,
        mkdirCmd,
        addFile,
        rmNode,
        readFile,

        // New API-based functions
        listDirApi,
        mkdirApi,
        uploadFileApi,
        rmNodeApi,
        readFileApi,

        // Current directory tracking
        getCurrentDirId: () => currentDirId,
        setCurrentDirId: (id) => { currentDirId = id; },
        getUserRootId: () => userRootId,
        setUserRootId: (id) => { userRootId = id; currentDirId = id; }
    };

})(this);