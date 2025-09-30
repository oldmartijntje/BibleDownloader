const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const readline = require('readline');
const net = require('net');
require('dotenv').config();

const translationRoutes = require('./routes/translations');
const downloadRoutes = require('./routes/downloads');
const fileRoutes = require('./routes/files');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'bible-downloader' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Ensure required directories exist
const ensureDirectories = async () => {
    try {
        await fs.ensureDir('./downloads');
        await fs.ensureDir('./downloads/html');
        await fs.ensureDir('./downloads/bible');
        await fs.ensureDir('./logs');
        await fs.ensureDir('./temp');
    } catch (error) {
        logger.error('Failed to create required directories:', error);
    }
};

// Check if port is available
const isPortAvailable = (port) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
};

// Get a random available port
const getRandomPort = () => {
    return Math.floor(Math.random() * (65535 - 3001) + 3001);
};

// Find an available port starting from a random one
const findAvailablePort = async () => {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        const port = getRandomPort();
        if (await isPortAvailable(port)) {
            return port;
        }
        attempts++;
    }

    throw new Error('Could not find an available port after multiple attempts');
};

// Prompt user for port selection
const promptForPortChoice = (defaultPort, alternativePort) => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(`\x1b[33m⚠ Port ${defaultPort} is already in use.\x1b[0m`);
        console.log(`\x1b[36mWould you like to run the server on port ${alternativePort} instead?\x1b[0m`);

        rl.question('\x1b[32m? (Y/n): \x1b[0m', (answer) => {
            rl.close();
            const choice = answer.toLowerCase().trim();
            resolve(choice === '' || choice === 'y' || choice === 'yes');
        });
    });
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Make logger available to routes
app.use((req, res, next) => {
    req.logger = logger;
    next();
});

// Routes
app.use('/api/translations', translationRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/files', fileRoutes);

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT. Graceful shutdown...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});

// Start server with port conflict handling
const startServer = async () => {
    try {
        await ensureDirectories();

        let serverPort = PORT;

        // Check if the default port is available
        if (!(await isPortAvailable(PORT))) {
            try {
                // Find an alternative port
                const alternativePort = await findAvailablePort();

                // Ask user if they want to use the alternative port
                const useAlternative = await promptForPortChoice(PORT, alternativePort);

                if (useAlternative) {
                    serverPort = alternativePort;
                    logger.info(`Using alternative port ${serverPort}`);
                } else {
                    console.log('\x1b[31m✖ Server startup cancelled by user.\x1b[0m');
                    console.log(`\x1b[33m💡 Tip: You can free up port ${PORT} by running: \x1b[36mlsof -ti:${PORT} | xargs kill\x1b[0m`);
                    console.log(`\x1b[33m💡 Or specify a different port: \x1b[36mPORT=3001 npm start\x1b[0m`);
                    process.exit(0);
                }
            } catch (portError) {
                logger.error('Could not find an available port:', portError);
                console.log(`\x1b[31m✖ Unable to find an available port. Please free up port ${PORT} or specify a different port using PORT environment variable.\x1b[0m`);
                process.exit(1);
            }
        }

        // Start the server on the determined port
        const server = app.listen(serverPort, () => {
            console.log('\x1b[32m✓ Bible Downloader server started successfully!\x1b[0m');
            logger.info(`Bible Downloader server running on port ${serverPort}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`\x1b[36m🌐 Access the application at: \x1b[4mhttp://localhost:${serverPort}\x1b[0m`);

            if (serverPort !== PORT) {
                console.log(`\x1b[33m📝 Note: Running on port ${serverPort} instead of default port ${PORT}\x1b[0m`);
            }
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${serverPort} is still in use`);
                console.log(`\x1b[31m✖ Port ${serverPort} is unexpectedly in use. Please try again.\x1b[0m`);
            } else {
                logger.error('Server error:', error);
                console.log(`\x1b[31m✖ Server error: ${error.message}\x1b[0m`);
            }
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        console.log(`\x1b[31m✖ Failed to start server: ${error.message}\x1b[0m`);
        process.exit(1);
    }
};

startServer();

module.exports = app;
