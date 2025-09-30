const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Bible Downloader Node.js project...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
    console.error('❌ Node.js version 16.0.0 or higher is required');
    console.error(`   Current version: ${nodeVersion}`);
    process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Dependencies installed successfully');
} catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error(error.message);
    process.exit(1);
}

// Create required directories
const requiredDirs = [
    './downloads',
    './downloads/bible',
    './downloads/html',
    './logs',
    './temp'
];

console.log('\n📁 Creating required directories...');
requiredDirs.forEach(dir => {
    const fullPath = path.resolve(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    } else {
        console.log(`ℹ️  Directory already exists: ${dir}`);
    }
});

// Copy environment file
console.log('\n⚙️  Setting up environment configuration...');
const envExamplePath = path.resolve(__dirname, '.env.example');
const envPath = path.resolve(__dirname, '.env');

if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ Created .env file from .env.example');
    } else {
        // Create a basic .env file
        const basicEnvContent = `PORT=3000
NODE_ENV=development
DOWNLOADS_DIR=./downloads
LOGS_DIR=./logs
`;
        fs.writeFileSync(envPath, basicEnvContent);
        console.log('✅ Created basic .env file');
    }
} else {
    console.log('ℹ️  .env file already exists');
}

// Create gitignore if it doesn't exist
console.log('\n📝 Setting up .gitignore...');
const gitignorePath = path.resolve(__dirname, '.gitignore');
const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Downloads (you may want to keep these or move them elsewhere)
downloads/
temp/

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db
`;

if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('✅ Created .gitignore file');
} else {
    console.log('ℹ️  .gitignore file already exists');
}

// Display completion message
console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('   1. Review and modify .env file if needed');
console.log('   2. Start the development server:');
console.log('      npm run dev');
console.log('   3. Open your browser to http://localhost:3000');
console.log('\n📚 Additional information:');
console.log('   • Check README.md for detailed usage instructions');
console.log('   • Ensure you understand the legal requirements for downloading copyrighted translations');
console.log('   • The application will create download directories automatically');
console.log('\n⚖️  Legal Notice:');
console.log('   This application respects copyright laws. Users are responsible for ensuring');
console.log('   their use complies with local laws and translation license terms.');
console.log('\n🔗 Project repository: https://github.com/yourusername/bible-downloader-node');
console.log('   (Update this URL when you publish the project)');

console.log('\n✨ Happy downloading!');
