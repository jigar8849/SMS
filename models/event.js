const mongoose = require("mongoose");
const { Schema } = mongoose;

const eventSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    venue: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"

    },
    attendees: {
        type: Number,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "NewMember", // 👈 This links to your NewMember model
    }
})

module.exports = mongoose.model("Event", eventSchema);