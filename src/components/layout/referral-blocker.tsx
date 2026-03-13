
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ReferralBlocker() {
    const router = useRouter();

    useEffect(() => {
        // Current blocked domain
        const blockedDomain = 'fantasyskate.com.ar';
        const referer = document.referrer;

        if (referer && referer.toLowerCase().includes(blockedDomain)) {
            console.log(`[ReferralBlocker] Blocking access from ${referer}`);
            router.push('/acceso-restringido');
        }
    }, [router]);

    return null;
}
