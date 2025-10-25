const mongoose = require("mongoose");

const billTemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true, // E.g., "Water Bill July"
  },
  type: {
    type: String,
    enum: ["Maintenance", "Parking", "Water", "Electricity", "Other"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  penalty: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SocitySetUp", // Admin
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("AdminBillTemplate", billTemplateSchema);
