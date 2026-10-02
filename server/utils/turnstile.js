const https = require('https');

const developmentSecret = '1x0000000000000000000000000000000AA';

const verifyTurnstileToken = (token) => new Promise((resolve) => {
    const secret = process.env.TURNSTILE_SECRET_KEY
        || (process.env.NODE_ENV === 'production' ? '' : developmentSecret);
    if (!secret || typeof token !== 'string' || !token.trim()) {
        resolve(false);
        return;
    }

    const payload = new URLSearchParams({ secret, response: token }).toString();
    const request = https.request({
        hostname: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { responseBody += chunk; });
        response.on('end', () => {
            try {
                const result = JSON.parse(responseBody);
                resolve(response.statusCode >= 200 && response.statusCode < 300 && result.success === true);
            } catch {
                resolve(false);
            }
        });
    });

    request.setTimeout(10000, () => request.destroy(new Error('Turnstile verification timed out.')));
    request.on('error', () => resolve(false));
    request.end(payload);
});

module.exports = verifyTurnstileToken;