#!/usr/bin/env node

/**
 * Test script to demonstrate resume functionality
 * This script creates some test files and tests the resume functionality
 */

const fs = require('fs-extra');
const path = require('path');

async function createTestFiles() {
    const testDir = path.join(__dirname, 'downloads', 'html', 'TEST');
    await fs.ensureDir(testDir);

    console.log('🧪 Creating test files for resume functionality...\n');

    // Create a valid file
    const validFile = path.join(testDir, 'GEN_001.html');
    const validContent = `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Genesis 1</h1><p>In the beginning...</p></body></html>`;
    await fs.writeFile(validFile, validContent, 'utf8');
    console.log('✅ Created valid file: GEN_001.html');

    // Create an empty file (should be re-downloaded)
    const emptyFile = path.join(testDir, 'GEN_002.html');
    await fs.writeFile(emptyFile, '', 'utf8');
    console.log('⚠️  Created empty file: GEN_002.html (should be marked for re-download)');

    // Create a small invalid file (should be re-downloaded)
    const smallFile = path.join(testDir, 'GEN_003.html');
    await fs.writeFile(smallFile, 'error', 'utf8');
    console.log('⚠️  Created small invalid file: GEN_003.html (should be marked for re-download)');

    // Create an error content file (should be re-downloaded)
    const errorFile = path.join(testDir, 'GEN_004.html');
    const errorContent = `<html><body><h1>404 Not Found</h1></body></html>`;
    await fs.writeFile(errorFile, errorContent, 'utf8');
    console.log('⚠️  Created error content file: GEN_004.html (should be marked for re-download)');

    // Create a file with non-HTML content (should be re-downloaded)
    const nonHtmlFile = path.join(testDir, 'GEN_005.html');
    const nonHtmlContent = `{"error": "Not authorized"}`;
    await fs.writeFile(nonHtmlFile, nonHtmlContent, 'utf8');
    console.log('⚠️  Created non-HTML file: GEN_005.html (should be marked for re-download)');

    console.log('\n📁 Test files created in:', testDir);
    console.log('\n🎯 Expected behavior:');
    console.log('   - GEN_001.html: Should be skipped (valid)');
    console.log('   - GEN_002.html: Should be re-downloaded (empty)');
    console.log('   - GEN_003.html: Should be re-downloaded (too small)');
    console.log('   - GEN_004.html: Should be re-downloaded (error content)');
    console.log('   - GEN_005.html: Should be re-downloaded (non-HTML)');
    console.log('\n💡 You can now test the resume functionality by:');
    console.log('   1. Starting a download for a "TEST" translation');
    console.log('   2. Cancelling it partway through');
    console.log('   3. Starting it again to see the resume behavior');
}

// Test the file validation logic
async function testFileValidation() {
    const DownloadService = require('./services/downloadService');

    // Create a mock download service instance
    const mockOptions = {
        translationId: 'TEST',
        translation: { shortName: 'TEST' },
        mode: 'download-only',
        downloadId: 'test-123',
        logger: console
    };

    const service = new DownloadService(mockOptions);
    const testDir = path.join(__dirname, 'downloads', 'html', 'TEST');

    console.log('\n🔍 Testing file validation logic...\n');

    const testFiles = [
        'GEN_001.html', // valid
        'GEN_002.html', // empty
        'GEN_003.html', // too small
        'GEN_004.html', // error content
        'GEN_005.html', // non-HTML
        'GEN_006.html'  // non-existent
    ];

    for (const filename of testFiles) {
        const filepath = path.join(testDir, filename);
        const isValid = await service.isValidExistingFile(filepath);
        const exists = await fs.pathExists(filepath);

        let status = '❓ Unknown';
        if (!exists) {
            status = '❌ Missing';
        } else if (isValid) {
            status = '✅ Valid';
        } else {
            status = '⚠️  Invalid';
        }

        console.log(`${status} ${filename}`);
    }
}

async function main() {
    try {
        await createTestFiles();
        await testFileValidation();

        console.log('\n🎉 Test setup complete!');
        console.log('\n🧹 To clean up test files, run:');
        console.log('   rm -rf downloads/html/TEST');

    } catch (error) {
        console.error('❌ Error during test setup:', error);
    }
}

main();
