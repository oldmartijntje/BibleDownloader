const express = require('express');
const router = express.Router();
const DownloadService = require('../services/downloadService');
const { translations } = require('../config/translations');

// Active downloads storage (in production, use Redis or database)
const activeDownloads = new Map();

// Start a new download
router.post('/start', async (req, res) => {
    try {
        const { translationId, mode = 'full', legalAgreement = false } = req.body;

        if (!translationId) {
            return res.status(400).json({
                success: false,
                error: 'Translation ID is required'
            });
        }

        const translation = translations[translationId.toUpperCase()];
        if (!translation) {
            return res.status(404).json({
                success: false,
                error: 'Translation not found'
            });
        }

        // Check if legal agreement is required for copyrighted material
        if (!translation.isPublicDomain && !legalAgreement) {
            return res.status(400).json({
                success: false,
                error: 'Legal agreement required for copyrighted material',
                requiresLegalAgreement: true
            });
        }

        // Generate unique download ID
        const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize download service
        const downloadService = new DownloadService({
            translationId: translationId.toUpperCase(),
            translation,
            mode, // 'download-only' or 'full'
            downloadId,
            logger: req.logger
        });

        // Store active download
        activeDownloads.set(downloadId, {
            service: downloadService,
            startTime: new Date(),
            translationId: translationId.toUpperCase(),
            mode,
            status: 'starting'
        });

        // Start download asynchronously
        downloadService.start()
            .then(() => {
                const download = activeDownloads.get(downloadId);
                if (download) {
                    download.status = 'completed';
                    download.endTime = new Date();
                }
            })
            .catch((error) => {
                req.logger?.error(`Download ${downloadId} failed:`, error);
                const download = activeDownloads.get(downloadId);
                if (download) {
                    download.status = 'failed';
                    download.error = error.message;
                    download.endTime = new Date();
                }
            });

        res.json({
            success: true,
            downloadId,
            translationId: translationId.toUpperCase(),
            mode,
            status: 'started',
            message: 'Download started successfully'
        });

    } catch (error) {
        req.logger?.error('Error starting download:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start download'
        });
    }
});

// Get download progress
router.get('/progress/:downloadId', (req, res) => {
    try {
        const { downloadId } = req.params;
        const download = activeDownloads.get(downloadId);

        if (!download) {
            return res.status(404).json({
                success: false,
                error: 'Download not found'
            });
        }

        const progress = download.service.getProgress();

        res.json({
            success: true,
            downloadId,
            translationId: download.translationId,
            mode: download.mode,
            status: download.status,
            progress: {
                ...progress,
                startTime: download.startTime,
                endTime: download.endTime,
                error: download.error
            }
        });

    } catch (error) {
        req.logger?.error('Error getting download progress:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get download progress'
        });
    }
});

// Cancel a download
router.post('/cancel/:downloadId', (req, res) => {
    try {
        const { downloadId } = req.params;
        const download = activeDownloads.get(downloadId);

        if (!download) {
            return res.status(404).json({
                success: false,
                error: 'Download not found'
            });
        }

        if (download.status === 'completed' || download.status === 'failed') {
            return res.status(400).json({
                success: false,
                error: `Cannot cancel download with status: ${download.status}`
            });
        }

        // Cancel the download
        download.service.cancel();
        download.status = 'cancelled';
        download.endTime = new Date();

        res.json({
            success: true,
            downloadId,
            status: 'cancelled',
            message: 'Download cancelled successfully'
        });

    } catch (error) {
        req.logger?.error('Error cancelling download:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel download'
        });
    }
});

// Get all active downloads
router.get('/active', (req, res) => {
    try {
        const downloads = Array.from(activeDownloads.entries()).map(([id, download]) => ({
            downloadId: id,
            translationId: download.translationId,
            mode: download.mode,
            status: download.status,
            startTime: download.startTime,
            endTime: download.endTime,
            progress: download.service.getProgress()
        }));

        res.json({
            success: true,
            downloads,
            count: downloads.length
        });

    } catch (error) {
        req.logger?.error('Error getting active downloads:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get active downloads'
        });
    }
});

// Clean up completed downloads older than 1 hour
router.post('/cleanup', (req, res) => {
    try {
        const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        let cleaned = 0;

        for (const [id, download] of activeDownloads.entries()) {
            if (download.endTime && download.endTime < cutoffTime &&
                (download.status === 'completed' || download.status === 'failed' || download.status === 'cancelled')) {
                activeDownloads.delete(id);
                cleaned++;
            }
        }

        res.json({
            success: true,
            cleaned,
            remaining: activeDownloads.size,
            message: `Cleaned up ${cleaned} old downloads`
        });

    } catch (error) {
        req.logger?.error('Error cleaning up downloads:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clean up downloads'
        });
    }
});

module.exports = router;
