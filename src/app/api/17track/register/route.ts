import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { trackingNumber, packageId } = await req.json();

        if (!trackingNumber) {
            return NextResponse.json({ error: 'Missing tracking number' }, { status: 400 });
        }

        const apiKey = process.env.TRACK17_API_KEY;
        if (!apiKey) {
            console.error("Missing TRACK17_API_KEY in environment variables.");
            // Return 200 anyway so we don't crash the frontend, just log it.
            return NextResponse.json({ pendingConfig: true });
        }

        // 17Track Requires an array of objects
        const payload = [
            {
                number: trackingNumber
            }
        ];

        const response = await fetch('https://api.17track.net/track/v2.2/register', {
            method: 'POST',
            headers: {
                '17token': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.code === 0) {
            console.log(`[17Track] Successfully registered tracking: ${trackingNumber} for package: ${packageId}`);
            return NextResponse.json({ success: true, data: data.data });
        } else {
            console.error(`[17Track Error] Registration failed for ${trackingNumber}:`, data);
            return NextResponse.json({ error: data.message }, { status: 400 });
        }
    } catch (error: any) {
        console.error("[17Track Catch Error]", error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
