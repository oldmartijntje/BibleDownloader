// Bible Downloader JavaScript Application
class BibleDownloader {
    constructor() {
        this.currentLanguage = 'english';
        this.translations = [];
        this.selectedTranslation = null;
        this.activeDownload = null;
        this.progressInterval = null;

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadLegalDisclaimer();
        await this.loadTranslations();
        await this.loadFiles();
    }

    bindEvents() {
        // Language selector
        document.getElementById('interface-language').addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            this.updateInterface();
            this.loadLegalDisclaimer();
        });

        // Legal agreement checkbox
        document.getElementById('legal-checkbox').addEventListener('change', (e) => {
            this.updateDownloadButton();
        });

        // Public domain filter
        document.getElementById('public-domain-only').addEventListener('change', (e) => {
            this.filterTranslations();
        });

        // Download buttons
        document.getElementById('start-download').addEventListener('click', () => {
            this.startDownload();
        });

        document.getElementById('cancel-download').addEventListener('click', () => {
            this.cancelDownload();
        });

        // Files refresh
        document.getElementById('refresh-files').addEventListener('click', () => {
            this.loadFiles();
        });

        // File type filter
        document.getElementById('file-type-filter').addEventListener('change', () => {
            this.loadFiles();
        });

        // Modal close
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on background click
        document.getElementById('translation-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
    }

    async loadLegalDisclaimer() {
        try {
            const response = await fetch(`/api/translations/legal/disclaimer?language=${this.currentLanguage}`);
            const data = await response.json();

            if (data.success) {
                document.getElementById('legal-title').textContent = data.disclaimer.title;
                const contentDiv = document.getElementById('legal-content');
                contentDiv.innerHTML = '';
                data.disclaimer.content.forEach(paragraph => {
                    const p = document.createElement('p');
                    p.textContent = paragraph;
                    contentDiv.appendChild(p);
                });
            }
        } catch (error) {
            console.error('Failed to load legal disclaimer:', error);
        }
    }

    async loadTranslations() {
        try {
            const publicDomainOnly = document.getElementById('public-domain-only').checked;
            const url = `/api/translations${publicDomainOnly ? '?publicDomainOnly=true' : ''}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                this.translations = data.translations;
                this.renderTranslations();
            } else {
                this.showError('Failed to load translations');
            }
        } catch (error) {
            console.error('Failed to load translations:', error);
            this.showError('Failed to load translations');
        }
    }

    renderTranslations() {
        const grid = document.getElementById('translations-grid');
        grid.innerHTML = '';

        if (this.translations.length === 0) {
            grid.innerHTML = '<div class="loading">No translations found</div>';
            return;
        }

        this.translations.forEach(translation => {
            const card = this.createTranslationCard(translation);
            grid.appendChild(card);
        });
    }

    createTranslationCard(translation) {
        const card = document.createElement('div');
        card.className = `translation-card ${translation.isPublicDomain ? 'public-domain' : 'copyrighted'}`;
        card.dataset.translationId = translation.id;

        card.innerHTML = `
            <div class="translation-name">${translation.fullName}</div>
            <div class="translation-details">
                <div class="translation-short">${translation.shortName}</div>
                <div class="translation-language">${translation.language}</div>
                <div class="translation-source">Source: ${translation.source}</div>
            </div>
            <div class="translation-license">
                ${translation.isPublicDomain ? '✓ Public Domain' : '⚠ ' + translation.license}
            </div>
        `;

        card.addEventListener('click', () => {
            this.selectTranslation(translation);
        });

        return card;
    }

    selectTranslation(translation) {
        // Remove previous selection
        document.querySelectorAll('.translation-card.selected').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new translation
        const card = document.querySelector(`[data-translation-id="${translation.id}"]`);
        card.classList.add('selected');

        this.selectedTranslation = translation;
        this.showDownloadOptions();
        this.updateDownloadButton();
    }

    showDownloadOptions() {
        document.getElementById('download-options').style.display = 'block';
        document.getElementById('download-options').scrollIntoView({ behavior: 'smooth' });
    }

    updateDownloadButton() {
        const button = document.getElementById('start-download');
        const legalCheckbox = document.getElementById('legal-checkbox');

        const canDownload = this.selectedTranslation &&
            (this.selectedTranslation.isPublicDomain || legalCheckbox.checked);

        button.disabled = !canDownload;
    }

    async startDownload() {
        if (!this.selectedTranslation) return;

        const mode = document.querySelector('input[name="download-mode"]:checked').value;
        const downloadSpeed = document.querySelector('input[name="download-speed"]:checked').value;
        const legalAgreement = document.getElementById('legal-checkbox').checked;

        try {
            const response = await fetch('/api/downloads/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    translationId: this.selectedTranslation.id,
                    mode: mode,
                    downloadSpeed: downloadSpeed,
                    legalAgreement: legalAgreement
                })
            });

            const data = await response.json();

            if (data.success) {
                this.activeDownload = data.downloadId;
                this.showProgressSection();
                this.startProgressTracking();

                document.getElementById('start-download').style.display = 'none';
                document.getElementById('cancel-download').style.display = 'inline-flex';
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Failed to start download:', error);
            this.showError('Failed to start download');
        }
    }

    async cancelDownload() {
        if (!this.activeDownload) return;

        try {
            const response = await fetch(`/api/downloads/cancel/${this.activeDownload}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.stopProgressTracking();
                this.resetDownloadUI();
                this.showMessage('Download cancelled successfully');
            }
        } catch (error) {
            console.error('Failed to cancel download:', error);
        }
    }

    showProgressSection() {
        const section = document.getElementById('progress-section');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    }

    startProgressTracking() {
        this.progressInterval = setInterval(async () => {
            await this.updateProgress();
        }, 2000);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    async updateProgress() {
        if (!this.activeDownload) return;

        try {
            const response = await fetch(`/api/downloads/progress/${this.activeDownload}`);
            const data = await response.json();

            if (data.success) {
                this.renderProgress(data.progress);

                if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
                    this.stopProgressTracking();
                    this.resetDownloadUI();

                    if (data.status === 'completed') {
                        this.showMessage('Download completed successfully!');
                        this.loadFiles(); // Refresh files list
                    } else if (data.status === 'failed') {
                        this.showError(`Download failed: ${data.progress.error || 'Unknown error'}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to get progress:', error);
        }
    }

    renderProgress(progress) {
        // Update progress bar
        document.getElementById('progress-fill').style.width = `${progress.percentage}%`;
        document.getElementById('progress-percentage').textContent = `${progress.percentage}%`;
        document.getElementById('progress-message').textContent = progress.message;

        // Update details
        document.getElementById('current-book').textContent = progress.currentBook || '-';
        document.getElementById('current-chapter').textContent = progress.currentChapter || '-';

        if (progress.estimatedTimeRemaining) {
            const eta = new Date(progress.estimatedTimeRemaining);
            const now = new Date();
            const timeDiffMs = eta - now;

            if (timeDiffMs > 0) {
                const minutes = Math.ceil(timeDiffMs / (1000 * 60));
                document.getElementById('estimated-time').textContent = `${minutes}m`;
            } else {
                document.getElementById('estimated-time').textContent = 'Almost done';
            }
        } else {
            document.getElementById('estimated-time').textContent = '-';
        }

        // Handle errors
        if (progress.errors && progress.errors.length > 0) {
            this.showErrorLog(progress.errors);
        }
    }

    showErrorLog(errors) {
        const errorLog = document.getElementById('error-log');
        const errorList = document.getElementById('error-list');

        errorList.innerHTML = '';
        errors.forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item';
            errorItem.innerHTML = `
                <strong>${error.book || 'System'} ${error.chapter || ''}</strong>: 
                ${error.message} 
                <small>(${new Date(error.timestamp).toLocaleTimeString()})</small>
            `;
            errorList.appendChild(errorItem);
        });

        errorLog.style.display = 'block';
    }

    resetDownloadUI() {
        document.getElementById('start-download').style.display = 'inline-flex';
        document.getElementById('cancel-download').style.display = 'none';
        this.activeDownload = null;
    }

    async loadFiles() {
        try {
            const fileType = document.getElementById('file-type-filter').value;
            const response = await fetch(`/api/files?type=${fileType}`);
            const data = await response.json();

            if (data.success) {
                this.renderFiles(data.files);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        }
    }

    renderFiles(files) {
        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '';

        if (files.length === 0) {
            filesList.innerHTML = '<div class="loading">No files found</div>';
            return;
        }

        files.forEach(file => {
            const fileItem = this.createFileItem(file);
            filesList.appendChild(fileItem);
        });
    }

    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';

        const sizeText = file.type === 'bible' ?
            this.formatFileSize(file.size) :
            `${file.fileCount || 0} files`;

        item.innerHTML = `
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-details">
                    Type: ${file.type.toUpperCase()} | 
                    Size: ${sizeText} | 
                    Created: ${new Date(file.created).toLocaleDateString()}
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-small btn-primary">
                    Download
                </button>
                <button class="btn btn-small btn-secondary">
                    Delete
                </button>
            </div>
        `;

        // Add event listeners instead of inline onclick handlers
        const downloadBtn = item.querySelector('.btn-primary');
        const deleteBtn = item.querySelector('.btn-secondary');

        downloadBtn.addEventListener('click', () => {
            this.downloadFile(file.path, file.name);
        });

        deleteBtn.addEventListener('click', () => {
            this.deleteFile(file.type, file.name);
        });

        return item;
    }

    async downloadFile(path, filename) {
        try {
            // For file downloads, we can simply open the URL directly
            // The server handles the download headers appropriately
            const a = document.createElement('a');
            a.href = path;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            this.showMessage('Download started');
        } catch (error) {
            console.error('Download error:', error);
            this.showError('Failed to download file');
        }
    }

    async deleteFile(type, name) {
        if (!confirm(`Are you sure you want to delete ${name}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/files/${type}/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('File deleted successfully');
                this.loadFiles();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showError('Failed to delete file');
        }
    }

    filterTranslations() {
        this.loadTranslations();
    }

    closeModal() {
        document.getElementById('translation-modal').style.display = 'none';
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(`Error: ${message}`);
    }

    showMessage(message) {
        // Simple message display - could be enhanced with a proper notification system
        alert(message);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateInterface() {
        // Update interface language - this would be enhanced with proper i18n
        const translations = {
            english: {
                'translations-title': 'Available Bible Translations',
                'public-domain-text': 'Show only public domain translations',
                'download-options-title': 'Download Options',
                'download-only-text': 'Download Only',
                'download-only-desc': 'Download HTML files for later processing',
                'full-process-text': 'Full Process',
                'full-process-desc': 'Download and convert to .bible format',
                'download-speed-title': 'Download Speed',
                'conservative-text': 'Conservative',
                'conservative-desc': 'Slowest, most respectful to servers (1-2 parallel)',
                'balanced-text': 'Balanced',
                'balanced-desc': 'Good speed while respecting servers (2-4 parallel)',
                'aggressive-text': 'Fast',
                'aggressive-desc': 'Fastest possible while avoiding rate limits (3-6 parallel)',
                'start-download-text': 'Start Download',
                'cancel-download-text': 'Cancel',
                'progress-title': 'Download Progress',
                'current-book-label': 'Current Book:',
                'current-chapter-label': 'Current Chapter:',
                'estimated-time-label': 'Estimated Time Remaining:',
                'files-title': 'Downloaded Files',
                'refresh-files-text': 'Refresh',
                'legal-agreement-text': 'I have read and agree to the terms above'
            },
            dutch: {
                'translations-title': 'Beschikbare Bijbelvertalingen',
                'public-domain-text': 'Toon alleen publiek domein vertalingen',
                'download-options-title': 'Download Opties',
                'download-only-text': 'Alleen Downloaden',
                'download-only-desc': 'Download HTML bestanden voor latere verwerking',
                'full-process-text': 'Volledig Verwerken',
                'full-process-desc': 'Download en converteer naar .bible formaat',
                'download-speed-title': 'Download Snelheid',
                'conservative-text': 'Conservatief',
                'conservative-desc': 'Langzaamst, meest respectvol naar servers (1-2 parallel)',
                'balanced-text': 'Gebalanceerd',
                'balanced-desc': 'Goede snelheid met respect voor servers (2-4 parallel)',
                'aggressive-text': 'Snel',
                'aggressive-desc': 'Zo snel mogelijk zonder rate limits (3-6 parallel)',
                'start-download-text': 'Start Download',
                'cancel-download-text': 'Annuleren',
                'progress-title': 'Download Voortgang',
                'current-book-label': 'Huidig Boek:',
                'current-chapter-label': 'Huidig Hoofdstuk:',
                'estimated-time-label': 'Geschatte Resterende Tijd:',
                'files-title': 'Gedownloade Bestanden',
                'refresh-files-text': 'Vernieuwen',
                'legal-agreement-text': 'Ik heb de bovenstaande voorwaarden gelezen en ga ermee akkoord'
            }
        };

        const currentTranslations = translations[this.currentLanguage] || translations.english;

        Object.entries(currentTranslations).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        });
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bibleDownloader = new BibleDownloader();
});
