/**
 * @file public/js/dashboard/editor.js
 * @brief File editor and media viewer for the distfs dashboard
 *
 * Provides a modal editor with contenteditable for text files and
 * preview capabilities for images and videos.
 *
 * @author Syed Taha
 */

(function (global) {
    'use strict';

    class FileEditor {
        constructor() {
            // Modal elements
            this.modal = document.getElementById('editorModal');
            this.filenameEl = document.getElementById('editorFilename');
            this.modeBadge = document.getElementById('editorModeBadge');
            this.ownerBadge = document.getElementById('editorOwnerBadge');
            this.accessBadge = document.getElementById('editorAccessBadge');
            this.saveBtn = document.getElementById('editorSave');
            this.closeBtn = document.getElementById('editorClose');
            this.statusEl = document.getElementById('editorStatus');
            this.infoEl = document.getElementById('editorInfo');

            // Editor elements
            this.textEditor = document.getElementById('textEditor');
            this.mediaPreview = document.getElementById('mediaPreview');
            this.imagePreview = document.getElementById('imagePreview');
            this.videoPreview = document.getElementById('videoPreview');
            this.unsupportedPreview = document.getElementById('unsupportedPreview');
            this.fileTypeInfo = document.getElementById('fileTypeInfo');

            // State
            this.currentFile = null;
            this.originalContent = '';
            this.mode = 'text'; // 'text', 'image', 'video', 'unsupported'
            this.isDirty = false;

            this.init();
        }

        /**
         * Initialize event listeners
         */
        init() {
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (!this.isOpen()) return;

                // Ctrl/Cmd + S to save (only when editor is editable)
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (this.mode === 'text' && this.textEditor && this.textEditor.isContentEditable) {
                        this.save();
                    }
                }

                // Escape to close
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.close();
                }
            });

            // Button handlers
            this.saveBtn.addEventListener('click', () => this.save());
            this.closeBtn.addEventListener('click', () => this.close());

            // Track changes in text editor
            this.textEditor.addEventListener('input', () => {
                this.isDirty = true;
                this.updateStatus('Modified');
            });

            // Close modal when clicking outside
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        /**
         * Open a file in the editor/viewer
         * @param {Object} file - File object with {id, name, type}
         * @param {string} content - File content or URL for media
         */
        async open(file, content) {
            // Determine filename first, provide fallbacks for different API shapes
            const filename = file && (file.name || file.Name) ? (file.name || file.Name) : 'untitled';
            // Ensure currentFile has normalized 'id' and 'name' fields
            this.currentFile = Object.assign({}, file, { id: file.ItemID || file.id, name: filename });
            this.originalContent = content;
            this.isDirty = false;
            const ext = this.getFileExtension(filename).toLowerCase();
            this.mode = this.determineMode(ext);

            // Update UI
            this.filenameEl.textContent = filename;
            this.updateModeBadge();
            this.updateOwnerAccessBadges();
            this.updateInfo();

            // Hide all preview elements
            this.textEditor.style.display = 'none';
            this.mediaPreview.style.display = 'none';
            this.imagePreview.style.display = 'none';
            this.videoPreview.style.display = 'none';
            this.unsupportedPreview.style.display = 'none';

            // Determine permissions from file object where available
            this.fileAccess = {
                ownerName: file && (file.ownerName || file.OwnerName) ? (file.ownerName || file.OwnerName) : null,
                accessLevel: file && (file.accessLevel || file.AccessLevel) ? (file.accessLevel || file.AccessLevel) : null
            };

            // Update owner & access badges regardless of mode so the editor header shows them
            const _isOwner = !this.fileAccess.ownerName || this.fileAccess.ownerName === window.username;
            const _accessLevel = this.fileAccess.accessLevel || (_isOwner ? 'Admin' : 'Read');
            this.updateOwnerAccessBadges(_isOwner || _accessLevel === 'Admin' || _accessLevel === 'Write', _accessLevel, this.fileAccess.ownerName);

            // Show appropriate editor/viewer
            switch (this.mode) {
                case 'text':
                    // For text files, set contentEditable and save visibility according to access
                    this.openTextEditor(content);
                    break;
                case 'image':
                    this.openImagePreview(file.id);
                    break;
                case 'video':
                    this.openVideoPreview(file.id);
                    break;
                default:
                    this.openUnsupported(ext);
            }

            // Show modal
            this.modal.style.display = 'flex';

            if (this.mode === 'text') {
                setTimeout(() => this.textEditor.focus(), 100);
            }

            this.updateStatus('Ready');
        }

        /**
         * Open text editor mode
         */
        openTextEditor(content) {
            this.textEditor.style.display = 'block';
            this.textEditor.textContent = content;
            // Determine editability
            const isOwner = !this.fileAccess.ownerName || this.fileAccess.ownerName === window.username;
            const accessLevel = this.fileAccess.accessLevel || (this.fileAccess.ownerName ? 'Read' : 'Admin');
            const canEdit = isOwner || accessLevel === 'Write' || accessLevel === 'Admin';
            this.textEditor.contentEditable = canEdit;
            this.saveBtn.style.display = canEdit ? 'inline-block' : 'none';
            // Owner/access badges and read-only indicator
            this.updateOwnerAccessBadges(canEdit, accessLevel, this.fileAccess.ownerName);
            if (!canEdit) this.updateStatus('Read-only');
        }

        /**
         * Open image preview mode
         */
        openImagePreview(fileId) {
            this.mediaPreview.style.display = 'flex';
            this.imagePreview.style.display = 'block';
            this.imagePreview.src = `/api/files/read?id=${fileId}&download=1`;
            this.saveBtn.style.display = 'none';
            this.updateStatus('Preview mode');
        }

        /**
         * Open video preview mode
         */
        openVideoPreview(fileId) {
            this.mediaPreview.style.display = 'flex';
            this.videoPreview.style.display = 'block';
            this.videoPreview.src = `/api/files/read?id=${fileId}&download=1`;
            this.saveBtn.style.display = 'none';
            this.updateStatus('Preview mode');
        }

        /**
         * Open unsupported file type view
         */
        openUnsupported(ext) {
            this.mediaPreview.style.display = 'flex';
            this.unsupportedPreview.style.display = 'block';
            this.fileTypeInfo.textContent = `File type: .${ext}`;
            this.saveBtn.style.display = 'none';
            this.updateStatus('Preview not available');
        }

        /**
         * Save the current file
         */
        async save() {
            if (this.mode !== 'text') {
                return;
            }

            const content = this.textEditor.textContent;

            if (content === this.originalContent) {
                this.updateStatus('No changes to save');
                return;
            }

            this.updateStatus('Saving...');
            this.saveBtn.disabled = true;

            try {
                // Use the new dedicated edit endpoint instead of uploading a new file
                const response = await fetch(`/api/files/edit/${this.currentFile.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: content
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Update the current file ID in case it changed (the edit endpoint returns a new ID)
                    this.currentFile.id = result.data.fileID;
                    // Only update the name if provided by the backend (avoid setting to undefined)
                    if (typeof result.data.name !== 'undefined') {
                        this.currentFile.name = result.data.name;
                    }

                    this.originalContent = content;
                    this.isDirty = false;
                    this.updateStatus('Saved successfully');

                    // Invalidate caches and refresh file browser
                    try {
                        if (window.fs && typeof window.fs.invalidateFile === 'function') {
                            window.fs.invalidateFile(this.currentFile.id);
                        }
                        const parentID = (typeof result.data.parentID !== 'undefined') ? result.data.parentID : null;
                        if (parentID && window.fs && typeof window.fs.invalidateDir === 'function') {
                            window.fs.invalidateDir(parentID);
                        } else if (window.fs && typeof window.fs.invalidateAll === 'function') {
                            window.fs.invalidateAll();
                        }
                    } catch (e) { /* ignore cache invalidation errors */ }
                    // Refresh file browser
                    if (typeof window.renderFileBrowser === 'function') {
                        setTimeout(() => window.renderFileBrowser(), 100);
                    }
                } else {
                    this.updateStatus('Save failed: ' + result.error);
                }
            } catch (error) {
                this.updateStatus('Error: ' + error.message);
            } finally {
                this.saveBtn.disabled = false;
            }
        }

        /**
         * Close the editor
         */
        close() {
            // Check for unsaved changes
            if (this.isDirty && this.mode === 'text') {
                const content = this.textEditor.textContent;
                if (content !== this.originalContent) {
                    if (!confirm('You have unsaved changes. Close anyway?')) {
                        return;
                    }
                }
            }

            // Clean up media sources
            if (this.videoPreview.src) {
                this.videoPreview.pause();
                this.videoPreview.src = '';
            }
            if (this.imagePreview.src) {
                this.imagePreview.src = '';
            }

            // Reset state
            this.modal.style.display = 'none';
            this.currentFile = null;
            this.originalContent = '';
            this.isDirty = false;
            this.textEditor.textContent = '';
        }

        /**
         * Update the mode badge
         */
        updateModeBadge() {
            const badges = {
                'text': 'Text Editor',
                'image': 'Image Preview',
                'video': 'Video Preview',
                'unsupported': 'Preview'
            };
            this.modeBadge.textContent = badges[this.mode] || 'Viewer';
        }

        /**
         * Update owner and access badges
         */
        updateOwnerAccessBadges(canEdit = true, accessLevel = null, ownerName = null) {
            // ownerName null means current user owns it
            if (!this.ownerBadge || !this.accessBadge) return;
            if (ownerName) {
                this.ownerBadge.style.display = 'inline-block';
                this.ownerBadge.textContent = ownerName;
            } else {
                this.ownerBadge.style.display = 'none';
                this.ownerBadge.textContent = '';
            }

            if (accessLevel) {
                this.accessBadge.style.display = 'inline-block';
                this.accessBadge.textContent = accessLevel;
                this.accessBadge.classList.remove('badge-read', 'badge-write', 'badge-admin');
                const c = accessLevel.toLowerCase();
                if (c === 'read') this.accessBadge.classList.add('badge-read');
                else if (c === 'write') this.accessBadge.classList.add('badge-write');
                else if (c === 'admin') this.accessBadge.classList.add('badge-admin');
            } else {
                this.accessBadge.style.display = 'none';
                this.accessBadge.textContent = '';
            }

            // read-only visual state: dim the save button and show status
            if (!canEdit) {
                this.saveBtn.classList.add('disabled');
                this.saveBtn.disabled = true;
            } else {
                this.saveBtn.classList.remove('disabled');
                this.saveBtn.disabled = false;
            }
        }

        /**
         * Update the info section
         */
        updateInfo() {
            const size = this.originalContent.length;
            const sizeStr = size < 1024
                ? `${size} bytes`
                : size < 1024 * 1024
                    ? `${(size / 1024).toFixed(1)} KB`
                    : `${(size / 1024 / 1024).toFixed(2)} MB`;

            if (this.mode === 'text') {
                const lines = this.originalContent.split('\n').length;
                this.infoEl.textContent = `${lines} lines · ${sizeStr}`;
            } else {
                this.infoEl.textContent = sizeStr;
            }
        }

        /**
         * Update status message
         */
        updateStatus(msg) {
            this.statusEl.textContent = msg;
        }

        /**
         * Check if editor is open
         */
        isOpen() {
            return this.modal.style.display !== 'none';
        }

        /**
         * Get file extension
         */
        getFileExtension(filename) {
            if (!filename) return '';
            const parts = filename.split('.');
            return parts.length > 1 ? parts[parts.length - 1] : '';
        }

        /**
         * Determine editor mode based on file extension
         */
        determineMode(ext) {
            const textExtensions = ['txt', 'md', 'json', 'js', 'css', 'html', 'xml', 'csv', 'log', 'yml', 'yaml', 'ini', 'conf', 'sh', 'bat', 'py', 'php', 'java', 'c', 'cpp', 'h', 'rb', 'go', 'rs'];
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
            const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];

            if (textExtensions.includes(ext)) {
                return 'text';
            } else if (imageExtensions.includes(ext)) {
                return 'image';
            } else if (videoExtensions.includes(ext)) {
                return 'video';
            } else {
                return 'unsupported';
            }
        }
    }

    // Initialize global editor instance
    global.fileEditor = new FileEditor();

})(this);
