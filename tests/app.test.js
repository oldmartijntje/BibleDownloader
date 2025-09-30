const request = require('supertest');
const app = require('../server');

describe('Bible Downloader API', () => {
    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('GET /api/translations', () => {
        it('should return list of translations', async () => {
            const response = await request(app)
                .get('/api/translations')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('translations');
            expect(Array.isArray(response.body.translations)).toBe(true);
            expect(response.body).toHaveProperty('totalCount');
            expect(response.body).toHaveProperty('publicDomainCount');
        });

        it('should filter public domain translations', async () => {
            const response = await request(app)
                .get('/api/translations?publicDomainOnly=true')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            response.body.translations.forEach(translation => {
                expect(translation.isPublicDomain).toBe(true);
            });
        });
    });

    describe('GET /api/translations/:id', () => {
        it('should return specific translation details', async () => {
            const response = await request(app)
                .get('/api/translations/KJV')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.translation).toHaveProperty('id', 'KJV');
            expect(response.body.translation).toHaveProperty('fullName');
            expect(response.body.translation).toHaveProperty('isPublicDomain');
        });

        it('should return 404 for non-existent translation', async () => {
            const response = await request(app)
                .get('/api/translations/NONEXISTENT')
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Translation not found');
        });
    });

    describe('GET /api/translations/legal/disclaimer', () => {
        it('should return legal disclaimer in English', async () => {
            const response = await request(app)
                .get('/api/translations/legal/disclaimer?language=english')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.disclaimer).toHaveProperty('title');
            expect(response.body.disclaimer).toHaveProperty('content');
            expect(Array.isArray(response.body.disclaimer.content)).toBe(true);
        });

        it('should return legal disclaimer in Dutch', async () => {
            const response = await request(app)
                .get('/api/translations/legal/disclaimer?language=dutch')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.language).toBe('dutch');
        });
    });

    describe('GET /api/files', () => {
        it('should return list of files', async () => {
            const response = await request(app)
                .get('/api/files')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('files');
            expect(Array.isArray(response.body.files)).toBe(true);
            expect(response.body).toHaveProperty('count');
        });

        it('should filter by file type', async () => {
            const response = await request(app)
                .get('/api/files?type=bible')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            response.body.files.forEach(file => {
                expect(file.type).toBe('bible');
            });
        });
    });

    describe('POST /api/downloads/start', () => {
        it('should reject download without translation ID', async () => {
            const response = await request(app)
                .post('/api/downloads/start')
                .send({})
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Translation ID is required');
        });

        it('should reject download of non-existent translation', async () => {
            const response = await request(app)
                .post('/api/downloads/start')
                .send({
                    translationId: 'NONEXISTENT',
                    mode: 'full',
                    legalAgreement: true
                })
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Translation not found');
        });

        it('should require legal agreement for copyrighted material', async () => {
            const response = await request(app)
                .post('/api/downloads/start')
                .send({
                    translationId: 'NASB', // This is copyrighted
                    mode: 'full',
                    legalAgreement: false
                })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.requiresLegalAgreement).toBe(true);
        });

        it('should start download for public domain translation', async () => {
            const response = await request(app)
                .post('/api/downloads/start')
                .send({
                    translationId: 'KJV', // This is public domain
                    mode: 'download-only',
                    legalAgreement: false
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('downloadId');
            expect(response.body.translationId).toBe('KJV');
            expect(response.body.mode).toBe('download-only');
        });
    });
});
