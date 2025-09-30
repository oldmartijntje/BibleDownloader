const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { bookNames, sourcePatterns } = require('../config/translations');

class DownloadService {
    constructor(options) {
        this.translationId = options.translationId;
        this.translation = options.translation;
        this.mode = options.mode; // 'download-only' or 'full'
        this.downloadId = options.downloadId;
        this.logger = options.logger;

        this.progress = {
            status: 'initializing',
            currentBook: '',
            currentChapter: 0,
            totalBooks: 66,
            totalChapters: 1189, // Total chapters in the Bible
            completedChapters: 0,
            percentage: 0,
            message: 'Initializing download...',
            startTime: new Date(),
            estimatedTimeRemaining: null,
            errors: []
        };

        this.cancelled = false;
        this.outputDir = path.join(__dirname, '..', 'downloads');
        this.htmlDir = path.join(this.outputDir, 'html', this.translationId);
        this.bibleDir = path.join(this.outputDir, 'bible');
    }

    async start() {
        try {
            this.logger?.info(`Starting download for ${this.translationId} in ${this.mode} mode`);

            // Ensure directories exist
            await fs.ensureDir(this.htmlDir);
            await fs.ensureDir(this.bibleDir);

            this.progress.status = 'downloading';
            this.progress.message = 'Starting Bible download...';

            // Download all chapters
            await this.downloadAllChapters();

            if (this.cancelled) {
                this.progress.status = 'cancelled';
                this.progress.message = 'Download cancelled';
                return;
            }

            if (this.mode === 'full') {
                this.progress.status = 'converting';
                this.progress.message = 'Converting HTML files to .bible format...';
                await this.convertToBibleFormat();
            }

            this.progress.status = 'completed';
            this.progress.percentage = 100;
            this.progress.message = 'Download completed successfully';
            this.progress.endTime = new Date();

        } catch (error) {
            this.logger?.error(`Download failed for ${this.translationId}:`, error);
            this.progress.status = 'failed';
            this.progress.message = `Download failed: ${error.message}`;
            this.progress.errors.push({
                message: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    async downloadAllChapters() {
        const bibleStructure = this.getBibleStructure();
        let completedChapters = 0;
        const totalChapters = bibleStructure.reduce((sum, book) => sum + book.chapters, 0);

        // Scan for existing valid files before starting
        const existingFiles = await this.scanExistingFiles(bibleStructure);
        if (existingFiles.validCount > 0) {
            this.progress.message = `Found ${existingFiles.validCount} existing valid files, ${existingFiles.invalidCount} files need re-downloading...`;
            this.logger?.info(`Resume download - Found ${existingFiles.validCount} valid files, ${existingFiles.invalidCount} invalid files, ${existingFiles.missingCount} missing files`);

            // Update completed chapters count to reflect existing valid files
            completedChapters = existingFiles.validCount;
            this.progress.completedChapters = completedChapters;
            this.progress.percentage = Math.round((completedChapters / totalChapters) * 100);
        }

        for (let bookIndex = 0; bookIndex < bibleStructure.length; bookIndex++) {
            if (this.cancelled) return;

            const book = bibleStructure[bookIndex];
            this.progress.currentBook = book.name;

            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                if (this.cancelled) return;

                try {
                    this.progress.currentChapter = chapter;
                    this.progress.message = `Downloading ${book.name} ${chapter}...`;

                    const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                    const filepath = path.join(this.htmlDir, filename);
                    const wasAlreadyValid = await this.isValidExistingFile(filepath);

                    await this.downloadChapter(book, chapter);

                    // Only increment if we didn't already count this file
                    if (!wasAlreadyValid) {
                        completedChapters++;
                    }

                    this.progress.completedChapters = completedChapters;
                    this.progress.percentage = Math.round((completedChapters / totalChapters) * 100);

                    // Calculate estimated time remaining
                    if (completedChapters > 5) {
                        const elapsed = new Date() - this.progress.startTime;
                        const averageTimePerChapter = elapsed / completedChapters;
                        const remainingChapters = totalChapters - completedChapters;
                        this.progress.estimatedTimeRemaining = new Date(Date.now() + (remainingChapters * averageTimePerChapter));
                    }

                    // Rate limiting to be respectful to servers
                    await this.delay(1000 + Math.random() * 2000);

                } catch (error) {
                    this.logger?.warn(`Failed to download ${book.name} ${chapter}:`, error);
                    this.progress.errors.push({
                        book: book.name,
                        chapter,
                        message: error.message,
                        timestamp: new Date()
                    });

                    // Continue with next chapter unless it's a critical error
                    if (error.message.includes('rate limit') || error.message.includes('429')) {
                        await this.delay(10000); // Wait 10 seconds on rate limit
                    }
                }
            }
        }
    }

    async downloadChapter(book, chapterNum) {
        const url = this.buildChapterUrl(book, chapterNum);
        const filename = `${book.abbreviation}_${chapterNum.toString().padStart(3, '0')}.html`;
        const filepath = path.join(this.htmlDir, filename);

        // Check if file already exists and is valid (resume capability)
        if (await this.isValidExistingFile(filepath)) {
            // Update progress message to indicate we're skipping this file
            this.progress.message = `Skipping ${book.name} ${chapterNum} - already downloaded`;
            return;
        }

        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; BibleDownloader/1.0; +https://github.com/user/bible-downloader)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });

            if (response.status === 200) {
                await fs.writeFile(filepath, response.data, 'utf8');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            if (error.response?.status === 429) {
                throw new Error(`Rate limit exceeded (429)`);
            } else if (error.response?.status === 404) {
                throw new Error(`Chapter not found (404)`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error(`Request timeout`);
            } else {
                throw new Error(`Network error: ${error.message}`);
            }
        }
    }

    buildChapterUrl(book, chapter) {
        const source = this.translation.source;
        const pattern = sourcePatterns[source];

        if (!pattern) {
            throw new Error(`Unknown source: ${source}`);
        }

        let url;

        switch (source) {
            case 'bible.com':
                if (this.translation.bibleComId) {
                    url = `${pattern.baseUrl}/bible/${this.translation.bibleComId}/${book.bibleComCode}.${chapter}`;
                } else {
                    throw new Error(`Missing bible.com ID for ${this.translationId}`);
                }
                break;

            case 'basisbijbel.nl':
                url = `${pattern.baseUrl}/boek/${book.name.toLowerCase()}/${chapter}`;
                break;

            case 'debijbel.nl':
                const version = this.translation.shortName.toLowerCase().replace(/[^a-z]/g, '');
                url = `${pattern.baseUrl}/api/bible/passage?identifier=${book.abbreviation}${chapter}&language=nl&version=${version}`;
                break;

            default:
                throw new Error(`URL building not implemented for source: ${source}`);
        }

        return url;
    }

    async convertToBibleFormat() {
        const bibleContent = [];
        const bibleStructure = this.getBibleStructure();

        // Add header
        const header = {
            "long name": this.translation.fullName,
            "short name": this.translation.shortName,
            "sheet name": this.translation.sheetName,
            "license": this.translation.license,
            "comment": this.translation.comment || "",
            "language": this.translation.language
        };

        bibleContent.push(JSON.stringify(header, null, 2));
        bibleContent.push('~~~~');

        // Process each book
        for (let bookIndex = 0; bookIndex < bibleStructure.length; bookIndex++) {
            const book = bibleStructure[bookIndex];

            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                const filepath = path.join(this.htmlDir, filename);

                if (await fs.pathExists(filepath)) {
                    try {
                        const htmlContent = await fs.readFile(filepath, 'utf8');
                        const verses = await this.extractVerses(htmlContent, book, chapter);
                        bibleContent.push(...verses);
                    } catch (error) {
                        this.logger?.warn(`Failed to process ${filename}:`, error);
                        // Add placeholder verse for missing content
                        const bookNum = (bookIndex + 1).toString().padStart(2, '0');
                        const chapterNum = chapter.toString().padStart(3, '0');
                        bibleContent.push(`{${bookNum}${chapterNum}001} {%empty%}`);
                    }
                }
            }
        }

        // Write .bible file
        const bibleFilename = `${this.translation.shortName}.bible`;
        const bibleFilepath = path.join(this.bibleDir, bibleFilename);

        await fs.writeFile(bibleFilepath, bibleContent.join('\n'), 'utf8');

        this.logger?.info(`Created .bible file: ${bibleFilename}`);
    }

    async extractVerses(htmlContent, book, chapterNum) {
        const verses = [];
        const $ = cheerio.load(htmlContent);

        // Different extraction methods based on source
        switch (this.translation.source) {
            case 'bible.com':
                verses.push(...this.extractBibleComVerses($, book, chapterNum));
                break;

            case 'debijbel.nl':
                // This would be JSON response, not HTML
                try {
                    const jsonData = JSON.parse(htmlContent);
                    verses.push(...this.extractDebijbelVerses(jsonData, book, chapterNum));
                } catch {
                    // If it's not JSON, treat as HTML
                    verses.push(...this.extractGenericVerses($, book, chapterNum));
                }
                break;

            default:
                verses.push(...this.extractGenericVerses($, book, chapterNum));
                break;
        }

        return verses;
    }

    extractBibleComVerses($, book, chapterNum) {
        const verses = [];
        const bookNum = this.getBookNumber(book.name).toString().padStart(2, '0');
        const chapterNumStr = chapterNum.toString().padStart(3, '0');

        // Bible.com typically uses .verse class or data-verse attributes
        $('.verse, [data-verse]').each((index, element) => {
            const $verse = $(element);
            const verseNum = $verse.attr('data-verse') ||
                $verse.find('.verse-number').text().trim() ||
                (index + 1).toString();

            let verseText = $verse.text().trim();

            // Clean up verse text
            verseText = verseText.replace(/^\d+\s*/, ''); // Remove leading verse number
            verseText = verseText.replace(/\s+/g, ' ').trim();

            if (verseText) {
                const verseNumStr = verseNum.toString().padStart(3, '0');
                verses.push(`{${bookNum}${chapterNumStr}${verseNumStr}} {${verseText}}`);
            }
        });

        return verses;
    }

    extractDebijbelVerses(jsonData, book, chapterNum) {
        const verses = [];
        const bookNum = this.getBookNumber(book.name).toString().padStart(2, '0');
        const chapterNumStr = chapterNum.toString().padStart(3, '0');

        if (jsonData.content && jsonData.content.verses) {
            jsonData.content.verses.forEach(verse => {
                const verseNumStr = verse.verse.toString().padStart(3, '0');
                const verseText = verse.text.trim();
                verses.push(`{${bookNum}${chapterNumStr}${verseNumStr}} {${verseText}}`);
            });
        }

        return verses;
    }

    extractGenericVerses($, book, chapterNum) {
        const verses = [];
        const bookNum = this.getBookNumber(book.name).toString().padStart(2, '0');
        const chapterNumStr = chapterNum.toString().padStart(3, '0');

        // Generic extraction - look for common patterns
        const verseElements = $('p, div, span').filter((index, element) => {
            const text = $(element).text();
            return /^\s*\d+\s/.test(text) && text.length > 10;
        });

        verseElements.each((index, element) => {
            const $element = $(element);
            const text = $element.text().trim();
            const verseMatch = text.match(/^(\d+)\s+(.*)/);

            if (verseMatch) {
                const verseNum = verseMatch[1];
                const verseText = verseMatch[2].trim();

                if (verseText) {
                    const verseNumStr = verseNum.padStart(3, '0');
                    verses.push(`{${bookNum}${chapterNumStr}${verseNumStr}} {${verseText}}`);
                }
            }
        });

        return verses;
    }

    getBibleStructure() {
        // Standard Bible book structure with chapter counts
        return [
            { name: 'Genesis', abbreviation: 'GEN', chapters: 50, bibleComCode: 'GEN' },
            { name: 'Exodus', abbreviation: 'EXO', chapters: 40, bibleComCode: 'EXO' },
            { name: 'Leviticus', abbreviation: 'LEV', chapters: 27, bibleComCode: 'LEV' },
            { name: 'Numbers', abbreviation: 'NUM', chapters: 36, bibleComCode: 'NUM' },
            { name: 'Deuteronomy', abbreviation: 'DEU', chapters: 34, bibleComCode: 'DEU' },
            { name: 'Joshua', abbreviation: 'JOS', chapters: 24, bibleComCode: 'JOS' },
            { name: 'Judges', abbreviation: 'JDG', chapters: 21, bibleComCode: 'JDG' },
            { name: 'Ruth', abbreviation: 'RUT', chapters: 4, bibleComCode: 'RUT' },
            { name: '1 Samuel', abbreviation: '1SA', chapters: 31, bibleComCode: '1SA' },
            { name: '2 Samuel', abbreviation: '2SA', chapters: 24, bibleComCode: '2SA' },
            { name: '1 Kings', abbreviation: '1KI', chapters: 22, bibleComCode: '1KI' },
            { name: '2 Kings', abbreviation: '2KI', chapters: 25, bibleComCode: '2KI' },
            { name: '1 Chronicles', abbreviation: '1CH', chapters: 29, bibleComCode: '1CH' },
            { name: '2 Chronicles', abbreviation: '2CH', chapters: 36, bibleComCode: '2CH' },
            { name: 'Ezra', abbreviation: 'EZR', chapters: 10, bibleComCode: 'EZR' },
            { name: 'Nehemiah', abbreviation: 'NEH', chapters: 13, bibleComCode: 'NEH' },
            { name: 'Esther', abbreviation: 'EST', chapters: 10, bibleComCode: 'EST' },
            { name: 'Job', abbreviation: 'JOB', chapters: 42, bibleComCode: 'JOB' },
            { name: 'Psalms', abbreviation: 'PSA', chapters: 150, bibleComCode: 'PSA' },
            { name: 'Proverbs', abbreviation: 'PRO', chapters: 31, bibleComCode: 'PRO' },
            { name: 'Ecclesiastes', abbreviation: 'ECC', chapters: 12, bibleComCode: 'ECC' },
            { name: 'Song of Songs', abbreviation: 'SNG', chapters: 8, bibleComCode: 'SNG' },
            { name: 'Isaiah', abbreviation: 'ISA', chapters: 66, bibleComCode: 'ISA' },
            { name: 'Jeremiah', abbreviation: 'JER', chapters: 52, bibleComCode: 'JER' },
            { name: 'Lamentations', abbreviation: 'LAM', chapters: 5, bibleComCode: 'LAM' },
            { name: 'Ezekiel', abbreviation: 'EZK', chapters: 48, bibleComCode: 'EZK' },
            { name: 'Daniel', abbreviation: 'DAN', chapters: 12, bibleComCode: 'DAN' },
            { name: 'Hosea', abbreviation: 'HOS', chapters: 14, bibleComCode: 'HOS' },
            { name: 'Joel', abbreviation: 'JOL', chapters: this.translation.joel3Bible ? 3 : 4, bibleComCode: 'JOL' },
            { name: 'Amos', abbreviation: 'AMO', chapters: 9, bibleComCode: 'AMO' },
            { name: 'Obadiah', abbreviation: 'OBA', chapters: 1, bibleComCode: 'OBA' },
            { name: 'Jonah', abbreviation: 'JON', chapters: 4, bibleComCode: 'JON' },
            { name: 'Micah', abbreviation: 'MIC', chapters: 7, bibleComCode: 'MIC' },
            { name: 'Nahum', abbreviation: 'NAM', chapters: 3, bibleComCode: 'NAM' },
            { name: 'Habakkuk', abbreviation: 'HAB', chapters: 3, bibleComCode: 'HAB' },
            { name: 'Zephaniah', abbreviation: 'ZEP', chapters: 3, bibleComCode: 'ZEP' },
            { name: 'Haggai', abbreviation: 'HAG', chapters: 2, bibleComCode: 'HAG' },
            { name: 'Zechariah', abbreviation: 'ZEC', chapters: 14, bibleComCode: 'ZEC' },
            { name: 'Malachi', abbreviation: 'MAL', chapters: this.translation.mal4Bible ? 4 : 3, bibleComCode: 'MAL' },
            { name: 'Matthew', abbreviation: 'MAT', chapters: 28, bibleComCode: 'MAT' },
            { name: 'Mark', abbreviation: 'MRK', chapters: 16, bibleComCode: 'MRK' },
            { name: 'Luke', abbreviation: 'LUK', chapters: 24, bibleComCode: 'LUK' },
            { name: 'John', abbreviation: 'JHN', chapters: 21, bibleComCode: 'JHN' },
            { name: 'Acts', abbreviation: 'ACT', chapters: 28, bibleComCode: 'ACT' },
            { name: 'Romans', abbreviation: 'ROM', chapters: 16, bibleComCode: 'ROM' },
            { name: '1 Corinthians', abbreviation: '1CO', chapters: 16, bibleComCode: '1CO' },
            { name: '2 Corinthians', abbreviation: '2CO', chapters: 13, bibleComCode: '2CO' },
            { name: 'Galatians', abbreviation: 'GAL', chapters: 6, bibleComCode: 'GAL' },
            { name: 'Ephesians', abbreviation: 'EPH', chapters: 6, bibleComCode: 'EPH' },
            { name: 'Philippians', abbreviation: 'PHP', chapters: 4, bibleComCode: 'PHP' },
            { name: 'Colossians', abbreviation: 'COL', chapters: 4, bibleComCode: 'COL' },
            { name: '1 Thessalonians', abbreviation: '1TH', chapters: 5, bibleComCode: '1TH' },
            { name: '2 Thessalonians', abbreviation: '2TH', chapters: 3, bibleComCode: '2TH' },
            { name: '1 Timothy', abbreviation: '1TI', chapters: 6, bibleComCode: '1TI' },
            { name: '2 Timothy', abbreviation: '2TI', chapters: 4, bibleComCode: '2TI' },
            { name: 'Titus', abbreviation: 'TIT', chapters: 3, bibleComCode: 'TIT' },
            { name: 'Philemon', abbreviation: 'PHM', chapters: 1, bibleComCode: 'PHM' },
            { name: 'Hebrews', abbreviation: 'HEB', chapters: 13, bibleComCode: 'HEB' },
            { name: 'James', abbreviation: 'JAS', chapters: 5, bibleComCode: 'JAS' },
            { name: '1 Peter', abbreviation: '1PE', chapters: 5, bibleComCode: '1PE' },
            { name: '2 Peter', abbreviation: '2PE', chapters: 3, bibleComCode: '2PE' },
            { name: '1 John', abbreviation: '1JN', chapters: 5, bibleComCode: '1JN' },
            { name: '2 John', abbreviation: '2JN', chapters: 1, bibleComCode: '2JN' },
            { name: '3 John', abbreviation: '3JN', chapters: 1, bibleComCode: '3JN' },
            { name: 'Jude', abbreviation: 'JUD', chapters: 1, bibleComCode: 'JUD' },
            { name: 'Revelation', abbreviation: 'REV', chapters: 22, bibleComCode: 'REV' }
        ];
    }

    getBookNumber(bookName) {
        const structure = this.getBibleStructure();
        const index = structure.findIndex(book => book.name === bookName);
        return index + 1;
    }

    cancel() {
        this.cancelled = true;
        this.progress.status = 'cancelling';
        this.progress.message = 'Cancelling download...';
    }

    getProgress() {
        return { ...this.progress };
    }

    async scanExistingFiles(bibleStructure) {
        let validCount = 0;
        let invalidCount = 0;
        let missingCount = 0;

        for (const book of bibleStructure) {
            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                const filepath = path.join(this.htmlDir, filename);

                if (await this.isValidExistingFile(filepath)) {
                    validCount++;
                } else if (await fs.pathExists(filepath)) {
                    invalidCount++;
                    // Remove invalid file so it can be re-downloaded
                    try {
                        await fs.remove(filepath);
                        this.logger?.info(`Removed invalid file: ${filepath}`);
                        missingCount++;
                    } catch (error) {
                        this.logger?.warn(`Could not remove invalid file ${filepath}:`, error);
                        invalidCount++; // Keep it as invalid if we can't remove it
                        missingCount--;
                    }
                } else {
                    missingCount++;
                }
            }
        }

        return { validCount, invalidCount, missingCount };
    }

    async isValidExistingFile(filepath) {
        try {
            if (!(await fs.pathExists(filepath))) {
                return false;
            }

            const stats = await fs.stat(filepath);

            // Check if file is empty or very small (likely corrupted/incomplete)
            if (stats.size < 100) {
                this.logger?.warn(`File ${filepath} is too small (${stats.size} bytes), will re-download`);
                return false;
            }

            // Read a small portion to check if it contains HTML content
            const content = await fs.readFile(filepath, 'utf8');

            // Basic checks for valid HTML content
            if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
                this.logger?.warn(`File ${filepath} doesn't appear to be valid HTML, will re-download`);
                return false;
            }

            // Check for common error indicators in the content
            const errorIndicators = [
                'error',
                'not found',
                '404',
                'access denied',
                'forbidden',
                'service unavailable',
                'internal server error'
            ];

            const contentLower = content.toLowerCase();
            const hasErrors = errorIndicators.some(indicator =>
                contentLower.includes(indicator) && contentLower.length < 1000
            );

            if (hasErrors) {
                this.logger?.warn(`File ${filepath} appears to contain error content, will re-download`);
                return false;
            }

            // If all checks pass, consider the file valid
            this.logger?.info(`Skipping ${filepath} - valid existing file found`);
            return true;

        } catch (error) {
            this.logger?.warn(`Error checking file ${filepath}:`, error);
            return false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = DownloadService;
