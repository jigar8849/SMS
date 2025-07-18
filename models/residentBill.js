const mongoose = require("mongoose");

const residentBillSchema = new mongoose.Schema({
  resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NewMember",
    required: true,
  },
  billTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AdminBillTemplate",
    required: true,
  },
  amount: Number,         // from template
  dueDate: Date,          // from template
  penaltyPerDay: Number,  // from template

  isPaid: {
    type: Boolean,
    default: false,
  },
  paidAt: Date,

  totalPaid: Number, // Includes penalty if paid late

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ResidentBill", residentBillSchema);
