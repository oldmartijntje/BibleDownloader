const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

// Get list of downloaded files
router.get('/', async (req, res) => {
    try {
        const { type = 'all' } = req.query; // 'bible', 'html', or 'all'

        const files = {
            bible: [],
            html: []
        };

        // Check for .bible files
        const bibleDir = path.join(__dirname, '..', 'downloads', 'bible');
        if (await fs.pathExists(bibleDir)) {
            const bibleFiles = await fs.readdir(bibleDir);
            for (const file of bibleFiles) {
                if (file.endsWith('.bible')) {
                    const filePath = path.join(bibleDir, file);
                    const stats = await fs.stat(filePath);
                    files.bible.push({
                        name: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: 'bible',
                        path: `/api/files/download/bible/${file}`
                    });
                }
            }
        }

        // Check for HTML directories
        const htmlDir = path.join(__dirname, '..', 'downloads', 'html');
        if (await fs.pathExists(htmlDir)) {
            const htmlDirs = await fs.readdir(htmlDir);
            for (const dir of htmlDirs) {
                const dirPath = path.join(htmlDir, dir);
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory()) {
                    const htmlFiles = await fs.readdir(dirPath);
                    const htmlCount = htmlFiles.filter(f => f.endsWith('.html')).length;
                    files.html.push({
                        name: dir,
                        fileCount: htmlCount,
                        size: 0, // Could calculate total size if needed
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: 'html',
                        path: `/api/files/download/html/${dir}`
                    });
                }
            }
        }

        let result;
        if (type === 'bible') {
            result = files.bible;
        } else if (type === 'html') {
            result = files.html;
        } else {
            result = [...files.bible, ...files.html];
        }

        res.json({
            success: true,
            files: result,
            count: {
                bible: files.bible.length,
                html: files.html.length,
                total: files.bible.length + files.html.length
            }
        });

    } catch (error) {
        req.logger?.error('Error listing files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list files'
        });
    }
});

// Download a specific .bible file
router.get('/download/bible/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '..', 'downloads', 'bible', filename);

        // Validate filename (prevent directory traversal)
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename'
            });
        }

        if (!filename.endsWith('.bible')) {
            return res.status(400).json({
                success: false,
                error: 'File must be a .bible file'
            });
        }

        if (!(await fs.pathExists(filePath))) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                req.logger?.error('Error downloading file:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to download file'
                    });
                }
            }
        });

    } catch (error) {
        req.logger?.error('Error serving bible file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to serve file'
        });
    }
});

// Download HTML files as a ZIP archive
router.get('/download/html/:dirname', async (req, res) => {
    try {
        const { dirname } = req.params;
        const dirPath = path.join(__dirname, '..', 'downloads', 'html', dirname);

        // Validate dirname (prevent directory traversal)
        if (dirname.includes('..') || dirname.includes('/') || dirname.includes('\\')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid directory name'
            });
        }

        if (!(await fs.pathExists(dirPath))) {
            return res.status(404).json({
                success: false,
                error: 'Directory not found'
            });
        }

        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({
                success: false,
                error: 'Path is not a directory'
            });
        }

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression level
        });

        res.attachment(`${dirname}_html.zip`);
        archive.pipe(res);

        // Add all files from the directory to the archive
        archive.directory(dirPath, false);

        archive.on('error', (err) => {
            req.logger?.error('Error creating ZIP archive:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to create archive'
                });
            }
        });

        await archive.finalize();

    } catch (error) {
        req.logger?.error('Error serving HTML directory:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Failed to serve directory'
            });
        }
    }
});

// Delete a file or directory
router.delete('/:type/:name', async (req, res) => {
    try {
        const { type, name } = req.params;

        // Validate inputs
        if (!['bible', 'html'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Type must be "bible" or "html"'
            });
        }

        if (name.includes('..') || name.includes('/') || name.includes('\\')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file/directory name'
            });
        }

        let filePath;
        if (type === 'bible') {
            if (!name.endsWith('.bible')) {
                return res.status(400).json({
                    success: false,
                    error: 'Bible file must have .bible extension'
                });
            }
            filePath = path.join(__dirname, '..', 'downloads', 'bible', name);
        } else {
            filePath = path.join(__dirname, '..', 'downloads', 'html', name);
        }

        if (!(await fs.pathExists(filePath))) {
            return res.status(404).json({
                success: false,
                error: 'File or directory not found'
            });
        }

        await fs.remove(filePath);

        res.json({
            success: true,
            message: `${type === 'bible' ? 'File' : 'Directory'} deleted successfully`
        });

    } catch (error) {
        req.logger?.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file or directory'
        });
    }
});

// Get file information
router.get('/info/:type/:name', async (req, res) => {
    try {
        const { type, name } = req.params;

        // Validate inputs
        if (!['bible', 'html'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Type must be "bible" or "html"'
            });
        }

        if (name.includes('..') || name.includes('/') || name.includes('\\')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file/directory name'
            });
        }

        let filePath;
        if (type === 'bible') {
            if (!name.endsWith('.bible')) {
                return res.status(400).json({
                    success: false,
                    error: 'Bible file must have .bible extension'
                });
            }
            filePath = path.join(__dirname, '..', 'downloads', 'bible', name);
        } else {
            filePath = path.join(__dirname, '..', 'downloads', 'html', name);
        }

        if (!(await fs.pathExists(filePath))) {
            return res.status(404).json({
                success: false,
                error: 'File or directory not found'
            });
        }

        const stats = await fs.stat(filePath);
        let info = {
            name,
            type,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile()
        };

        // If it's an HTML directory, get file count
        if (type === 'html' && stats.isDirectory()) {
            const files = await fs.readdir(filePath);
            info.fileCount = files.length;
            info.htmlFileCount = files.filter(f => f.endsWith('.html')).length;
        }

        // If it's a .bible file, read header information
        if (type === 'bible' && stats.isFile()) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const headerMatch = content.match(/^{[\s\S]*?}\s*~~~~/);
                if (headerMatch) {
                    const headerText = headerMatch[0].replace(/~~~~$/, '').trim();
                    try {
                        const headerJson = JSON.parse(headerText);
                        info.bibleInfo = headerJson;
                    } catch (parseError) {
                        // Header might not be valid JSON, that's okay
                        info.hasHeader = true;
                    }
                }
            } catch (readError) {
                req.logger?.warn('Could not read bible file header:', readError);
            }
        }

        res.json({
            success: true,
            info
        });

    } catch (error) {
        req.logger?.error('Error getting file info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get file information'
        });
    }
});

module.exports = router;
