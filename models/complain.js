const mongoose = require("mongoose");
const { Schema } = mongoose;

const complaintsSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Maintenance', 'Security', 'Noise', 'Parking', 'Cleaning', 'Other'],
        default: 'Other',
        required: true,

    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Low',
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    Attachments: {
        url: String,
        filename: String,
    }
});

module.exports = mongoose.model("Complaints", complaintsSchema);