
"use client";

import { useEffect } from 'react';

export function ReferralBlocker() {
    useEffect(() => {
        const blockedDomain = 'fantasyskate.com.ar';
        const referer = document.referrer;

        // 1. Direct Referrer Check
        const isMainRefererBlocked = referer && referer.toLowerCase().includes(blockedDomain);

        // 2. IFrame Detection
        let isIframeRefererBlocked = false;
        try {
            if (window.self !== window.top) {
                // We are in an iframe
                const parentUrl = document.location.ancestorOrigins?.[0] || "";
                if (parentUrl.toLowerCase().includes(blockedDomain)) {
                    isIframeRefererBlocked = true;
                } else if (!referer) {
                    // Strict: block all iframes without referrer if we suspect nesting
                    isIframeRefererBlocked = true;
                }
            }
        } catch (e) {
            // Cross-origin error means we are in an iframe of a different domain
            isIframeRefererBlocked = true;
        }

        // 3. Opener Check (for new tabs)
        let isOpenerBlocked = false;
        try {
            if (window.opener && window.opener !== window) {
                // This is more complex because accessing opener.location might throw
                // but if it's from a different origin, it WILL throw.
                // We can't easily know if that origin is the blocked one without a referer.
            }
        } catch (e) {
            // Cross-origin opener
        }

        if (isMainRefererBlocked || isIframeRefererBlocked || isOpenerBlocked) {
            console.log(`[ReferralBlocker] ACCESS BLOCKED. Referer: ${referer || 'none'}, Iframe: ${window.self !== window.top}`);
            // Hard redirect to clear any state
            window.location.replace('/acceso-restringido');
        }
    }, []);

    return null;
}
