const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const OTP = require('../models/OTP');
const { sendBookingEmail, sendBookingCancellationEmail, sendOTPEmail } = require('../utils/email');
const {
    createRazorpayOrder,
    verifyRazorpaySignature,
    releasePaymentHold,
    expirePaymentHolds
} = require('../utils/paymentGateway');
const generateTicketPdf = require('../utils/ticketPdf');
const verifyTurnstileToken = require('../utils/turnstile');
const {
    normalizeSlotDate,
    slotDateKey,
    bookingSlotDateFilter,
    getEventSlot,
    reserveEventSlotSeats,
    restoreEventSlotSeats
} = require('../utils/eventSlots');
const { ensureSeatTypes } = require('../utils/seatTypes');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const paymentHoldDurationMs = 15 * 60 * 1000;

const getSeatTypePrice = (event, seatTypeName) => {
    if (Array.isArray(event.seatTypes) && event.seatTypes.length) {
        const matchedSeatType = event.seatTypes.find((seatType) => seatType.name === seatTypeName);
        if (matchedSeatType) {
            return Number(matchedSeatType.price) || 0;
        }
    }
    return Number(event.ticketPrice) || 0;
};

const getSeatTypeRange = (event, seatTypeName) => {
    if (!Array.isArray(event.seatTypes) || !event.seatTypes.length || !seatTypeName) return null;
    let start = 1;
    for (const seatType of event.seatTypes) {
        const totalSeats = Number(seatType.totalSeats) || 0;
        if (seatType.name === seatTypeName) {
            return { start, end: start + totalSeats - 1 };
        }
        start += totalSeats;
    }
    return null;
};

const buildUpiPaymentLink = (bookingId, amount, upiId = process.env.UPI_ID || 'eventora@upi') => {
    const cleanAmount = Number(amount || 0).toFixed(2);
    const note = `Eventora Booking ${bookingId}`;
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Eventora')}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(note)}`;
};

const sendBookingConfirmationEmail = async (bookingId) => {
    try {
        const booking = await Booking.findById(bookingId)
            .populate('userId', 'name email')
            .populate('eventId');
        if (!booking || booking.status !== 'confirmed') return false;
        if (booking.confirmationEmailSentAt) return true;

        await sendBookingEmail(booking);
        booking.confirmationEmailSentAt = new Date();
        await booking.save();
        return true;
    } catch (error) {
        console.error('Booking confirmed, but ticket email could not be sent:', error.message);
        return false;
    }
};

const sendBookingCancellationNotice = async (bookingId, cancelledSeats = []) => {
    try {
        const booking = await Booking.findById(bookingId)
            .populate('userId', 'name email')
            .populate('eventId');
        if (!booking || (!cancelledSeats.length && booking.status !== 'cancelled')) return false;

        await sendBookingCancellationEmail(booking, { cancelledSeats });
        return true;
    } catch (error) {
        console.error('Booking cancelled, but cancellation email could not be sent:', error.message);
        return false;
    }
};

const validateBookingDetails = (body, event, slot, seatTypeName) => {
    const requestedSeats = Array.isArray(body.selectedSeats) ? body.selectedSeats : [body.selectedSeat];
    const seatNumbers = requestedSeats.map(Number);
    const requestedSeatTypes = Array.isArray(body.seatTypeDetails) ? body.seatTypeDetails : [];
    const seatTypeDetails = seatNumbers.map((seat) => {
        const requestedType = requestedSeatTypes.find((detail) => Number(detail.seat) === seat)?.type || seatTypeName;
        const matchedType = event.seatTypes?.find((type) => type.name === requestedType);
        const range = getSeatTypeRange(event, requestedType);
        if (!matchedType || (range && (seat < range.start || seat > range.end))) return null;
        return { seat, type: matchedType.name, price: Number(matchedType.price) || 0 };
    });
    if (!seatNumbers.length || seatNumbers.some((seat) => !Number.isInteger(seat) || seat < 1 || seat > event.totalSeats) || seatTypeDetails.some((detail) => !detail) || new Set(seatNumbers).size !== seatNumbers.length) {
        return { error: 'Please select valid seats' };
    }
    if (seatNumbers.length > slot.availableSeats) {
        return { error: 'Not enough seats available for the selected date' };
    }
    if (!Array.isArray(body.attendees) || body.attendees.length !== seatNumbers.length) {
        return { error: 'Please enter a name and age for every selected seat' };
    }

    const attendeeDetails = [];
    for (let index = 0; index < body.attendees.length; index += 1) {
        const name = typeof body.attendees[index]?.name === 'string' ? body.attendees[index].name.trim() : '';
        const ageValue = body.attendees[index]?.age;
        const age = Number(ageValue);
        const gender = body.attendees[index]?.gender;
        if (!name || name.length > 100 || ageValue === null || ageValue === undefined || String(ageValue).trim() === '' || !Number.isInteger(age) || age < 0 || age > 120) {
            return { error: 'Enter a valid name and age (0 to 120) for every attendee' };
        }
        if (!['Male', 'Female'].includes(gender)) {
            return { error: 'Select Male or Female for every attendee' };
        }
        attendeeDetails.push({ seat: seatNumbers[index], name, age, gender });
    }

    return { seatNumbers, attendeeDetails, seatTypeDetails: seatTypeDetails.filter(Boolean) };
};

exports.sendBookingOTP = async (req, res) => {
    try {
        const otp = generateOTP();
        await OTP.findOneAndDelete({ email: req.user.email, action: 'event_booking' });
        await OTP.create({ email: req.user.email, otp, action: 'event_booking' });
        await sendOTPEmail(req.user.email, otp, 'event_booking');
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
};

exports.bookEvent = async (req, res) => {
    let reservedSlotDate = null;
    let reservedSeatCount = 0;
    try {
        if (!await verifyTurnstileToken(req.body.captchaToken)) {
            return res.status(400).json({ message: 'Please complete the CAPTCHA verification and try again.' });
        }
        await expirePaymentHolds();
        const { eventId, paymentMethod, seatType } = req.body;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        ensureSeatTypes(event);
        const slotDate = normalizeSlotDate(req.body.slotDate || event.date);
        const slot = getEventSlot(event, slotDate);
        if (!slot) return res.status(400).json({ message: 'Choose an available event date' });
        if (slot.availableSeats <= 0) return res.status(400).json({ message: 'No seats available for this date' });
        const { error, seatNumbers, attendeeDetails, seatTypeDetails } = validateBookingDetails(req.body, event, slot, seatType);
        if (error) return res.status(400).json({ message: error });
        const bookingAmount = seatTypeDetails.reduce((sum, detail) => sum + detail.price, 0);
        if (bookingAmount > 0 && paymentMethod !== 'cash') {
            return res.status(400).json({ message: 'Choose online payment or pay at venue' });
        }

        const dateFilter = bookingSlotDateFilter(event, slotDate);
        const existingBooking = await Booking.findOne({ userId: req.user.id, eventId, ...dateFilter });
        if (existingBooking?.status === 'confirmed') {
            return res.status(400).json({ message: 'Already booked' });
        }
        if (existingBooking?.status === 'pending') {
            if (existingBooking.paymentHoldUntil) {
                return res.status(409).json({ message: 'A payment is already in progress for this event' });
            }
            const seatTaken = await Booking.exists({
                eventId,
                $and: [
                    dateFilter,
                    { $or: [
                        { selectedSeat: { $in: seatNumbers } },
                        { selectedSeats: { $in: seatNumbers } }
                    ] }
                ],
                status: { $in: ['confirmed', 'pending'] },
                _id: { $ne: existingBooking._id }
            });
            if (seatTaken) return res.status(409).json({ message: 'That seat is already booked. Please choose another seat.' });
            const reservedEvent = await reserveEventSlotSeats(event, slot, seatNumbers.length);
            if (!reservedEvent) return res.status(409).json({ message: 'Not enough seats remain for this date' });
            reservedSlotDate = slotDate;
            reservedSeatCount = seatNumbers.length;
            existingBooking.selectedSeat = seatNumbers[0];
            existingBooking.selectedSeats = seatNumbers;
            existingBooking.attendees = attendeeDetails;
            existingBooking.seatTypeDetails = seatTypeDetails;
            existingBooking.slotDate = slotDate;
            existingBooking.status = 'confirmed';
            await existingBooking.save();
            reservedSeatCount = 0;
            const emailSent = await sendBookingConfirmationEmail(existingBooking._id);
            return res.status(200).json({ message: 'Booking confirmed successfully', booking: existingBooking, emailSent });
        }

        const seatTaken = await Booking.exists({
            eventId,
            $and: [
                dateFilter,
                { $or: [
                    { selectedSeat: { $in: seatNumbers } },
                    { selectedSeats: { $in: seatNumbers } }
                ] }
            ],
            status: { $in: ['confirmed', 'pending'] }
        });
        if (seatTaken) return res.status(409).json({ message: 'That seat is already booked. Please choose another seat.' });
        const reservedEvent = await reserveEventSlotSeats(event, slot, seatNumbers.length);
        if (!reservedEvent) return res.status(409).json({ message: 'Not enough seats remain for this date' });
        reservedSlotDate = slotDate;
        reservedSeatCount = seatNumbers.length;

        const booking = await Booking.create({
            userId: req.user.id,
            eventId,
            slotDate,
            selectedSeat: seatNumbers[0],
            selectedSeats: seatNumbers,
            attendees: attendeeDetails,
            status: 'confirmed',
            paymentStatus: 'not_paid',
            paymentMethod: bookingAmount > 0 ? 'cash' : 'free',
            seatType: new Set(seatTypeDetails.map((detail) => detail.type)).size === 1 ? seatTypeDetails[0]?.type || '' : 'Mixed',
            seatTypeDetails,
            amount: bookingAmount
        });

        reservedSeatCount = 0;
        const emailSent = await sendBookingConfirmationEmail(booking._id);
        res.status(201).json({ message: 'Booking confirmed successfully', booking, emailSent });
    } catch (error) {
        if (reservedSeatCount > 0 && reservedSlotDate) {
            await restoreEventSlotSeats(req.body.eventId, reservedSlotDate, reservedSeatCount).catch(() => {});
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.createPaymentOrder = async (req, res) => {
    let booking;
    let reservedSeatCount = 0;
    let reservedSlotDate = null;
    try {
        if (!await verifyTurnstileToken(req.body.captchaToken)) {
            return res.status(400).json({ message: 'Please complete the CAPTCHA verification and try again.' });
        }
        await expirePaymentHolds();
        const { eventId, seatType } = req.body;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        ensureSeatTypes(event);
        const slotDate = normalizeSlotDate(req.body.slotDate || event.date);
        const slot = getEventSlot(event, slotDate);
        if (!slot) return res.status(400).json({ message: 'Choose an available event date' });

        const { error, seatNumbers, attendeeDetails, seatTypeDetails } = validateBookingDetails(req.body, event, slot, seatType);
        if (error) return res.status(400).json({ message: error });
        const bookingAmount = seatTypeDetails.reduce((sum, detail) => sum + detail.price, 0);
        if (bookingAmount <= 0) return res.status(400).json({ message: 'This event does not require online payment' });

        const dateFilter = bookingSlotDateFilter(event, slotDate);
        const existingBooking = await Booking.findOne({
            userId: req.user.id,
            eventId,
            ...dateFilter,
            status: { $in: ['confirmed', 'pending'] }
        });
        if (existingBooking) {
            return res.status(409).json({ message: existingBooking.status === 'confirmed' ? 'Already booked' : 'A booking is already awaiting confirmation' });
        }

        const seatTaken = await Booking.exists({
            eventId,
            $and: [
                dateFilter,
                { $or: [
                    { selectedSeat: { $in: seatNumbers } },
                    { selectedSeats: { $in: seatNumbers } }
                ] }
            ],
            status: { $in: ['confirmed', 'pending'] }
        });
        if (seatTaken) return res.status(409).json({ message: 'That seat is already booked. Please choose another seat.' });

        const reservedEvent = await reserveEventSlotSeats(event, slot, seatNumbers.length);
        if (!reservedEvent) return res.status(409).json({ message: 'Not enough seats available for this booking' });
        reservedSeatCount = seatNumbers.length;
        reservedSlotDate = slotDate;

        booking = await Booking.create({
            userId: req.user.id,
            eventId,
            slotDate,
            selectedSeat: seatNumbers[0],
            selectedSeats: seatNumbers,
            attendees: attendeeDetails,
            status: 'pending',
            paymentStatus: 'not_paid',
            paymentMethod: 'razorpay',
            seatType: new Set(seatTypeDetails.map((detail) => detail.type)).size === 1 ? seatTypeDetails[0]?.type || '' : 'Mixed',
            seatTypeDetails,
            amount: bookingAmount,
            paymentHoldUntil: new Date(Date.now() + paymentHoldDurationMs)
        });

        const orderAmount = Math.round(booking.amount * 100);
        if (!Number.isSafeInteger(orderAmount) || orderAmount < 100) {
            await releasePaymentHold(booking._id);
            reservedSeatCount = 0;
            return res.status(400).json({ message: 'Ticket price must be at least ₹1 for online payment' });
        }

        const order = await createRazorpayOrder(orderAmount, `booking-${booking._id}`);
        booking.razorpayOrderId = order.id;
        await booking.save();

        res.status(201).json({
            keyId: process.env.RAZORPAY_KEY_ID,
            bookingId: booking._id,
            order: { id: order.id, amount: order.amount, currency: order.currency }
        });
    } catch (error) {
        if (booking) {
            await releasePaymentHold(booking._id).catch(() => {});
        } else if (reservedSeatCount > 0 && reservedSlotDate) {
            await restoreEventSlotSeats(req.body.eventId, reservedSlotDate, reservedSeatCount).catch(() => {});
        }
        res.status(502).json({ message: error.message || 'Could not start online payment' });
    }
};

exports.createUpiQrPayment = async (req, res) => {
    let booking;
    let reservedSeatCount = 0;
    let reservedSlotDate = null;
    try {
        if (!await verifyTurnstileToken(req.body.captchaToken)) {
            return res.status(400).json({ message: 'Please complete the CAPTCHA verification and try again.' });
        }
        await expirePaymentHolds();
        const { eventId, seatType } = req.body;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        ensureSeatTypes(event);

        const slotDate = normalizeSlotDate(req.body.slotDate || event.date);
        const slot = getEventSlot(event, slotDate);
        if (!slot) return res.status(400).json({ message: 'Choose an available event date' });

        const { error, seatNumbers, attendeeDetails, seatTypeDetails } = validateBookingDetails(req.body, event, slot, seatType);
        if (error) return res.status(400).json({ message: error });
        const bookingAmount = seatTypeDetails.reduce((sum, detail) => sum + detail.price, 0);
        if (bookingAmount <= 0) return res.status(400).json({ message: 'This event is free and does not require a QR payment' });

        const dateFilter = bookingSlotDateFilter(event, slotDate);
        const existingBooking = await Booking.findOne({
            userId: req.user.id,
            eventId,
            ...dateFilter,
            status: { $in: ['confirmed', 'pending'] }
        });
        if (existingBooking) {
            return res.status(409).json({ message: existingBooking.status === 'confirmed' ? 'Already booked' : 'A booking is already awaiting confirmation' });
        }

        const seatTaken = await Booking.exists({
            eventId,
            $and: [
                dateFilter,
                { $or: [
                    { selectedSeat: { $in: seatNumbers } },
                    { selectedSeats: { $in: seatNumbers } }
                ] }
            ],
            status: { $in: ['confirmed', 'pending'] }
        });
        if (seatTaken) return res.status(409).json({ message: 'That seat is already booked. Please choose another seat.' });

        const reservedEvent = await reserveEventSlotSeats(event, slot, seatNumbers.length);
        if (!reservedEvent) return res.status(409).json({ message: 'Not enough seats available for this booking' });
        reservedSlotDate = slotDate;
        reservedSeatCount = seatNumbers.length;

        booking = await Booking.create({
            userId: req.user.id,
            eventId,
            slotDate,
            selectedSeat: seatNumbers[0],
            selectedSeats: seatNumbers,
            attendees: attendeeDetails,
            status: 'pending',
            paymentStatus: 'not_paid',
            paymentMethod: 'upi_qr',
            seatType: new Set(seatTypeDetails.map((detail) => detail.type)).size === 1 ? seatTypeDetails[0]?.type || '' : 'Mixed',
            seatTypeDetails,
            paymentReference: 'UPI_QR_PENDING',
            amount: bookingAmount,
            paymentHoldUntil: new Date(Date.now() + paymentHoldDurationMs)
        });

        const upiId = process.env.UPI_ID || 'eventora@upi';
        const qrLink = buildUpiPaymentLink(booking._id, booking.amount, upiId);
        booking.upiQrCode = await QRCode.toDataURL(qrLink);
        booking.paymentReference = upiId;
        await booking.save();

        reservedSeatCount = 0;
        res.status(201).json({
            bookingId: booking._id,
            qrCode: booking.upiQrCode,
            amount: booking.amount,
            upiId,
            message: 'Scan the QR and confirm after payment'
        });
    } catch (error) {
        if (booking) {
            await releasePaymentHold(booking._id).catch(() => {});
        } else if (reservedSeatCount > 0 && reservedSlotDate) {
            await restoreEventSlotSeats(req.body.eventId, reservedSlotDate, reservedSeatCount).catch(() => {});
        }
        res.status(502).json({ message: error.message || 'Could not generate QR payment' });
    }
};

exports.verifyUpiPayment = async (req, res) => {
    try {
        const { bookingId, paymentReference } = req.body;
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id });
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
            const emailSent = await sendBookingConfirmationEmail(booking._id);
            return res.json({ message: 'UPI payment already verified', booking, emailSent });
        }
        if (booking.status !== 'pending' || booking.paymentHoldUntil <= new Date()) {
            await releasePaymentHold(booking._id).catch(() => {});
            return res.status(410).json({ message: 'Payment QR session expired. Please book again.' });
        }

        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.paymentMethod = 'upi_qr';
        booking.paymentReference = paymentReference || booking.paymentReference || 'UPI_QR';
        booking.paymentHoldUntil = null;
        await booking.save();

        const emailSent = await sendBookingConfirmationEmail(booking._id);
        res.json({ message: 'UPI payment verified and booking confirmed', booking, emailSent });
    } catch (error) {
        res.status(500).json({ message: 'Could not verify UPI payment', error: error.message });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id });
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
            const emailSent = await sendBookingConfirmationEmail(booking._id);
            return res.json({ message: 'Payment already verified', booking, emailSent });
        }
        if (booking.status !== 'pending' || booking.paymentHoldUntil <= new Date()) {
            await releasePaymentHold(booking._id);
            return res.status(410).json({ message: 'Payment session expired. Please book again.' });
        }
        if (booking.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({ message: 'Payment order does not match this booking' });
        }
        if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.paymentHoldUntil = null;
        await booking.save();
        const emailSent = await sendBookingConfirmationEmail(booking._id);
        res.json({ message: 'Payment verified and booking confirmed', booking, emailSent });
    } catch (error) {
        res.status(500).json({ message: 'Could not verify payment', error: error.message });
    }
};

exports.getBookedSeats = async (req, res) => {
    try {
        await expirePaymentHolds();
        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const slotDate = normalizeSlotDate(req.query.date || event.date);
        if (!getEventSlot(event, slotDate)) return res.status(400).json({ message: 'Choose an available event date' });
        const bookings = await Booking.find({
            eventId: req.params.eventId,
            status: { $in: ['confirmed', 'pending'] },
            $and: [bookingSlotDateFilter(event, slotDate)]
        }).select('selectedSeat selectedSeats -_id');
        res.json(bookings.flatMap((booking) => booking.selectedSeats?.length ? booking.selectedSeats : [booking.selectedSeat]));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.confirmBooking = async (req, res) => {
    try {
        const { paymentStatus } = req.body; // 'paid' or 'not_paid'
        const booking = await Booking.findById(req.params.id).populate('userId').populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.paymentMethod === 'razorpay') {
            return res.status(400).json({ message: 'Online bookings can only be confirmed after payment verification' });
        }

        if (booking.status === 'confirmed') {
            const emailSent = await sendBookingConfirmationEmail(booking._id);
            return res.status(400).json({ message: 'Booking is already confirmed', emailSent });
        }

        const event = await Event.findById(booking.eventId._id);
        const seatCount = booking.selectedSeats?.length || 1;
        const slotDate = normalizeSlotDate(booking.slotDate || event.date);
        const slot = getEventSlot(event, slotDate);
        if (!slot || slot.availableSeats < seatCount) return res.status(400).json({ message: 'No seats available to confirm this booking date' });

        const reservedEvent = await reserveEventSlotSeats(event, slot, seatCount);
        if (!reservedEvent) return res.status(400).json({ message: 'No seats available to confirm this booking date' });

        booking.status = 'confirmed';
        booking.slotDate = slotDate;
        if (paymentStatus) {
            booking.paymentStatus = paymentStatus;
        }
        try {
            await booking.save();
        } catch (error) {
            await restoreEventSlotSeats(event._id, slotDate, seatCount);
            throw error;
        }

        const emailSent = await sendBookingConfirmationEmail(booking._id);
        res.json({ message: 'Booking confirmed successfully', booking, emailSent });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        await expirePaymentHolds();
        const bookings = req.user.role === 'admin'
            ? await Booking.find().populate('eventId').populate('userId', 'name email').sort({ createdAt: -1 })
            : await Booking.find({ userId: req.user.id }).populate('eventId').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.downloadTicket = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            userId: req.user.id,
            status: 'confirmed'
        }).populate('eventId');
        if (!booking || !booking.eventId) return res.status(404).json({ message: 'Confirmed ticket not found' });

        const ticketPdf = await generateTicketPdf(booking);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Eventora-ticket-${booking._id}.pdf"`,
            'Content-Length': ticketPdf.length
        });
        res.send(ticketPdf);
    } catch (error) {
        res.status(500).json({ message: 'Could not generate ticket PDF', error: error.message });
    }
};

exports.cancelBookingSeats = async (req, res) => {
    try {
        const requestedSeats = Array.isArray(req.body.seatNumbers) ? req.body.seatNumbers.map(Number) : [];
        if (!requestedSeats.length || requestedSeats.some((seat) => !Number.isInteger(seat) || seat < 1) || new Set(requestedSeats).size !== requestedSeats.length) {
            return res.status(400).json({ message: 'Select one or more valid seats to cancel' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (booking.status !== 'confirmed') {
            return res.status(400).json({ message: 'Only confirmed bookings can have individual seats cancelled' });
        }

        const seats = booking.selectedSeats?.length ? booking.selectedSeats : [booking.selectedSeat].filter(Boolean);
        if (requestedSeats.some((seat) => !seats.includes(seat))) {
            return res.status(404).json({ message: 'One or more selected seats are not part of this booking' });
        }

        const event = await Event.findById(booking.eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const cancelledSeatSet = new Set(requestedSeats);
        const remainingSeats = seats.filter((seat) => !cancelledSeatSet.has(seat));
        const remainingAttendees = (booking.attendees || []).filter((attendee) => !cancelledSeatSet.has(attendee.seat));
        const remainingAmount = remainingSeats.length
            ? Math.round(event.ticketPrice * remainingSeats.length * 100) / 100
            : 0;
        const updatedBooking = await Booking.findOneAndUpdate(
            { _id: booking._id, status: 'confirmed', selectedSeats: booking.selectedSeats, selectedSeat: booking.selectedSeat },
            {
                $set: {
                    selectedSeats: remainingSeats,
                    selectedSeat: remainingSeats[0] || null,
                    attendees: remainingAttendees,
                    amount: remainingAmount,
                    status: remainingSeats.length ? 'confirmed' : 'cancelled'
                }
            },
            { new: true, runValidators: true }
        );
        if (!updatedBooking) {
            return res.status(409).json({ message: 'Booking changed. Refresh and try again.' });
        }

        await restoreEventSlotSeats(booking.eventId, booking.slotDate || event.date, requestedSeats.length);
        const emailSent = await sendBookingCancellationNotice(updatedBooking._id, requestedSeats);
        res.json({ message: `Seat${requestedSeats.length > 1 ? 's' : ''} ${requestedSeats.join(', ')} cancelled successfully`, emailSent, booking: updatedBooking });
    } catch (error) {
        res.status(500).json({ message: 'Could not cancel selected seats', error: error.message });
    }
};

exports.cancelBookingSeat = async (req, res) => {
    req.body = { ...req.body, seatNumbers: [req.params.seatNumber] };
    return exports.cancelBookingSeats(req, res);
};

exports.cancelBooking = async (req, res) => {
    try {
        await expirePaymentHolds();
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (booking.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });

        if (booking.status === 'pending' && booking.paymentHoldUntil) {
            const released = await releasePaymentHold(booking._id);
            if (!released) return res.status(409).json({ message: 'Payment hold has already expired' });
            const emailSent = await sendBookingCancellationNotice(booking._id);
            return res.json({ message: 'Booking cancelled successfully', emailSent });
        }

        const wasConfirmed = booking.status === 'confirmed';

        booking.status = 'cancelled';
        await booking.save();

        // Only restore the seat if it was actually confirmed and deducted
        if (wasConfirmed) {
            const event = await Event.findById(booking.eventId);
            if (event) {
                const seatCount = booking.selectedSeats?.length || 1;
                await restoreEventSlotSeats(event._id, booking.slotDate || event.date, seatCount);
            }
        }

        const emailSent = await sendBookingCancellationNotice(booking._id);
        res.json({ message: 'Booking cancelled successfully', emailSent });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
