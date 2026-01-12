// Bible translation configurations
// Converted from the original MATLAB BibleDownloader

const translations = {
    // English translations
    ASV: {
        fullName: 'American Standard Version',
        shortName: 'ASV',
        sheetName: 'ASV',
        language: 'en - English',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 12,
        joel3Bible: true,
        mal4Bible: true,
        comment: 'http://web.archive.org/web/201710/https://www.bible.com/versions/12',
        language: "EN"
    },

    KJV: {
        fullName: 'King James Version',
        shortName: 'KJV',
        sheetName: 'KJV',
        language: 'en - English',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 1,
        joel3Bible: true,
        mal4Bible: true,
        comment: 'http://web.archive.org/web/201709/https://www.bible.com/versions/1',
        language: "EN"
    },

    NASB: {
        fullName: 'New American Standard Bible',
        shortName: 'NASB',
        sheetName: 'NASB',
        language: 'en - English',
        license: 'Copyright 1960, 1962, 1963, 1968, 1971, 1972, 1973, 1975, 1977, 1995 by The Lockman Foundation',
        isPublicDomain: false,
        source: 'bible.com',
        bibleComId: 100,
        joel3Bible: true,
        mal4Bible: true,
        comment: 'Requires legal agreement for non-public domain use',
        language: "EN"
    },

    WEB: {
        fullName: 'World English Bible',
        shortName: 'WEB',
        sheetName: 'WEB',
        language: 'en - English',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 206,
        joel3Bible: true,
        mal4Bible: true,
        comment: 'http://web.archive.org/web/201709/https://www.bible.com/versions/206',
        language: "EN"
    },

    HB: {
        fullName: 'Het Boek',
        shortName: 'HB',
        sheetName: 'HB',
        language: 'nl - Nederlands',
        license: 'Copyright 1979, 1988, 2007 by Biblica, Inc.®',
        isPublicDomain: false,
        source: 'bible.com',
        bibleComId: 75,
        joel3Bible: true,
        mal4Bible: true,
        comment: '',
        language: "NL"
    },

    SV1750: {
        fullName: 'Statenvertaling (1750)',
        shortName: 'SV1750',
        sheetName: 'SV1750',
        language: 'nl - Nederlands',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 165,
        joel3Bible: true,
        mal4Bible: true,
        comment: '',
        language: "NL"
    },

    // French translations
    LS1910: {
        fullName: 'Luis Segond (1910)',
        shortName: 'LS1910',
        sheetName: 'LS1910',
        language: 'fr - Français',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 93,
        joel3Bible: true,
        mal4Bible: true,
        comment: '',
        language: "FR"
    },

    // Spanish translations
    RV1602: {
        fullName: 'Reina Valera (1602)',
        shortName: 'RV1602',
        sheetName: 'RV1602',
        language: 'es - Español',
        license: 'Public domain',
        isPublicDomain: true,
        source: 'bible.com',
        bibleComId: 147,
        joel3Bible: true,
        mal4Bible: true,
        comment: '',
        language: "ES"
    }
};

// Bible.com additional translations (from original MATLAB code)
const bibleComTranslations = {
    7: { name: 'Bibla Shqip', language: 'sq - Shqip', isPublicDomain: true },
    25: { name: 'Navarro-Labourdin Basque', language: 'eu - Euskara', isPublicDomain: true },
    42: { name: 'World Messianic Bible British Edition', language: 'en - English', isPublicDomain: true },
    44: { name: 'World Messianic Bible', language: 'en - English', isPublicDomain: true },
    // Add more as needed from the original list
};

// Book names mapping (English to Dutch and other languages)
const bookNames = {
    english: [
        'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges',
        'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
        'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes',
        'Song of Songs', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
        'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
        'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
        'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
        'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
        '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter',
        '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
    ],
    dutch: [
        'Genesis', 'Exodus', 'Leviticus', 'Numeri', 'Deuteronomium', 'Jozua', 'Rechters',
        'Ruth', '1 Samuel', '2 Samuel', '1 Koningen', '2 Koningen', '1 Kronieken', '2 Kronieken',
        'Ezra', 'Nehemia', 'Esther', 'Job', 'Psalmen', 'Spreuken', 'Prediker',
        'Hooglied', 'Jesaja', 'Jeremia', 'Klaagliederen', 'Ezechiel', 'Daniel',
        'Hosea', 'Joel', 'Amos', 'Obadja', 'Jona', 'Micha', 'Nahum', 'Habakuk',
        'Sefanja', 'Haggai', 'Zacharia', 'Maleachi', 'Matteus', 'Markus', 'Lukas',
        'Johannes', 'Handelingen', 'Romeinen', '1 Korinthiers', '2 Korinthiers', 'Galaten',
        'Efeziers', 'Filippenzen', 'Kolossenzen', '1 Thessalonicenzen', '2 Thessalonicenzen',
        '1 Timoteus', '2 Timoteus', 'Titus', 'Filemon', 'Hebreeen', 'Jakobus', '1 Petrus',
        '2 Petrus', '1 Johannes', '2 Johannes', '3 Johannes', 'Judas', 'Openbaring'
    ]
};

// Source URL patterns
const sourcePatterns = {
    'bible.com': {
        baseUrl: 'https://www.bible.com',
        chapterPattern: '/bible/{id}/{book}.{chapter}.{translation}',
        waybackPattern: 'http://web.archive.org/web/{date}if_/https://www.bible.com/bible/{id}/{book}.{chapter}.{translation}'
    },
    'basisbijbel.nl': {
        baseUrl: 'https://www.basisbijbel.nl',
        chapterPattern: '/boek/{book}/{chapter}'
    },
    'debijbel.nl': {
        baseUrl: 'https://www.debijbel.nl',
        chapterPattern: '/api/bible/passage?identifier={book}{chapter}&language=nl&version={version}'
    }
    // Add other sources as needed
};

// Legal disclaimer text - this is the legal notice as it was displayed on the repository that I have forked (https://github.com/thrynae/BibleDownloader)
const legalDisclaimer = {
    english: {
        title: 'IMPORTANT LEGAL NOTICE',
        content: [
            'NOTE: This is the legal notice as it was displayed on the repository that I have forked (https://github.com/thrynae/BibleDownloader). If you think something is wrong or inaccurate, let me know and I\'ll take action accordingly. I am no legal expert.',
            '',
            'Under Dutch law, downloading a copy of a copyright protected work is allowed if you are a natural person (i.e. a human, and not acting for a corporation) and the copy is for personal (home) use only, under the condition that you already own an otherwise legally acquired copy.',
            '',
            'WARNING: The law of your jurisdiction might be different. It may prohibit the use of this script or set different requirements.',
            '',
            'Users must take full legal responsibility for the use of this application and the files it generates. By using this application, you agree to these terms and confirm that your use is legal in your jurisdiction.'
        ]
    },
    dutch: {
        title: 'BELANGRIJK JURIDISCH BERICHT',
        content: [
            'OPMERKING: Dit is de juridische kennisgeving zoals deze werd weergegeven in de repository die ik heb geforkt (https://github.com/thrynae/BibleDownloader). Als je denkt dat er iets klopt niet of onnauwkeurig is, laat het me weten en ik zal dienovereenkomstig actie ondernemen. Ik ben geen juridisch expert.',
            '',
            'Het is onder het Nederlandse auteursrecht toegestaan om een kopie te maken van een werk waar auteursrecht op rust. Hiervoor gelden onder meer als voorwaarden dat de gebruiker een natuurlijke persoon is, dat het gaat om een thuiskopie voor eigen gebruik, en dat de gebruiker al een exemplaar in bezit heeft.',
            '',
            'WAARSCHUWING: De wet in uw jurisdictie kan anders zijn. Het kan het gebruik van deze applicatie verbieden of andere vereisten stellen.',
            '',
            'Gebruikers moeten de volledige juridische verantwoordelijkheid nemen voor het gebruik van deze applicatie en de bestanden die het genereert.'
        ]
    }
};

module.exports = {
    translations,
    bibleComTranslations,
    bookNames,
    sourcePatterns,
    legalDisclaimer
};
