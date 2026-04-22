import { NextResponse } from 'next/server';
import { db } from '@/firebase'; 
import { doc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const { trackingNumber, packageId } = await req.json();

        if (!trackingNumber || !packageId) {
            return NextResponse.json({ error: 'Missing tracking number or package id' }, { status: 400 });
        }

        const apiKey = process.env.TRACK17_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }

        const payload = [{ number: trackingNumber }];

        const response = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', {
            method: 'POST',
            headers: {
                '17token': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.accepted && data.data.accepted.length > 0) {
            const trackInfo = data.data.accepted[0].track_info;
            if (!trackInfo) {
                return NextResponse.json({ error: 'No track info available yet' }, { status: 400 });
            }

            const statusString = trackInfo.latest_status?.status || ''; 
            const latestEventDesc = trackInfo.latest_event?.description || '';
            const latestEventLocation = trackInfo.latest_event?.location || '';
            const fullLatestEvent = `${latestEventLocation} - ${latestEventDesc}`.trim();

            let mappedStatus = '';
            switch (statusString) {
                case 'NotFound': mappedStatus = 'Not Found'; break;
                case 'InTransit': mappedStatus = 'In Transit'; break;
                case 'Expired': mappedStatus = 'Expired'; break;
                case 'PickUp': mappedStatus = 'Pick Up'; break;
                case 'Undelivered': mappedStatus = 'Undelivered'; break;
                case 'Delivered': mappedStatus = 'Delivered'; break;
                case 'Alert': mappedStatus = 'Alert'; break;
            }

            // Tax checking logic
            let taxStatus = '';
            const allEventsString = JSON.stringify(trackInfo.tracking || {}).toLowerCase();
            if (allEventsString.includes('import charges are due') || 
                allEventsString.includes('duties or taxes are due') ||
                allEventsString.includes('duties and taxes are due') ||
                allEventsString.includes('customs duty payable')) {
                taxStatus = 'Cần Đóng Thuế ⚠️';
            }
            if (allEventsString.includes('import c.o.d. (icod) charges have been paid') || 
                allEventsString.includes('payment for customs') ||
                allEventsString.includes('cleared customs')) {
                taxStatus = 'Đã Thanh Toán Thuế';
            }

            const updates: any = {};
            if (mappedStatus) updates.status = mappedStatus;
            if (taxStatus) updates.taxStatus = taxStatus;
            if (fullLatestEvent && fullLatestEvent !== '-') updates.lastTrackingEvent = fullLatestEvent;

            // Optional: Also update it directly here just to ensure
            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'packages', packageId), updates);
                return NextResponse.json({ success: true, updates });
            } else {
                return NextResponse.json({ error: 'No status changes from 17Track' }, { status: 200 });
            }
        } else {
            return NextResponse.json({ error: 'Could not fetch tracking' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
