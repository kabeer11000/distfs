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

                // Ctrl/Cmd + S to save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (this.mode === 'text') {
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
            this.currentFile = file;
            this.originalContent = content;
            this.isDirty = false;

            // Determine file mode based on extension
            const ext = this.getFileExtension(file.name).toLowerCase();
            this.mode = this.determineMode(ext);

            // Update UI
            this.filenameEl.textContent = file.name;
            this.updateModeBadge();
            this.updateInfo();

            // Hide all preview elements
            this.textEditor.style.display = 'none';
            this.mediaPreview.style.display = 'none';
            this.imagePreview.style.display = 'none';
            this.videoPreview.style.display = 'none';
            this.unsupportedPreview.style.display = 'none';

            // Show appropriate editor/viewer
            switch (this.mode) {
                case 'text':
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
            this.saveBtn.style.display = 'inline-block';
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
                const ok = await window.fs.uploadFileApi(
                    this.currentFile.name,
                    content,
                    window.fs.getCurrentDirId()
                );

                if (ok) {
                    this.originalContent = content;
                    this.isDirty = false;
                    this.updateStatus('Saved successfully');

                    // Refresh file browser
                    if (typeof window.renderFileBrowser === 'function') {
                        setTimeout(() => window.renderFileBrowser(), 100);
                    }
                } else {
                    this.updateStatus('Save failed');
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
