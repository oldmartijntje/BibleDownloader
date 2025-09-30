# Installation Guide - Bible Downloader Node.js

This guide will help you set up and run the Bible Downloader Node.js application on your system.

## Prerequisites

### System Requirements
- **Node.js**: Version 16.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **RAM**: At least 2GB available
- **Storage**: 5GB+ free space (Bible downloads can be large)
- **Internet**: Stable connection for downloading translations

### Check Node.js Installation
```bash
node --version
npm --version
```

If Node.js is not installed, download it from [nodejs.org](https://nodejs.org/)

## Quick Start

### Option 1: Automated Setup (Recommended)

1. **Download or clone the project**
   ```bash
   # If you have git
   git clone <repository-url>
   cd bible-downloader-node
   
   # Or download and extract the ZIP file
   ```

2. **Run the setup script**
   ```bash
   node setup.js
   ```
   
   This will:
   - Check Node.js version
   - Install all dependencies
   - Create required directories
   - Set up configuration files
   - Create .gitignore

3. **Start the application**
   ```bash
   # Development mode (auto-restart on changes)
   npm run dev
   
   # Or production mode
   npm start
   ```

4. **Open in browser**
   - Navigate to `http://localhost:3000`

### Option 2: Manual Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create required directories**
   ```bash
   mkdir -p downloads/bible downloads/html logs temp
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables (.env)

Key settings you may want to modify:

```bash
# Server port
PORT=3000

# Development or production
NODE_ENV=development

# Download settings
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT=30000
RATE_LIMIT_DELAY=2000

# Legal compliance
REQUIRE_LEGAL_AGREEMENT=true
DEFAULT_PUBLIC_DOMAIN_ONLY=true
```

### Directory Structure

After setup, your project will have:

```
bible-downloader-node/
├── config/                 # Configuration files
├── downloads/              # Downloaded files
│   ├── bible/             # .bible format files
│   └── html/              # Raw HTML files
├── logs/                  # Application logs
├── public/                # Frontend files
├── routes/                # API routes
├── services/              # Business logic
├── temp/                  # Temporary files
├── tests/                 # Test files
├── .env                   # Environment config
├── server.js              # Main server file
└── package.json           # Dependencies
```

## Usage

### Starting the Application

**Development Mode** (recommended during setup):
```bash
npm run dev
```
- Automatically restarts when you modify files
- Detailed error messages
- Development logging

**Production Mode**:
```bash
npm start
```
- Optimized for performance
- Production logging
- More stable

### Web Interface

1. **Open your browser** to `http://localhost:3000`

2. **Select interface language** (English or Dutch)

3. **Read the legal notice** and agree if applicable

4. **Choose a Bible translation**:
   - Green cards = Public domain (free to use)
   - Yellow cards = Copyrighted (requires legal agreement)

5. **Select download mode**:
   - **Download Only**: Gets HTML files for later processing
   - **Full Process**: Downloads and converts to .bible format

6. **Monitor progress** in real-time

7. **Access downloaded files** in the Files section

### API Usage

The application also provides a REST API:

```bash
# Get available translations
curl http://localhost:3000/api/translations

# Start a download
curl -X POST http://localhost:3000/api/downloads/start \
  -H "Content-Type: application/json" \
  -d '{"translationId": "KJV", "mode": "full"}'

# Check progress
curl http://localhost:3000/api/downloads/progress/[download-id]

# List files
curl http://localhost:3000/api/files
```

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Change port in .env file or use environment variable
PORT=3001 npm start
```

**Permission errors**:
```bash
# On Linux/Mac, you might need to create directories manually
sudo mkdir -p downloads logs temp
sudo chown $USER:$USER downloads logs temp
```

**Module not found errors**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Download failures**:
- Check your internet connection
- Some sources may have rate limiting
- Try downloading different translations
- Check logs in `logs/` directory

### Logs and Debugging

**View logs**:
```bash
# Real-time logs in development
npm run dev

# Check log files
tail -f logs/combined.log
tail -f logs/error.log
```

**Enable debug mode**:
```bash
NODE_ENV=development npm start
```

### Performance Tips

**For large downloads**:
- Close unnecessary browser tabs
- Ensure stable internet connection
- Consider using "Download Only" mode first
- Monitor disk space

**For multiple translations**:
- Download one at a time for best results
- Public domain translations are faster
- Use the progress monitoring to track status

## Legal Compliance

### Important Notes

1. **Public Domain Translations**: No restrictions
   - KJV, ASV, WEB, SV1637, LS1910, etc.

2. **Copyrighted Translations**: Requires legal agreement
   - Must be natural person (not corporation)
   - Personal/home use only
   - Must already own legal copy
   - Check your local copyright laws

3. **Rate Limiting**: 
   - Application includes respectful delays
   - Some sources may still rate limit
   - Be patient with downloads

### Creating Legal Agreement File

For copyrighted translations, the original MATLAB version required creating a specific file. This Node.js version uses checkbox agreement instead, but you should still understand your legal obligations.

## Getting Help

### Documentation
- Check README.md for detailed information
- Review configuration files for options
- Check the logs for error messages

### Support
- Create an issue in the project repository
- Include error logs and system information
- Describe steps to reproduce problems

### Contributing
- Fork the repository
- Create feature branches
- Add tests for new functionality
- Submit pull requests

## Updating

To update the application:

```bash
# Pull latest changes (if using git)
git pull origin main

# Update dependencies
npm update

# Restart application
npm restart
```

## Uninstalling

To remove the application:

```bash
# Remove files (keep your downloads if desired)
rm -rf node_modules logs temp
# Keep or remove: downloads/ .env

# Or remove everything
rm -rf bible-downloader-node/
```

---

**Enjoy using the Bible Downloader!** 

This Node.js version brings the powerful MATLAB Bible Downloader to everyone, regardless of MATLAB knowledge. The application maintains the same legal compliance and respectful downloading practices as the original.
