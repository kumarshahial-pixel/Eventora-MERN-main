const PDFDocument = require('pdfkit');
const https = require('https');
const { getEventSlot } = require('./eventSlots');

const pdfText = (value) => String(value ?? '').replace(/[^\x20-\x7E]/g, '?');

const loadEventImage = async (imageUrl) => {
    if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null;

    try {
        const url = new URL(imageUrl);
        if (url.protocol !== 'https:') return null;

        return await new Promise((resolve, reject) => {
            const request = https.get(url, { headers: { Accept: 'image/jpeg, image/png' } }, (response) => {
                const contentType = response.headers['content-type']?.split(';')[0].trim();
                const contentLength = Number(response.headers['content-length'] || 0);
                if (response.statusCode !== 200 || !['image/jpeg', 'image/jpg', 'image/png'].includes(contentType) || contentLength > 5 * 1024 * 1024) {
                    response.resume();
                    resolve(null);
                    return;
                }

                const chunks = [];
                let totalBytes = 0;
                response.on('data', (chunk) => {
                    totalBytes += chunk.length;
                    if (totalBytes > 5 * 1024 * 1024) {
                        request.destroy(new Error('Event image is too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
            });

            request.setTimeout(5000, () => request.destroy(new Error('Event image request timed out')));
            request.on('error', reject);
        });
    } catch {
        return null;
    }
};

const getSeatCategory = (booking, seat) => {
    const savedDetail = booking.seatTypeDetails?.find((detail) => Number(detail.seat) === Number(seat));
    if (savedDetail?.type) return savedDetail.type;
    if (booking.seatType && booking.seatType !== 'Mixed') return booking.seatType;

    let start = 1;
    for (const seatType of booking.eventId?.seatTypes || []) {
        const end = start + Number(seatType.totalSeats || 0) - 1;
        if (Number(seat) >= start && Number(seat) <= end) return seatType.name;
        start = end + 1;
    }
    return 'Regular';
};

const generateTicketPdf = async (booking) => {
    const event = booking.eventId || {};
    const eventImage = await loadEventImage(event.image);

    return new Promise((resolve, reject) => {
        const document = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks = [];

        document.on('data', (chunk) => chunks.push(chunk));
        document.on('end', () => resolve(Buffer.concat(chunks)));
        document.on('error', reject);

        const seats = booking.selectedSeats?.length ? booking.selectedSeats : [booking.selectedSeat].filter(Boolean);
        const attendees = booking.attendees || [];
        const slot = getEventSlot(event, booking.slotDate || event.date);
        const selectedDate = booking.slotDate || slot?.date || event.date;
        const eventDate = selectedDate ? `${new Date(selectedDate).toLocaleDateString('en-US')}${slot?.startTime ? ` · ${slot.startTime}-${slot.endTime}` : ''}` : 'Date unavailable';
        const paymentMethod = booking.paymentMethod === 'razorpay'
            ? 'Online payment'
            : booking.paymentMethod === 'cash' ? 'Pay at venue' : 'Free';
        const seatType = booking.seatType || 'Regular';
        const pageWidth = 595.28;
        const cardLeft = 38;
        const cardWidth = pageWidth - cardLeft * 2;
        const ticketCode = pdfText(booking._id).slice(-10).toUpperCase();

        document.rect(0, 0, pageWidth, 842).fill('#eef4f2');
        document.roundedRect(22, 20, pageWidth - 44, 802, 14).fill('#ffffff');

        document.save();
        document.roundedRect(22, 20, pageWidth - 44, 184, 14).clip();
        document.rect(22, 20, pageWidth - 44, 184).fill('#123f3a');
        document.rect(22, 20, 7, 184).fill('#ef8a67');
        document.restore();

        document.fillColor('#a9d9cc').font('Helvetica-Bold').fontSize(10)
            .text('EVENTORA  /  OFFICIAL E-TICKET', 46, 42, { characterSpacing: 1.1 });
        document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24)
            .text(pdfText(event.title || 'Event ticket'), 46, 72, {
                width: eventImage ? 285 : 485,
                height: 60,
                ellipsis: true,
                lineGap: 2
            });
        document.fillColor('#d2e7e1').font('Helvetica').fontSize(10)
            .text('Show this ticket at the event entrance', 46, 148, { width: 280 });
        document.roundedRect(46, 169, 104, 22, 11).fill('#e5f4ef');
        document.fillColor('#176c5d').font('Helvetica-Bold').fontSize(8)
            .text('BOOKING CONFIRMED', 46, 176, { width: 104, align: 'center' });

        if (eventImage) {
            try {
                document.save();
                document.roundedRect(371, 43, 166, 112, 8).clip();
                document.image(eventImage, 371, 43, { fit: [166, 112], align: 'center', valign: 'center' });
                document.restore();
            } catch {
                document.restore();
            }
        }

        const drawInfoCard = (x, y, width, label, value, valueOptions = {}) => {
            document.roundedRect(x, y, width, 70, 8).fillAndStroke('#f5f8f7', '#e1eae6');
            document.fillColor('#71817e').font('Helvetica-Bold').fontSize(8)
                .text(label.toUpperCase(), x + 13, y + 12, { characterSpacing: 0.6 });
            document.fillColor('#183331').font('Helvetica-Bold').fontSize(10)
                .text(pdfText(value), x + 13, y + 32, {
                    width: width - 26,
                    height: 27,
                    ellipsis: true,
                    ...valueOptions
                });
        };

        const gap = 12;
        const halfWidth = (cardWidth - gap) / 2;
        drawInfoCard(cardLeft, 222, halfWidth, 'Event date and time', eventDate);
        drawInfoCard(cardLeft + halfWidth + gap, 222, halfWidth, 'Venue', event.location || 'Not specified');
        drawInfoCard(cardLeft, 304, halfWidth, 'Booking reference', ticketCode);
        drawInfoCard(cardLeft + halfWidth + gap, 304, halfWidth, 'Payment', `${paymentMethod}  /  ${booking.paymentStatus === 'paid' ? 'PAID' : booking.amount === 0 ? 'FREE' : 'UNPAID'}`);

        document.fillColor('#183331').font('Helvetica-Bold').fontSize(13)
            .text('YOUR TICKETS', cardLeft, 405);
        document.roundedRect(cardLeft + 170, 402, 118, 22, 11).fill('#f6df96');
        document.fillColor('#765512').font('Helvetica-Bold').fontSize(7)
            .text(`SEAT TYPE  ${pdfText(seatType).toUpperCase()}`, cardLeft + 170, 410, { width: 118, align: 'center' });
        document.fillColor('#71817e').font('Helvetica').fontSize(8)
            .text(`${attendees.length || seats.length} ${attendees.length === 1 ? 'GUEST' : 'GUESTS'}`, cardLeft + cardWidth - 110, 408, { width: 110, align: 'right' });
        document.moveTo(cardLeft, 428).lineTo(cardLeft + cardWidth, 428).lineWidth(1).strokeColor('#dce7e3').stroke();

        let rowY = 441;
        const ticketHolders = attendees.length ? attendees : seats.map((seat) => ({ seat, name: 'Guest', age: '' }));
        ticketHolders.forEach((attendee, index) => {
            const seatDetail = booking.seatTypeDetails?.find((detail) => Number(detail.seat) === Number(attendee.seat));
            const attendeeSeatType = getSeatCategory(booking, attendee.seat) || seatType;
            const attendeeSeatPrice = seatDetail?.price ?? (booking.amount && seats.length ? booking.amount / seats.length : 0);
            document.roundedRect(cardLeft, rowY, cardWidth, 43, 7)
                .fillAndStroke(index % 2 === 0 ? '#f7faf9' : '#ffffff', '#e2ebe7');
            document.circle(cardLeft + 22, rowY + 21.5, 11).fill('#e3f2ed');
            document.fillColor('#176c5d').font('Helvetica-Bold').fontSize(8)
                .text(String(attendee.seat ?? index + 1), cardLeft + 11, rowY + 18, { width: 22, align: 'center' });
            document.fillColor('#71817e').font('Helvetica-Bold').fontSize(7)
                .text(`SEAT ${attendee.seat ?? index + 1}  ·  ${pdfText(attendeeSeatType).toUpperCase()}  ·  INR ${attendeeSeatPrice}`, cardLeft + 42, rowY + 8, { characterSpacing: 0.25 });
            document.fillColor('#183331').font('Helvetica-Bold').fontSize(9)
                .text(`${pdfText(attendee.name || 'Guest')}  ·  Seat ${attendee.seat ?? index + 1}  ·  ${pdfText(attendeeSeatType)}`, cardLeft + 42, rowY + 22, { width: cardWidth - 270, ellipsis: true });
            document.fillColor('#526461').font('Helvetica').fontSize(8)
                .text(attendee.gender ? `GENDER  ${pdfText(attendee.gender).toUpperCase()}` : '', cardLeft + cardWidth - 175, rowY + 17, { width: 80, align: 'right' });
            document.fillColor('#526461').font('Helvetica').fontSize(8)
                .text(attendee.age === '' || attendee.age == null ? '' : `AGE  ${attendee.age}`, cardLeft + cardWidth - 87, rowY + 17, { width: 72, align: 'right' });
            rowY += 50;
        });

        const totalY = Math.max(rowY + 10, 590);
        document.roundedRect(cardLeft, totalY, cardWidth, 58, 8).fill('#123f3a');
        document.fillColor('#c4e2d8').font('Helvetica-Bold').fontSize(8)
            .text('TOTAL PAID', cardLeft + 16, totalY + 14, { characterSpacing: 0.8 });
        document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
            .text(booking.amount === 0 ? 'FREE' : `INR ${booking.amount}`, cardLeft + 16, totalY + 29);
        document.fillColor('#d2e7e1').font('Helvetica').fontSize(8)
            .text(`SEATS  ${seats.join(', ') || 'Not assigned'}`, cardLeft + 260, totalY + 24, { width: cardWidth - 276, align: 'right' });

        const footerY = totalY + 88;
        document.moveTo(cardLeft, footerY).lineTo(cardLeft + cardWidth, footerY).lineWidth(1).strokeColor('#e1eae6').stroke();
        document.fillColor('#71817e').font('Helvetica').fontSize(8)
            .text('Keep this ticket ready and present it at the entrance.', cardLeft, footerY + 14, { width: cardWidth - 100 });
        document.fillColor('#9aa9a5').font('Helvetica').fontSize(7)
            .text(`EVENTORA  •  ${ticketCode}`, cardLeft + cardWidth - 130, footerY + 14, { width: 130, align: 'right' });
        document.end();
    });
};

module.exports = generateTicketPdf;