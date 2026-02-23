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
        this.downloadSpeed = options.downloadSpeed || 'balanced'; // 'conservative', 'balanced', 'aggressive'

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
        this.jsonDir = path.join(this.outputDir, 'json', this.translationId);

        // Performance tracking for adaptive delays
        this.performanceStats = {
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            recentErrors: [],
            lastRateLimitTime: null,
            consecutiveSuccesses: 0
        };

        // Adaptive delay configuration based on download speed preference
        this.delayConfig = this.getDelayConfig(this.downloadSpeed);
    }

    async start() {
        try {
            this.logger?.info(`Starting download for ${this.translationId} in ${this.mode} mode`);

            // Ensure directories exist
            await fs.ensureDir(this.htmlDir);
            await fs.ensureDir(this.bibleDir);
            await fs.ensureDir(this.jsonDir);

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

                this.progress.message = 'Converting to JSON format...';
                await this.convertToJsonFormat();
            } else if (this.mode === 'json') {
                this.progress.status = 'converting';
                this.progress.message = 'Converting to JSON format...';
                await this.convertToJsonFormat();
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

        // Create a list of all chapters to download
        const chaptersToDownload = [];
        for (let bookIndex = 0; bookIndex < bibleStructure.length; bookIndex++) {
            const book = bibleStructure[bookIndex];
            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                chaptersToDownload.push({ book, chapter, bookIndex });
            }
        }

        // Determine concurrency level based on source
        const concurrency = this.getConcurrencyLevel();
        this.logger?.info(`Using concurrency level: ${concurrency} parallel downloads`);

        // Process chapters in batches with concurrency control
        await this.processBatchedDownloads(chaptersToDownload, concurrency, completedChapters, totalChapters);
    }

    getDelayConfig(speed) {
        const configs = {
            conservative: {
                baseDelay: 500,           // Slower, more respectful
                maxDelay: 10000,
                rampUpFactor: 2.0,
                rampDownFactor: 0.8,
                currentDelay: 1000
            },
            balanced: {
                baseDelay: 100,           // Good balance
                maxDelay: 5000,
                rampUpFactor: 1.5,
                rampDownFactor: 0.9,
                currentDelay: 300
            },
            aggressive: {
                baseDelay: 50,            // Fast as possible while being respectful
                maxDelay: 2000,
                rampUpFactor: 1.2,
                rampDownFactor: 0.95,
                currentDelay: 100
            }
        };

        return configs[speed] || configs.balanced;
    }

    getConcurrencyLevel() {
        // Base concurrency by source
        let baseConcurrency;
        switch (this.translation.source) {
            case 'bible.com':
                baseConcurrency = { conservative: 2, balanced: 4, aggressive: 6 };
                break;
            case 'basisbijbel.nl':
            case 'debijbel.nl':
                baseConcurrency = { conservative: 1, balanced: 2, aggressive: 3 };
                break;
            default:
                baseConcurrency = { conservative: 1, balanced: 2, aggressive: 4 };
        }

        return baseConcurrency[this.downloadSpeed] || baseConcurrency.balanced;
    }

    async processBatchedDownloads(chaptersToDownload, concurrency, initialCompletedChapters, totalChapters) {
        let completedChapters = initialCompletedChapters;

        // Process in batches to control concurrency
        for (let i = 0; i < chaptersToDownload.length; i += concurrency) {
            if (this.cancelled) return;

            const batch = chaptersToDownload.slice(i, i + concurrency);
            const batchPromises = batch.map(async ({ book, chapter, bookIndex }) => {
                if (this.cancelled) return { success: false, skipped: false };

                try {
                    // Update current progress
                    this.progress.currentBook = book.name;
                    this.progress.currentChapter = chapter;
                    this.progress.message = `Downloading ${book.name} ${chapter}...`;

                    const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                    const filepath = path.join(this.htmlDir, filename);
                    const wasAlreadyValid = await this.isValidExistingFile(filepath);

                    if (wasAlreadyValid) {
                        return { success: true, skipped: true };
                    }

                    await this.downloadChapter(book, chapter);
                    return { success: true, skipped: false };

                } catch (error) {
                    this.logger?.warn(`Failed to download ${book.name} ${chapter}:`, error);
                    this.progress.errors.push({
                        book: book.name,
                        chapter,
                        message: error.message,
                        timestamp: new Date()
                    });

                    // Handle rate limiting more aggressively
                    if (error.message.includes('rate limit') || error.message.includes('429')) {
                        this.logger?.warn('Rate limit detected, reducing concurrency');
                        await this.delay(5000); // Brief pause for rate limits
                    }

                    return { success: false, skipped: false };
                }
            });

            // Wait for batch to complete
            const results = await Promise.all(batchPromises);

            // Update progress
            const newCompletions = results.filter(r => r.success && !r.skipped).length;
            completedChapters += newCompletions;

            this.progress.completedChapters = completedChapters;
            this.progress.percentage = Math.round((completedChapters / totalChapters) * 100);

            // Calculate estimated time remaining
            if (completedChapters > 5) {
                const elapsed = new Date() - this.progress.startTime;
                const averageTimePerChapter = elapsed / (completedChapters - initialCompletedChapters);
                const remainingChapters = totalChapters - completedChapters;
                this.progress.estimatedTimeRemaining = new Date(Date.now() + (remainingChapters * averageTimePerChapter));
            }

            // Check error rate and adjust if needed
            const errorRate = results.filter(r => !r.success).length / results.length;
            if (errorRate > 0.3) { // If more than 30% failed
                this.logger?.warn(`High error rate (${Math.round(errorRate * 100)}%) detected, adding delay between batches`);
                await this.delay(2000); // Pause between batches if high error rate
            } else {
                // Small delay between batches to be respectful
                await this.delay(200);
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
            this.performanceStats.lastRequestSkipped = true;
            return;
        }

        const startTime = Date.now();

        try {
            const response = await axios.get(url, {
                timeout: 15000, // Reduced timeout for faster failure detection
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; BibleDownloader/1.0; Educational Use)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            const responseTime = Date.now() - startTime;

            if (response.status === 200) {
                await fs.writeFile(filepath, response.data, 'utf8');
                this.updatePerformanceStats(true, responseTime);
                this.logger?.debug(`Downloaded ${book.name} ${chapterNum} in ${responseTime}ms`);
            } else {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                this.updatePerformanceStats(false, responseTime, error);
                throw error;
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;

            let errorMessage;
            if (error.response?.status === 429) {
                errorMessage = `Rate limit exceeded (429)`;
            } else if (error.response?.status === 404) {
                errorMessage = `Chapter not found (404)`;
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = `Request timeout`;
            } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
                errorMessage = `Connection error: ${error.code}`;
            } else {
                errorMessage = `Network error: ${error.message}`;
            }

            const wrappedError = new Error(errorMessage);
            this.updatePerformanceStats(false, responseTime, wrappedError);
            throw wrappedError;
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

    async convertToJsonFormat() {
        const bibleStructure = this.getBibleStructure();
        const index = [];

        // Process each book
        for (let bookIndex = 0; bookIndex < bibleStructure.length; bookIndex++) {
            const book = bibleStructure[bookIndex];

            this.progress.message = `Converting ${book.name} to JSON...`;
            const src = this.translation.source;
            const version = this.translation.fullName;

            const bookJson = {
                source: this.translation.source,
                version: this.translation.fullName,
                book: book.name,
                chapters: {} // Changed from verses array to chapters object
            };

            // Collect verses organized by chapter
            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                const filepath = path.join(this.htmlDir, filename);

                if (await fs.pathExists(filepath)) {
                    try {
                        const htmlContent = await fs.readFile(filepath, 'utf8');
                        const verses = await this.extractVersesForJson(
                            htmlContent,
                            book,
                            chapter,
                            bookIndex + 1
                        );

                        // Store verses under their chapter
                        if (verses.length > 0) {
                            bookJson.chapters[chapter] = verses;
                        }
                    } catch (error) {
                        this.logger?.warn(
                            `Failed to process ${filename} for JSON:`,
                            error
                        );
                    }
                }
            }

            // Only save if we have chapters with verses
            if (Object.keys(bookJson.chapters).length > 0) {
                const jsonFilename = `${book.abbreviation}.json`;
                const jsonFilepath = path.join(this.jsonDir, jsonFilename);

                await fs.writeFile(
                    jsonFilepath,
                    JSON.stringify(bookJson, null, 2),
                    'utf8'
                );
                this.logger?.info(
                    `Created JSON file: ${jsonFilename} with ${Object.keys(bookJson.chapters).length
                    } chapters`
                );

                // Add to index
                index.push({
                    name: book.name,
                    abbreviation: book.abbreviation,
                    filename: jsonFilename,
                    chapters: book.chapters,
                    source: this.translation.source
                });
            }
        }

        // Generate index.json
        if (index.length > 0) {
            const indexFilepath = path.join(this.jsonDir, 'index.json');
            await fs.writeFile(
                indexFilepath,
                JSON.stringify(
                    {
                        source: this.translation.source,
                        version: this.translation.fullName,
                        books: index
                    },
                    null,
                    2
                ),
                'utf8'
            );
            this.logger?.info(`Created index.json with ${index.length} books`);
        }

        this.logger?.info(
            `Completed JSON conversion for ${this.translationId}`
        );
    }

    async extractVersesForJson(htmlContent, book, chapterNum, bookNumber) {
        const verses = [];
        const $ = cheerio.load(htmlContent);

        // Different extraction methods based on source
        switch (this.translation.source) {
            case 'bible.com':
                verses.push(...this.extractBibleComVersesForJson($, book, chapterNum, bookNumber));
                break;

            case 'debijbel.nl':
                // This would be JSON response, not HTML
                try {
                    const jsonData = JSON.parse(htmlContent);
                    verses.push(...this.extractDebijbelVersesForJson(jsonData, book, chapterNum, bookNumber));
                } catch {
                    // If it's not JSON, treat as HTML
                    verses.push(...this.extractGenericVersesForJson($, book, chapterNum, bookNumber));
                }
                break;

            default:
                verses.push(...this.extractGenericVersesForJson($, book, chapterNum, bookNumber));
                break;
        }

        return verses;
    }

    extractBibleComVersesForJson($, book, chapterNum, bookNumber) {
        const verses = [];

        // Try different selectors for Bible.com verses
        const verseSelectors = [
            '.ChapterContent_verse__57FIw', // New format
            '.verse', // Generic
            '[data-usfm]' // USFM data attribute
        ];

        let foundVerses = false;

        for (const selector of verseSelectors) {
            const verseElements = $(selector);

            if (verseElements.length > 0) {
                verseElements.each((index, element) => {
                    const $verse = $(element);

                    // Try to extract verse number from various sources
                    let verseNum = null;

                    // Try data-usfm attribute (e.g., "GEN.1.1")
                    const usfm = $verse.attr('data-usfm');
                    if (usfm) {
                        const usfmMatch = usfm.match(/\d+\.(\d+)$/);
                        if (usfmMatch) {
                            verseNum = parseInt(usfmMatch[1]);
                        }
                    }

                    // Try verse number in label
                    if (!verseNum) {
                        const labelText = $verse.find('.ChapterContent_label__R2PLt').text().trim();
                        if (labelText && /^\d+$/.test(labelText)) {
                            verseNum = parseInt(labelText);
                        }
                    }

                    // Try data-verse attribute
                    if (!verseNum) {
                        const dataVerse = $verse.attr('data-verse');
                        if (dataVerse && /^\d+$/.test(dataVerse)) {
                            verseNum = parseInt(dataVerse);
                        }
                    }

                    // Fallback to sequential numbering
                    if (!verseNum) {
                        verseNum = index + 1;
                    }

                    // Extract verse text, excluding verse numbers
                    let verseText = $verse.find('.ChapterContent_content__RrUqA').text().trim();
                    if (!verseText) {
                        verseText = $verse.text().trim();
                        // Remove leading verse numbers
                        verseText = verseText.replace(/^\d+\s*/, '');
                    }

                    if (verseText && verseText.length > 0) {
                        verses.push({
                            book_name: book.name,
                            book: bookNumber,
                            chapter: chapterNum,
                            verse: verseNum,
                            text: verseText
                        });
                        foundVerses = true;
                    }
                });

                if (foundVerses) {
                    break; // Found verses with this selector, no need to try others
                }
            }
        }

        // Sort verses by verse number to ensure proper order
        verses.sort((a, b) => a.verse - b.verse);

        return verses;
    }

    extractDebijbelVersesForJson(jsonData, book, chapterNum, bookNumber) {
        const verses = [];

        if (jsonData.content && jsonData.content.verses) {
            jsonData.content.verses.forEach(verse => {
                verses.push({
                    book_name: book.name,
                    book: bookNumber,
                    chapter: chapterNum,
                    verse: parseInt(verse.verse),
                    text: verse.text.trim()
                });
            });
        }

        return verses;
    }

    extractGenericVersesForJson($, book, chapterNum, bookNumber) {
        const verses = [];

        // Generic extraction - look for common patterns
        const verseElements = $('p, div, span').filter((index, element) => {
            const text = $(element).text().trim();
            return /^\s*\d+\s/.test(text) && text.length > 10;
        });

        verseElements.each((index, element) => {
            const $element = $(element);
            const text = $element.text().trim();
            const verseMatch = text.match(/^(\d+)\s+(.*)/);

            if (verseMatch) {
                const verseNum = parseInt(verseMatch[1]);
                const verseText = verseMatch[2].trim();

                if (verseText) {
                    verses.push({
                        book_name: book.name,
                        book: bookNumber,
                        chapter: chapterNum,
                        verse: verseNum,
                        text: verseText
                    });
                }
            }
        });

        return verses;
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
        // Determine which language to use for book names
        const translationLanguage = this.translation.language?.toUpperCase() || 'EN';
        const useEnglish = translationLanguage === 'EN';

        // Get the appropriate book names array
        const localizedNames = useEnglish ? bookNames.english : bookNames.dutch;

        // Standard Bible book structure with chapter counts
        const structure = [
            { abbreviation: 'GEN', chapters: 50, bibleComCode: 'GEN' },
            { abbreviation: 'EXO', chapters: 40, bibleComCode: 'EXO' },
            { abbreviation: 'LEV', chapters: 27, bibleComCode: 'LEV' },
            { abbreviation: 'NUM', chapters: 36, bibleComCode: 'NUM' },
            { abbreviation: 'DEU', chapters: 34, bibleComCode: 'DEU' },
            { abbreviation: 'JOS', chapters: 24, bibleComCode: 'JOS' },
            { abbreviation: 'JDG', chapters: 21, bibleComCode: 'JDG' },
            { abbreviation: 'RUT', chapters: 4, bibleComCode: 'RUT' },
            { abbreviation: '1SA', chapters: 31, bibleComCode: '1SA' },
            { abbreviation: '2SA', chapters: 24, bibleComCode: '2SA' },
            { abbreviation: '1KI', chapters: 22, bibleComCode: '1KI' },
            { abbreviation: '2KI', chapters: 25, bibleComCode: '2KI' },
            { abbreviation: '1CH', chapters: 29, bibleComCode: '1CH' },
            { abbreviation: '2CH', chapters: 36, bibleComCode: '2CH' },
            { abbreviation: 'EZR', chapters: 10, bibleComCode: 'EZR' },
            { abbreviation: 'NEH', chapters: 13, bibleComCode: 'NEH' },
            { abbreviation: 'EST', chapters: 10, bibleComCode: 'EST' },
            { abbreviation: 'JOB', chapters: 42, bibleComCode: 'JOB' },
            { abbreviation: 'PSA', chapters: 150, bibleComCode: 'PSA' },
            { abbreviation: 'PRO', chapters: 31, bibleComCode: 'PRO' },
            { abbreviation: 'ECC', chapters: 12, bibleComCode: 'ECC' },
            { abbreviation: 'SNG', chapters: 8, bibleComCode: 'SNG' },
            { abbreviation: 'ISA', chapters: 66, bibleComCode: 'ISA' },
            { abbreviation: 'JER', chapters: 52, bibleComCode: 'JER' },
            { abbreviation: 'LAM', chapters: 5, bibleComCode: 'LAM' },
            { abbreviation: 'EZK', chapters: 48, bibleComCode: 'EZK' },
            { abbreviation: 'DAN', chapters: 12, bibleComCode: 'DAN' },
            { abbreviation: 'HOS', chapters: 14, bibleComCode: 'HOS' },
            { abbreviation: 'JOL', chapters: this.translation.joel3Bible ? 3 : 4, bibleComCode: 'JOL' },
            { abbreviation: 'AMO', chapters: 9, bibleComCode: 'AMO' },
            { abbreviation: 'OBA', chapters: 1, bibleComCode: 'OBA' },
            { abbreviation: 'JON', chapters: 4, bibleComCode: 'JON' },
            { abbreviation: 'MIC', chapters: 7, bibleComCode: 'MIC' },
            { abbreviation: 'NAM', chapters: 3, bibleComCode: 'NAM' },
            { abbreviation: 'HAB', chapters: 3, bibleComCode: 'HAB' },
            { abbreviation: 'ZEP', chapters: 3, bibleComCode: 'ZEP' },
            { abbreviation: 'HAG', chapters: 2, bibleComCode: 'HAG' },
            { abbreviation: 'ZEC', chapters: 14, bibleComCode: 'ZEC' },
            { abbreviation: 'MAL', chapters: this.translation.mal4Bible ? 4 : 3, bibleComCode: 'MAL' },
            { abbreviation: 'MAT', chapters: 28, bibleComCode: 'MAT' },
            { abbreviation: 'MRK', chapters: 16, bibleComCode: 'MRK' },
            { abbreviation: 'LUK', chapters: 24, bibleComCode: 'LUK' },
            { abbreviation: 'JHN', chapters: 21, bibleComCode: 'JHN' },
            { abbreviation: 'ACT', chapters: 28, bibleComCode: 'ACT' },
            { abbreviation: 'ROM', chapters: 16, bibleComCode: 'ROM' },
            { abbreviation: '1CO', chapters: 16, bibleComCode: '1CO' },
            { abbreviation: '2CO', chapters: 13, bibleComCode: '2CO' },
            { abbreviation: 'GAL', chapters: 6, bibleComCode: 'GAL' },
            { abbreviation: 'EPH', chapters: 6, bibleComCode: 'EPH' },
            { abbreviation: 'PHP', chapters: 4, bibleComCode: 'PHP' },
            { abbreviation: 'COL', chapters: 4, bibleComCode: 'COL' },
            { abbreviation: '1TH', chapters: 5, bibleComCode: '1TH' },
            { abbreviation: '2TH', chapters: 3, bibleComCode: '2TH' },
            { abbreviation: '1TI', chapters: 6, bibleComCode: '1TI' },
            { abbreviation: '2TI', chapters: 4, bibleComCode: '2TI' },
            { abbreviation: 'TIT', chapters: 3, bibleComCode: 'TIT' },
            { abbreviation: 'PHM', chapters: 1, bibleComCode: 'PHM' },
            { abbreviation: 'HEB', chapters: 13, bibleComCode: 'HEB' },
            { abbreviation: 'JAS', chapters: 5, bibleComCode: 'JAS' },
            { abbreviation: '1PE', chapters: 5, bibleComCode: '1PE' },
            { abbreviation: '2PE', chapters: 3, bibleComCode: '2PE' },
            { abbreviation: '1JN', chapters: 5, bibleComCode: '1JN' },
            { abbreviation: '2JN', chapters: 1, bibleComCode: '2JN' },
            { abbreviation: '3JN', chapters: 1, bibleComCode: '3JN' },
            { abbreviation: 'JUD', chapters: 1, bibleComCode: 'JUD' },
            { abbreviation: 'REV', chapters: 22, bibleComCode: 'REV' }
        ];

        // Add localized names to each book
        return structure.map((book, index) => ({
            ...book,
            name: localizedNames[index] || bookNames.english[index]
        }));
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

    async adaptiveDelay() {
        // Skip delay if file was already valid (no actual download happened)
        if (this.performanceStats.lastRequestSkipped) {
            this.performanceStats.lastRequestSkipped = false;
            return;
        }

        // Dynamic delay based on source and performance
        let delay = this.delayConfig.currentDelay;

        // Source-specific base delays
        switch (this.translation.source) {
            case 'bible.com':
                delay = Math.max(delay, 150); // Bible.com can handle faster requests
                break;
            case 'basisbijbel.nl':
                delay = Math.max(delay, 300); // Be more conservative with smaller sites
                break;
            case 'debijbel.nl':
                delay = Math.max(delay, 300);
                break;
            default:
                delay = Math.max(delay, 250);
        }

        // Recent rate limit? Be more cautious
        if (this.performanceStats.lastRateLimitTime &&
            (Date.now() - this.performanceStats.lastRateLimitTime) < 60000) {
            delay *= 2;
        }

        // Add small random variation to avoid synchronized requests
        const variation = delay * 0.2;
        const finalDelay = delay + (Math.random() * variation * 2 - variation);

        this.logger?.debug(`Adaptive delay: ${Math.round(finalDelay)}ms (success streak: ${this.performanceStats.consecutiveSuccesses})`);

        await this.delay(Math.round(finalDelay));
    }

    updatePerformanceStats(success, responseTime = 0, error = null) {
        if (success) {
            this.performanceStats.successfulRequests++;
            this.performanceStats.consecutiveSuccesses++;

            // Gradually reduce delay on continued success
            if (this.performanceStats.consecutiveSuccesses >= 5) {
                this.delayConfig.currentDelay = Math.max(
                    this.delayConfig.baseDelay,
                    this.delayConfig.currentDelay * this.delayConfig.rampDownFactor
                );
            }

            // Track average response time
            if (responseTime > 0) {
                const total = this.performanceStats.averageResponseTime * this.performanceStats.successfulRequests;
                this.performanceStats.averageResponseTime = (total + responseTime) / this.performanceStats.successfulRequests;
            }
        } else {
            this.performanceStats.failedRequests++;
            this.performanceStats.consecutiveSuccesses = 0;

            if (error) {
                this.performanceStats.recentErrors.push({
                    error: error.message,
                    timestamp: Date.now()
                });

                // Keep only recent errors (last 10 minutes)
                this.performanceStats.recentErrors = this.performanceStats.recentErrors
                    .filter(e => Date.now() - e.timestamp < 600000);

                // Check for rate limiting indicators
                if (error.message.includes('rate limit') ||
                    error.message.includes('429') ||
                    error.message.includes('Too Many Requests')) {
                    this.performanceStats.lastRateLimitTime = Date.now();
                    this.delayConfig.currentDelay = Math.min(
                        this.delayConfig.maxDelay,
                        this.delayConfig.currentDelay * this.delayConfig.rampUpFactor
                    );
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Static method to export existing HTML files to JSON format
    static async exportToJson(translationId, options = {}) {
        const { translations } = require('../config/translations');
        const translation = translations[translationId.toUpperCase()];

        if (!translation) {
            throw new Error(`Translation ${translationId} not found`);
        }

        const tempService = new DownloadService({
            translationId: translationId.toUpperCase(),
            translation,
            mode: 'json-export',
            downloadId: 'json-export'
        });

        await fs.ensureDir(tempService.jsonDir);

        const bibleStructure = tempService.getBibleStructure();
        const results = {
            translationId: translationId.toUpperCase(),
            booksProcessed: 0,
            totalVerses: 0,
            errors: []
        };
        const index = [];

        // Process each book
        for (let bookIndex = 0; bookIndex < bibleStructure.length; bookIndex++) {
            const book = bibleStructure[bookIndex];

            const bookJson = {
                source: translation.source,
                version: translation.fullName,
                book: book.name,
                chapters: {} // Changed from verses array to chapters object
            };

            let bookHasVerses = false;

            // Collect verses organized by chapter
            for (let chapter = 1; chapter <= book.chapters; chapter++) {
                const filename = `${book.abbreviation}_${chapter.toString().padStart(3, '0')}.html`;
                const filepath = path.join(tempService.htmlDir, filename);

                if (await fs.pathExists(filepath)) {
                    try {
                        const htmlContent = await fs.readFile(
                            filepath,
                            'utf8'
                        );
                        const verses = await tempService.extractVersesForJson(
                            htmlContent,
                            book,
                            chapter,
                            bookIndex + 1
                        );

                        if (verses.length > 0) {
                            bookJson.chapters[chapter] = verses;
                            bookHasVerses = true;
                            results.totalVerses += verses.length;
                        }
                    } catch (error) {
                        results.errors.push({
                            book: book.name,
                            chapter,
                            error: error.message
                        });
                    }
                }
            }

            // Only save if we have verses
            if (bookHasVerses && Object.keys(bookJson.chapters).length > 0) {
                const jsonFilename = `${book.abbreviation}.json`;
                const jsonFilepath = path.join(tempService.jsonDir, jsonFilename);

                await fs.writeFile(
                    jsonFilepath,
                    JSON.stringify(bookJson, null, 2),
                    'utf8'
                );

                results.booksProcessed++;

                // Add to index
                index.push({
                    name: book.name,
                    abbreviation: book.abbreviation,
                    filename: jsonFilename,
                    chapters: book.chapters,
                    source: translation.source
                });
            }
        }

        // Generate index.json
        if (index.length > 0) {
            const indexFilepath = path.join(tempService.jsonDir, 'index.json');
            await fs.writeFile(
                indexFilepath,
                JSON.stringify(index, null, 2),
                'utf8'
            );
        }

        return results;
    }
}

module.exports = DownloadService;
