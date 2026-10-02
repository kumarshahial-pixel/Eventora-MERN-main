const Event = require('../models/Event');

const normalizeSlotDate = (value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const slotDateKey = (value) => normalizeSlotDate(value)?.toISOString().slice(0, 10) || null;

const bookingSlotDateFilter = (event, slotDate) => {
    const normalizedDate = normalizeSlotDate(slotDate);
    if (slotDateKey(normalizedDate) === slotDateKey(event.date)) {
        return { $or: [{ slotDate: normalizedDate }, { slotDate: { $exists: false } }] };
    }
    return { slotDate: normalizedDate };
};

const buildEventSlots = ({ startDate, endDate, repeatEveryDays, startTime, endTime, totalSeats }) => {
    const firstDate = normalizeSlotDate(startDate);
    const lastDate = normalizeSlotDate(endDate || startDate);
    if (!firstDate || !lastDate || firstDate > lastDate) return null;

    const slots = [];
    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
        slots.push({
            date: new Date(currentDate),
            startTime,
            endTime,
            availableSeats: totalSeats
        });
        if (slots.length > 100) return null;
        currentDate.setUTCDate(currentDate.getUTCDate() + repeatEveryDays);
    }
    return slots;
};

const getEventSlot = (event, requestedDate) => {
    const dateKey = slotDateKey(requestedDate || event.date);
    if (!dateKey) return null;

    if (event.slots?.length) {
        return event.slots.find((slot) => slotDateKey(slot.date) === dateKey) || null;
    }

    return slotDateKey(event.date) === dateKey
        ? { date: normalizeSlotDate(event.date), availableSeats: event.availableSeats, startTime: event.startTime, endTime: event.endTime }
        : null;
};

const reserveEventSlotSeats = async (event, slot, seatCount) => {
    if (!event.slots?.length) {
        return Event.findOneAndUpdate(
            { _id: event._id, availableSeats: { $gte: seatCount } },
            { $inc: { availableSeats: -seatCount } },
            { new: true }
        );
    }

    const slotIndex = event.slots.findIndex((eventSlot) => slotDateKey(eventSlot.date) === slotDateKey(slot.date));
    if (slotIndex < 0) return null;
    const increment = { [`slots.${slotIndex}.availableSeats`]: -seatCount };
    if (slotIndex === 0) increment.availableSeats = -seatCount;

    return Event.findOneAndUpdate(
        {
            _id: event._id,
            [`slots.${slotIndex}.date`]: slot.date,
            [`slots.${slotIndex}.availableSeats`]: { $gte: seatCount }
        },
        { $inc: increment },
        { new: true }
    );
};

const restoreEventSlotSeats = async (eventId, slotDate, seatCount) => {
    const event = await Event.findById(eventId).select('date slots');
    if (!event) return false;

    if (!event.slots?.length) {
        await Event.updateOne({ _id: eventId }, { $inc: { availableSeats: seatCount } });
        return true;
    }

    const slotIndex = event.slots.findIndex((slot) => slotDateKey(slot.date) === slotDateKey(slotDate || event.date));
    if (slotIndex < 0) return false;
    const increment = { [`slots.${slotIndex}.availableSeats`]: seatCount };
    if (slotIndex === 0) increment.availableSeats = seatCount;

    const result = await Event.updateOne(
        { _id: eventId, [`slots.${slotIndex}.date`]: event.slots[slotIndex].date },
        { $inc: increment }
    );
    return result.modifiedCount > 0;
};

module.exports = { normalizeSlotDate, slotDateKey, bookingSlotDateFilter, buildEventSlots, getEventSlot, reserveEventSlotSeats, restoreEventSlotSeats };