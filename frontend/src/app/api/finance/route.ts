import { NextRequest, NextResponse } from 'next/server';

const GAS_API_URL = process.env.GAS_WEB_APP_URL;

if (!GAS_API_URL) {
    console.error('GAS_WEB_APP_URL is not defined in environment variables.');
}

/**
 * GET Handler
 * Proxies requests to GAS Web API.
 * Supports caching for 'records' and 'portfolio' types.
 */
export async function GET(request: NextRequest) {
    if (!GAS_API_URL) {
        return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'health';

    // Map frontend 'type' to GAS 'action'
    let action = 'health';
    if (type === 'invest') action = 'records'; // Or 'portfolio' depending on need, let's stick to records for raw data
    if (type === 'asset') action = 'portfolio'; // For dashboard summary
    if (type === 'bank') action = 'bank';

    const gasUrl = `${GAS_API_URL}?action=${action}`;

    try {
        // Cache configuration based on type
        // Bank balance should be fresh, Investment data can be cached
        const revalidate = (type === 'bank') ? 0 : 3600; // 1 hour cache for investments

        const res = await fetch(gasUrl, {
            next: { revalidate: revalidate }
        });

        if (!res.ok) {
            throw new Error(`GAS API responded with status ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Proxy Error (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch data from GAS', details: error.message }, { status: 502 });
    }
}

/**
 * POST Handler
 * Proxies balance adjustment requests to GAS Web API.
 */
export async function POST(request: NextRequest) {
    if (!GAS_API_URL) {
        return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // Security check: simple validation
        if (body.action !== 'adjust_balance' || typeof body.amount !== 'number') {
             return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const res = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            cache: 'no-store' // Never cache POST requests
        });

        if (!res.ok) {
             throw new Error(`GAS API responded with status ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Proxy Error (POST):', error);
        return NextResponse.json({ error: 'Failed to post data to GAS', details: error.message }, { status: 502 });
    }
}
