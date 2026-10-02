import { useEffect, useRef, useState } from 'react';

const developmentSiteKey = '1x00000000000000000000AA';
let scriptPromise;

const loadTurnstile = () => {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(window.turnstile);
            script.onerror = () => reject(new Error('Could not load CAPTCHA verification.'));
            document.head.appendChild(script);
        }).catch((error) => {
            scriptPromise = null;
            throw error;
        });
    }
    return scriptPromise;
};

const TurnstileCaptcha = ({ onToken }) => {
    const containerRef = useRef(null);
    const onTokenRef = useRef(onToken);
    const [error, setError] = useState('');
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? developmentSiteKey : '');

    onTokenRef.current = onToken;

    useEffect(() => {
        if (!siteKey) {
            setError('CAPTCHA is not configured. Please contact the site administrator.');
            return undefined;
        }

        let cancelled = false;
        let widgetId;
        loadTurnstile().then((turnstile) => {
            if (cancelled || !containerRef.current || !turnstile) return;
            widgetId = turnstile.render(containerRef.current, {
                sitekey: siteKey,
                callback: (token) => onTokenRef.current(token),
                'expired-callback': () => onTokenRef.current(''),
                'error-callback': () => {
                    onTokenRef.current('');
                    setError('CAPTCHA verification failed. Please reload the check.');
                }
            });
        }).catch(() => {
            if (!cancelled) setError('Could not load CAPTCHA verification. Check your connection and try again.');
        });

        return () => {
            cancelled = true;
            if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        };
    }, [siteKey]);

    return (
        <div>
            {siteKey && <div ref={containerRef} className="eventora-turnstile-widget" />}
            {error && <p role="alert">{error}</p>}
        </div>
    );
};

export default TurnstileCaptcha;