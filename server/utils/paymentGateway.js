const crypto = require('crypto');
const https = require('https');
const Booking = require('../models/Booking');
const { restoreEventSlotSeats } = require('./eventSlots');

const getCredentials = () => ({
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET
});

const razorpayRequest = (path, method, payload) => new Promise((resolve, reject) => {
    const { keyId, keySecret } = getCredentials();
    if (!keyId || !keySecret) {
        reject(new Error('Online payments are not configured.'));
        return;
    }

    const request = https.request({
        hostname: 'api.razorpay.com',
        path,
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
        }
    }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { responseBody += chunk; });
        response.on('end', () => {
            let data;
            try {
                data = JSON.parse(responseBody);
            } catch {
                reject(new Error('Invalid response from payment provider.'));
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(data.error?.description || 'Payment provider request failed.'));
                return;
            }
            resolve(data);
        });
    });

    request.setTimeout(15000, () => request.destroy(new Error('Payment provider request timed out.')));
    request.on('error', reject);
    request.end(JSON.stringify(payload));
});

const createRazorpayOrder = (amount, receipt) => razorpayRequest('/v1/orders', 'POST', {
    amount,
    currency: 'INR',
    receipt
});

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    const { keySecret } = getCredentials();
    if (!keySecret || !orderId || !paymentId || !signature) return false;

    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
    let received;
    try {
        received = Buffer.from(signature, 'hex');
    } catch {
        return false;
    }
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

const releasePaymentHold = async (bookingId, expiredBefore) => {
    const paymentHoldUntil = { $type: 'date' };
    if (expiredBefore) paymentHoldUntil.$lte = expiredBefore;

    const booking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: 'pending', paymentHoldUntil },
        { $set: { status: 'cancelled', paymentHoldUntil: null } },
        { new: true }
    );
    if (!booking) return false;

    const seatCount = booking.selectedSeats?.length || (booking.selectedSeat ? 1 : 0);
    if (seatCount > 0) await restoreEventSlotSeats(booking.eventId, booking.slotDate, seatCount);
    return true;
};

const expirePaymentHolds = async () => {
    const now = new Date();
    const expiredBookings = await Booking.find({
        status: 'pending',
        paymentHoldUntil: { $type: 'date', $lte: now }
    }).select('_id');

    await Promise.all(expiredBookings.map((booking) => releasePaymentHold(booking._id, now)));
};

module.exports = {
    createRazorpayOrder,
    verifyRazorpaySignature,
    releasePaymentHold,
    expirePaymentHolds
};
