const Event = require('../models/Event');
const { expirePaymentHolds } = require('../utils/paymentGateway');
const { normalizeSlotDate, buildEventSlots } = require('../utils/eventSlots');
const { ensureSeatTypes, sortSeatTypes } = require('../utils/seatTypes');

exports.getEvents = async (req, res) => {
    try {
        await expirePaymentHolds();
        const filters = {};
        if (req.query.category) filters.category = req.query.category;
        if (req.query.search) filters.title = { $regex: req.query.search, $options: 'i' };

        const events = await Event.find(filters).populate('createdBy', 'name email');
        res.json(events.map((event) => ensureSeatTypes(event)));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        await expirePaymentHolds();
        const event = await Event.findById(req.params.id).populate('createdBy', 'name email');
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(ensureSeatTypes(event));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, endDate, startTime, endTime, repeatEveryDays, location, category, totalSeats, ticketPrice, image, seatTypes } = req.body;
        const seatTypeList = Array.isArray(seatTypes) && seatTypes.length ? seatTypes : [{ name: 'General', price: Number(ticketPrice) || 0, totalSeats: Number(totalSeats) || 1 }];
        const normalizedSeatTypes = seatTypeList.map((seatType) => ({
            name: String(seatType.name || 'General').trim(),
            price: Number(seatType.price),
            totalSeats: Number(seatType.totalSeats) || 1
        })).filter((seatType) => seatType.name && seatType.totalSeats > 0);

        if (!normalizedSeatTypes.length) {
            return res.status(400).json({ message: 'Add at least one valid seat type' });
        }
        if (normalizedSeatTypes.some((seatType) => !Number.isFinite(seatType.price) || seatType.price < 0)) {
            return res.status(400).json({ message: 'Enter a valid price for every seat type' });
        }
        if (new Set(normalizedSeatTypes.map((seatType) => seatType.name.toLowerCase())).size !== normalizedSeatTypes.length) {
            return res.status(400).json({ message: 'Seat type names must be unique' });
        }

        const orderedSeatTypes = sortSeatTypes(normalizedSeatTypes);
        const seatCapacity = orderedSeatTypes.reduce((sum, seatType) => sum + seatType.totalSeats, 0);
        const intervalDays = Number(repeatEveryDays);
        const startSlotDate = normalizeSlotDate(date);
        const lastSlotDate = normalizeSlotDate(endDate || date);
        if (!startSlotDate || !lastSlotDate || startSlotDate > lastSlotDate) {
            return res.status(400).json({ message: 'Choose a valid first and last event date' });
        }
        if (!['2', '4'].includes(String(repeatEveryDays))) {
            return res.status(400).json({ message: 'Choose a repeat interval of 2 or 4 days' });
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '')) {
            return res.status(400).json({ message: 'Enter a valid event start and end time' });
        }
        if (!Number.isInteger(seatCapacity) || seatCapacity < 1) {
            return res.status(400).json({ message: 'Enter valid seat counts for all seat types' });
        }

        const slots = buildEventSlots({
            startDate: startSlotDate,
            endDate: lastSlotDate,
            repeatEveryDays: intervalDays,
            startTime,
            endTime,
            totalSeats: seatCapacity
        });
        if (!slots) return res.status(400).json({ message: 'The date range is invalid or creates more than 100 event dates' });

        const event = await Event.create({
            title,
            description,
            date: slots[0].date,
            endDate: lastSlotDate,
            startTime,
            endTime,
            repeatEveryDays: intervalDays,
            slots,
            location,
            category,
            totalSeats: seatCapacity,
            availableSeats: slots[0].availableSeats,
            ticketPrice: Number(ticketPrice) || orderedSeatTypes[0].price || 0,
            seatTypes: orderedSeatTypes,
            image: image || '',
            createdBy: req.user.id
        });
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
