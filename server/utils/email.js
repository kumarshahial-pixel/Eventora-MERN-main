const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const generateTicketPdf = require('./ticketPdf');
const { getEventSlot } = require('./eventSlots');

dotenv.config();

const emailUser = (process.env.EMAIL_USER || '').trim();
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const emailFromName = (process.env.EMAIL_FROM_NAME || 'Eventora').trim();
const emailFrom = { name: emailFromName, address: emailUser };

if (!emailUser || !emailPass) {
    console.warn('EMAIL_USER or EMAIL_PASS is missing in server/.env. OTP emails will fail until credentials are configured.');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    }
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

const sendBookingEmail = async (booking) => {
    try {
        const { userId: user, eventId: event } = booking;
        if (!user?.email || !event) throw new Error('Booking email requires a user and event');

        const eventTitle = event.title || 'Event';
        const seats = booking.selectedSeats?.length ? booking.selectedSeats : [booking.selectedSeat].filter(Boolean);
        const slot = getEventSlot(event, booking.slotDate || event.date);
        const eventDate = booking.slotDate || slot?.date || event.date;
        const eventTime = slot?.startTime ? ` · ${slot.startTime}-${slot.endTime}` : '';
        const ticketPdf = await generateTicketPdf(booking);
        const mailOptions = {
            from: emailFrom,
            replyTo: emailUser,
            to: user.email,
            subject: `Booking Confirmed: ${eventTitle}`,
            html: `
                <h2>Hi ${escapeHtml(user.name)}!</h2>
                <p>Your booking for <strong>${escapeHtml(eventTitle)}</strong> is confirmed.</p>
                <p><strong>Event date and time:</strong> ${escapeHtml(eventDate ? `${new Date(eventDate).toLocaleDateString('en-US')}${eventTime}` : 'Not specified')}</p>
                <p><strong>Location:</strong> ${escapeHtml(event.location || 'Not specified')}</p>
                <p><strong>Seats:</strong> ${escapeHtml(seats.join(', '))}</p>
                <p><strong>Booking reference:</strong> ${escapeHtml(booking._id)}</p>
                <p>Your ticket PDF is attached. Please present it at the event entrance.</p>
                <p>Thank you for choosing Eventora.</p>
                <hr>
                <p style="color:#71817e;font-size:12px;">Eventora · Event booking platform</p>
            `,
            attachments: [{
                filename: `Eventora-ticket-${booking._id}.pdf`,
                content: ticketPdf,
                contentType: 'application/pdf'
            }]
        };
        await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email with ticket sent to', user.email);
    } catch (error) {
        console.error('Error sending booking confirmation email:', error);
        throw error;
    }
};

const sendBookingCancellationEmail = async (booking, { cancelledSeats = [] } = {}) => {
    try {
        const user = booking.userId;
        const event = booking.eventId || {};
        if (!user?.email) throw new Error('Booking cancellation email requires a user email');

        const eventTitle = event.title || 'Event';
        const seats = booking.selectedSeats?.length ? booking.selectedSeats : [booking.selectedSeat].filter(Boolean);
        const slot = getEventSlot(event, booking.slotDate || event.date);
        const eventDate = booking.slotDate || slot?.date || event.date;
        const eventTime = slot?.startTime ? ` · ${slot.startTime}-${slot.endTime}` : '';
        const isPartialCancellation = cancelledSeats.length > 0 && booking.status !== 'cancelled';
        const cancelledSeatList = cancelledSeats.join(', ');
        const mailOptions = {
            from: emailFrom,
            replyTo: emailUser,
            to: user.email,
            subject: isPartialCancellation ? `Tickets Cancelled: ${eventTitle}` : `Booking Cancelled: ${eventTitle}`,
            html: `
                <h2>Hi ${escapeHtml(user.name || 'there')},</h2>
                <p>${isPartialCancellation ? `Seats ${escapeHtml(cancelledSeatList)} in your booking for <strong>${escapeHtml(eventTitle)}</strong> have been cancelled. Your other seats remain booked.` : `Your booking for <strong>${escapeHtml(eventTitle)}</strong> has been cancelled.`}</p>
                <p><strong>Event date and time:</strong> ${escapeHtml(eventDate ? `${new Date(eventDate).toLocaleDateString('en-US')}${eventTime}` : 'Not specified')}</p>
                <p><strong>Location:</strong> ${escapeHtml(event.location || 'Not specified')}</p>
                <p><strong>${isPartialCancellation ? 'Cancelled seats' : 'Seats'}:</strong> ${escapeHtml(isPartialCancellation ? cancelledSeatList : seats.join(', ') || 'Not assigned')}</p>
                <p><strong>Booking reference:</strong> ${escapeHtml(booking._id)}</p>
                ${booking.paymentStatus === 'paid' ? '<p>If you have already paid, your refund should be credited within 24-48 hours. If it has not arrived within that time, please contact Eventora Support.</p>' : ''}
                <p>Thank you,</p>
                <p>Eventora Support</p>
                <hr>
                <p style="color:#71817e;font-size:12px;">Eventora · Event booking platform</p>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('Booking cancellation email sent to', user.email);
    } catch (error) {
        console.error('Error sending booking cancellation email:', error);
        throw error;
    }
};

const sendOTPEmail = async (userEmail, otp, type) => {
    try {
        if (!emailUser || !emailPass) {
            throw new Error('Gmail credentials are missing. Add EMAIL_USER and EMAIL_PASS to server/.env');
        }

        const title = type === 'account_verification'
            ? 'Verify your Eventora Account'
            : type === 'password_reset'
                ? 'Reset your Eventora Password'
                : 'Eventora Booking Verification';
        const msg = type === 'account_verification'
            ? 'Please use the following OTP to verify your new Eventora account.'
            : type === 'password_reset'
                ? 'Use the following OTP to reset your Eventora password.'
                : 'Please use the following OTP to verify and confirm your event booking.';

        const mailOptions = {
            from: emailFrom,
            replyTo: emailUser,
            to: userEmail,
            subject: title,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #111;">${title}</h2>
                    <p style="color: #555; font-size: 16px;">${msg}</p>
                    <div style="margin: 20px auto; padding: 15px; font-size: 24px; font-weight: bold; background: #f4f4f4; width: max-content; letter-spacing: 5px;">
                        ${otp}
                    </div>
                    <p style="color: #999; font-size: 12px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${userEmail} for ${type}`, info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
};

module.exports = { sendBookingEmail, sendBookingCancellationEmail, sendOTPEmail };
