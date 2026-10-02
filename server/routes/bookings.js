const express = require('express');
const router = express.Router();
const {
    bookEvent,
    createPaymentOrder,
    createUpiQrPayment,
    verifyPayment,
    verifyUpiPayment,
    confirmBooking,
    getMyBookings,
    downloadTicket,
    cancelBooking,
    cancelBookingSeat,
    cancelBookingSeats,
    getBookedSeats
} = require('../controllers/bookingController');
const { protect, admin } = require('../middleware/auth');

router.post('/', protect, bookEvent);
router.post('/payment-order', protect, createPaymentOrder);
router.post('/upi-qr', protect, createUpiQrPayment);
router.post('/verify-payment', protect, verifyPayment);
router.post('/verify-upi-payment', protect, verifyUpiPayment);
router.get('/event/:eventId/seats', protect, getBookedSeats);
router.get('/:id/ticket', protect, downloadTicket);
router.post('/:id/cancel-seats', protect, cancelBookingSeats);
router.delete('/:id/seats/:seatNumber', protect, cancelBookingSeat);
router.put('/:id/confirm', protect, admin, confirmBooking);
router.get('/my', protect, getMyBookings);
router.delete('/:id', protect, cancelBooking);

module.exports = router;
