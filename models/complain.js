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
    created_at : {
        type : Date,
        required : true,
        default : Date.now
    },
    Attachments: {
        url: String,
        filename: String,
    },
    status : {
        type : String,
        enum : ["Pending", "Complete", "On-hold", "Reject","InProgress"],
        default : "Pending"

    },
    resident : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "NewMember"
    }
});

module.exports = mongoose.model("Complaints", complaintsSchema);