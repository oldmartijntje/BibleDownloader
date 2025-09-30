const express = require('express');
const router = express.Router();
const { translations, legalDisclaimer } = require('../config/translations');

// Get all available translations
router.get('/', (req, res) => {
    try {
        const { language = 'english' } = req.query;

        // Filter translations based on public domain status if requested
        const { publicDomainOnly } = req.query;

        let filteredTranslations = Object.entries(translations);

        if (publicDomainOnly === 'true') {
            filteredTranslations = filteredTranslations.filter(([key, translation]) =>
                translation.isPublicDomain
            );
        }

        // Format response
        const translationList = filteredTranslations.map(([key, translation]) => ({
            id: key,
            fullName: translation.fullName,
            shortName: translation.shortName,
            language: translation.language,
            license: translation.license,
            isPublicDomain: translation.isPublicDomain,
            source: translation.source,
            comment: translation.comment || ''
        }));

        res.json({
            success: true,
            translations: translationList,
            totalCount: translationList.length,
            publicDomainCount: translationList.filter(t => t.isPublicDomain).length
        });

    } catch (error) {
        req.logger?.error('Error fetching translations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch translations'
        });
    }
});

// Get specific translation details
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const translation = translations[id.toUpperCase()];

        if (!translation) {
            return res.status(404).json({
                success: false,
                error: 'Translation not found'
            });
        }

        res.json({
            success: true,
            translation: {
                id: id.toUpperCase(),
                ...translation
            }
        });

    } catch (error) {
        req.logger?.error('Error fetching translation details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch translation details'
        });
    }
});

// Get translations by language
router.get('/language/:lang', (req, res) => {
    try {
        const { lang } = req.params;
        const languageCode = lang.toLowerCase();

        const translationsByLanguage = Object.entries(translations)
            .filter(([key, translation]) =>
                translation.language.toLowerCase().startsWith(languageCode)
            )
            .map(([key, translation]) => ({
                id: key,
                fullName: translation.fullName,
                shortName: translation.shortName,
                language: translation.language,
                license: translation.license,
                isPublicDomain: translation.isPublicDomain,
                source: translation.source
            }));

        res.json({
            success: true,
            language: languageCode,
            translations: translationsByLanguage,
            count: translationsByLanguage.length
        });

    } catch (error) {
        req.logger?.error('Error fetching translations by language:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch translations by language'
        });
    }
});

// Get public domain translations only
router.get('/public-domain/list', (req, res) => {
    try {
        const publicDomainTranslations = Object.entries(translations)
            .filter(([key, translation]) => translation.isPublicDomain)
            .map(([key, translation]) => ({
                id: key,
                fullName: translation.fullName,
                shortName: translation.shortName,
                language: translation.language,
                source: translation.source,
                comment: translation.comment || ''
            }));

        res.json({
            success: true,
            translations: publicDomainTranslations,
            count: publicDomainTranslations.length
        });

    } catch (error) {
        req.logger?.error('Error fetching public domain translations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch public domain translations'
        });
    }
});

// Get legal disclaimer
router.get('/legal/disclaimer', (req, res) => {
    try {
        const { language = 'english' } = req.query;
        const disclaimer = legalDisclaimer[language] || legalDisclaimer.english;

        res.json({
            success: true,
            disclaimer: {
                title: disclaimer.title,
                content: disclaimer.content
            },
            language
        });

    } catch (error) {
        req.logger?.error('Error fetching legal disclaimer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch legal disclaimer'
        });
    }
});

// Get available languages
router.get('/meta/languages', (req, res) => {
    try {
        const languages = [...new Set(
            Object.values(translations).map(translation => translation.language)
        )].sort();

        const languageCounts = {};
        Object.values(translations).forEach(translation => {
            const lang = translation.language;
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        });

        res.json({
            success: true,
            languages: languages.map(lang => ({
                code: lang,
                count: languageCounts[lang]
            })),
            totalLanguages: languages.length
        });

    } catch (error) {
        req.logger?.error('Error fetching language metadata:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch language metadata'
        });
    }
});

module.exports = router;
