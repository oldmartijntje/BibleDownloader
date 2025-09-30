#!/usr/bin/env node

/**
 * Test script to demonstrate port conflict handling
 * This script starts two server instances to test the port conflict resolution
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing port conflict handling...\n');

// Start first server instance
console.log('1. Starting first server instance on port 3000...');
const server1 = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: ['inherit', 'pipe', 'pipe']
});

server1.stdout.on('data', (data) => {
    console.log(`[Server 1] ${data.toString().trim()}`);
});

server1.stderr.on('data', (data) => {
    console.error(`[Server 1 Error] ${data.toString().trim()}`);
});

// Wait a bit for first server to start
setTimeout(() => {
    console.log('\n2. Starting second server instance (should trigger port conflict prompt)...');

    const server2 = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: ['inherit', 'pipe', 'pipe']
    });

    server2.stdout.on('data', (data) => {
        console.log(`[Server 2] ${data.toString().trim()}`);
    });

    server2.stderr.on('data', (data) => {
        console.error(`[Server 2 Error] ${data.toString().trim()}`);
    });

    // Clean up after 10 seconds
    setTimeout(() => {
        console.log('\n🧹 Cleaning up processes...');
        server1.kill('SIGTERM');
        server2.kill('SIGTERM');

        setTimeout(() => {
            console.log('✓ Test completed!');
            process.exit(0);
        }, 1000);
    }, 10000);

}, 3000);

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n🧹 Cleaning up...');
    server1.kill('SIGTERM');
    if (server2) server2.kill('SIGTERM');
    process.exit(0);
});
