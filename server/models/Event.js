const mongoose = require('mongoose');

const eventSlotSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    availableSeats: { type: Number, required: true }
}, { _id: false });

const seatTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 0 },
    totalSeats: { type: Number, required: true, min: 1, default: 1 }
}, { _id: false });

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    totalSeats: { type: Number, required: true },
    availableSeats: { type: Number, required: true },
    endDate: { type: Date },
    startTime: { type: String },
    endTime: { type: String },
    repeatEveryDays: { type: Number, enum: [2, 4], default: 2 },
    slots: { type: [eventSlotSchema], default: [] },
    image: { type: String },
    ticketPrice: { type: Number, required: true, default: 0 },
    seatTypes: { type: [seatTypeSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
