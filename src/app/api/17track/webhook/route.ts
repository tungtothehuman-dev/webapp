import { NextResponse } from 'next/server';
import { db } from '@/firebase'; // Ensure firebase admin or client works here
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const rawPayload = await req.json();

        // Ensure we always work with an array of events
        const events = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
        let processedCount = 0;

        for (const event of events) {
            // 17Track webhook sends the info inside `data`. Sometimes `data` might be an array itself.
            const pushData = event.data || event;
            const dataObjects = Array.isArray(pushData) ? pushData : [pushData];
            
            for (const eventData of dataObjects) {
                if (!eventData || !eventData.number) continue;

                const trackingNumber = eventData.number.toString();
                const trackInfo = eventData.track_info;
                
                if (!trackInfo) continue;

                const statusString = trackInfo.latest_status?.status || ''; 
                const latestEventDesc = trackInfo.latest_event?.description || '';
                const latestEventLocation = trackInfo.latest_event?.location || '';
                const fullLatestEvent = `${latestEventLocation} - ${latestEventDesc}`.trim();

                // Map status
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
                    allEventsString.includes('customs duty payable') ||
                    allEventsString.includes('phí nhập khẩu') ||
                    allEventsString.includes('phải nộp thuế') ||
                    allEventsString.includes('chịu thuế') || 
                    allEventsString.includes('must pay the duties or taxes') ||
                    allEventsString.includes('thanh toán các khoản phí và thuế') ||
                    allEventsString.includes('thuế đối với gói hàng')) {
                    taxStatus = 'Cần Đóng Thuế ⚠️';
                }

                if (allEventsString.includes('import c.o.d. (icod) charges have been paid') || 
                    allEventsString.includes('payment for customs') ||
                    allEventsString.includes('đã được thanh toán') ||
                    allEventsString.includes('đã thanh toán thuế') ||
                    allEventsString.includes('đã nộp thuế') ||
                    allEventsString.includes('duties and taxes have been paid') ||
                    allEventsString.includes('duty and tax have been paid') ||
                    allEventsString.includes('taxes have been paid') ||
                    allEventsString.includes('charges have been paid') ||
                    allEventsString.includes('receiver paid the import charges') ||
                    allEventsString.includes('paid the import charges') ||
                    allEventsString.includes('cleared customs') ||
                    allEventsString.includes('customs cleared') ||
                    allEventsString.includes('thông quan') ||
                    allEventsString.includes('released by the clearing agency') ||
                    allEventsString.includes('released by the customs agency')) {
                    taxStatus = 'Đã Thanh Toán Thuế';
                }

                console.log(`[Webhook 17Track] Track: ${trackingNumber} | Status: ${mappedStatus} | Tax: ${taxStatus}`);

                // Update Firebase - checking both original and uppercase/lowercase versions to prevent case-sensitive mismatches
                const queries = [
                    query(collection(db, 'packages'), where('masterTracking', '==', trackingNumber)),
                    query(collection(db, 'packages'), where('masterTracking', '==', trackingNumber.toUpperCase())),
                    query(collection(db, 'packages'), where('masterTracking', '==', trackingNumber.toLowerCase()))
                ];

                let querySnapshot = await getDocs(queries[0]);
                if (querySnapshot.empty) querySnapshot = await getDocs(queries[1]);
                if (querySnapshot.empty) querySnapshot = await getDocs(queries[2]);

                if (querySnapshot.empty) {
                    console.log(`[Webhook 17Track] No package found with tracking: ${trackingNumber}`);
                    continue;
                }

                const updates: any = {};
                if (mappedStatus) updates.status = mappedStatus;
                if (taxStatus) updates.taxStatus = taxStatus;
                if (fullLatestEvent && fullLatestEvent !== '-') updates.lastTrackingEvent = fullLatestEvent;

                // Perform the update
                const promises = querySnapshot.docs.map(docSnap => updateDoc(docSnap.ref, updates));
                await Promise.all(promises);
                processedCount += querySnapshot.size;
            }
        }

        return NextResponse.json({ success: true, updated: processedCount });

    } catch (error: any) {
        console.error("[Webhook 17Track Error]", error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 200 }); // Return 200 to acknowledge receipt and prevent 17Track from locking up
    }
}
