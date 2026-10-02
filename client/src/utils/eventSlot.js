export const formatBookingSlot = (booking) => {
    const event = booking?.eventId;
    const dateValue = booking?.slotDate || event?.date;
    if (!dateValue) return 'Unavailable';

    const dateKey = new Date(dateValue).toISOString().slice(0, 10);
    const slot = event?.slots?.find((eventSlot) => new Date(eventSlot.date).toISOString().slice(0, 10) === dateKey);
    const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString();
    const timeLabel = slot?.startTime && slot?.endTime ? ` · ${slot.startTime}-${slot.endTime}` : '';
    return `${dateLabel}${timeLabel}`;
};