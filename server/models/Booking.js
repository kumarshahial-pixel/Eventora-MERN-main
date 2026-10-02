const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema({
    seat: { type: Number, min: 1, required: true },
    name: { type: String, trim: true, required: true },
    age: { type: Number, min: 0, max: 120, required: true },
    gender: { type: String, enum: ['Male', 'Female'] }
}, { _id: false });

const seatTypeDetailSchema = new mongoose.Schema({
    seat: { type: Number, min: 1, required: true },
    type: { type: String, required: true },
    price: { type: Number, min: 0, required: true }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    slotDate: { type: Date },
    selectedSeat: { type: Number, min: 1 },
    selectedSeats: { type: [Number], default: [] },
    attendees: { type: [attendeeSchema], default: [] },
    seatTypeDetails: { type: [seatTypeDetailSchema], default: [] },
    status: { type: String, enum: ['confirmed', 'cancelled', 'pending'], default: 'pending' },
    paymentStatus: { type: String, enum: ['paid', 'not_paid'], default: 'not_paid' },
    paymentMethod: { type: String, enum: ['razorpay', 'cash', 'free', 'upi_qr'] },
    seatType: { type: String, default: '' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paymentReference: { type: String },
    upiQrCode: { type: String },
    paymentHoldUntil: { type: Date },
    confirmationEmailSentAt: { type: Date },
    amount: { type: Number, required: true },
    bookedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
