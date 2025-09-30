# Bible Downloader - Node.js Version

A modern Node.js web application for downloading various Bible translations from multiple sources. This is a complete rewrite of the original MATLAB Bible Downloader, making it accessible to users without MATLAB knowledge.

## Features

- **Web-based GUI**: Modern, responsive web interface
- **Multiple Bible Translations**: Support for dozens of translations in various languages
- **Multiple Sources**: Downloads from bible.com and other public sources
- **Public Domain Focus**: Prioritizes public domain translations
- **Progress Tracking**: Real-time download progress updates
- **File Export**: Generates standardized .bible format files
- **Multi-language Support**: Interface available in English and Dutch
- **Legal Compliance**: Built-in legal disclaimers and copyright awareness

## Supported Translations

### English
- ASV: American Standard Version
- KJV: King James Version
- NASB: New American Standard Bible
- WEB: World English Bible

### Dutch
- BB: de Basisbijbel
- HB: Het Boek
- NB: de Naardense Bijbel
- NBG51: de Nieuwe Vertaling (1951)
- SV1750: de Statenvertaling (1750)
- And many more...

### Other Languages
- French: LS1910 (Luis Segond 1910)
- Spanish: RV1602 (Reina Valera 1602)

## Installation

1. **Prerequisites**: Node.js 16.0.0 or higher

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Copy `.env.example` to `.env` and configure as needed.

4. **Start the application**:
   ```bash
   # Production
   npm start
   
   # Development (with auto-restart)
   npm run dev
   ```

   **Port Conflict Handling**: If port 3000 is already in use, the application will automatically detect this and prompt you to use an alternative port, similar to Angular CLI behavior.

5. **Access the application**:
   Open your browser to `http://localhost:3000`

## Usage

1. **Select Language**: Choose your preferred interface language
2. **Choose Translation**: Select from available Bible translations
3. **Download Mode**: 
   - "Download Only": Downloads HTML files for later processing
   - "Full Process": Downloads and converts to .bible format
4. **Monitor Progress**: Watch real-time progress updates
5. **Access Files**: Downloaded files are saved in the `downloads` folder

### Resume Functionality

The application includes intelligent resume functionality:

- **Automatic Detection**: When restarting a cancelled download, the system automatically detects existing files
- **File Validation**: Checks existing files for:
  - Minimum size requirements (>100 bytes)
  - Valid HTML content structure
  - Absence of error indicators (404, access denied, etc.)
- **Smart Cleanup**: Automatically removes corrupted or incomplete files
- **Progress Tracking**: Accurately shows remaining work after accounting for existing valid files

**Example Resume Process:**
```
Found 23 existing valid files, 2 files need re-downloading...
Skipping Genesis 1 - already downloaded
Downloading Genesis 2...
```

## File Format

The application generates `.bible` files in UTF-8 format with the following structure:

```
{
"long name": "Full Translation Name",
"short name": "Abbreviation",
"sheet name": "ExcelCompatibleName",
"license": "Copyright Information",
"language": "ISO 639-1 Code - Native Name"
}
~~~~
{01001001} {Verse text here}
{01001002} {Next verse text}
...
```

## Legal Notice

This application respects copyright laws and focuses primarily on public domain translations. For copyrighted translations, users must:

1. Be a natural person (not acting for a corporation)
2. Use downloads for personal/home use only
3. Already own a legally acquired copy of the translation

**Users are responsible for ensuring their use complies with local copyright laws.**

## Development

### Project Structure
```
node-bible-downloader/
├── server.js              # Main server file
├── config/                # Configuration files
├── controllers/           # Route controllers
├── models/               # Data models
├── services/             # Business logic
├── routes/               # API routes
├── public/               # Static frontend files
├── views/                # HTML templates
├── utils/                # Utility functions
├── downloads/            # Output directory
└── tests/                # Test files
```

### Port Management

The server includes intelligent port conflict handling:

- **Automatic Detection**: Checks if the default port (3000) is available
- **Interactive Prompts**: When port 3000 is occupied, prompts user to accept a random alternative port
- **Helpful Messages**: Provides clear feedback and suggestions for resolving conflicts
- **Custom Port**: Use `PORT=3001 npm start` to specify a different port

Example interaction:
```
⚠ Port 3000 is already in use.
Would you like to run the server on port 27882 instead?
? (Y/n): y
✓ Bible Downloader server started successfully!
🌐 Access the application at: http://localhost:27882
📝 Note: Running on port 27882 instead of default port 3000
```

### API Endpoints

- `GET /` - Main application interface
- `GET /api/translations` - List available translations
- `POST /api/download` - Start download process
- `GET /api/progress/:id` - Check download progress
- `GET /api/files` - List downloaded files

### Testing
```bash
# Run main test suite
npm test

# Test port conflict handling (demonstrates automatic port detection)
npm run test:port-conflict

# Test resume functionality (creates test files and validates detection logic)
npm run test:resume
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)

## Credits

- Original MATLAB version by H.J. Wisselink
- Node.js conversion maintains the same functionality and legal compliance
- Uses the Wayback Machine API for historical web content access

## Disclaimer

This software is provided as-is. Users are responsible for ensuring their use complies with all applicable laws and regulations. The developers assume no liability for misuse or legal violations.
