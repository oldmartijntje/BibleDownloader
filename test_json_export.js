const DownloadService = require('./services/downloadService');
const path = require('path');

// Test JSON export functionality
async function testJsonExport() {
    try {
        console.log('Testing JSON export for ASV translation...');

        const results = await DownloadService.exportToJson('ASV');

        console.log('Export Results:');
        console.log('- Translation ID:', results.translationId);
        console.log('- Books processed:', results.booksProcessed);
        console.log('- Total verses:', results.totalVerses);
        console.log('- Errors:', results.errors.length);

        if (results.errors.length > 0) {
            console.log('Errors encountered:');
            results.errors.forEach(error => {
                console.log(`  - ${error.book} ${error.chapter}: ${error.error}`);
            });
        }

        console.log('\nJSON export completed successfully!');

        // Check if files were created
        const fs = require('fs-extra');
        const jsonDir = path.join(__dirname, 'downloads', 'json', 'ASV');
        if (await fs.pathExists(jsonDir)) {
            const files = await fs.readdir(jsonDir);
            console.log(`\nCreated ${files.length} JSON files in ${jsonDir}`);
            console.log('Sample files:', files.slice(0, 5).join(', '));
        }

    } catch (error) {
        console.error('Error testing JSON export:', error);
    }
}

// Run the test
testJsonExport();
