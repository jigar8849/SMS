// const express = require("express");
// const router = express.Router();
// const NewMember = require('../models/newMember'); //require model that store new member details
// const SocitySetUp = require('../models/socitySetUp');  //require model that store society setup details
// const Complaints = require("../models/complain");   //require model that store complaint details
// const Employees = require("../models/employee");    // require model that store employee details
// const Event = require("../models/event");
// const AdminBillTemplate = require("../models/adminBill"); //admin can create bill and store data in this
// const ResidentBill = require("../models/residentBill");  // Resident pay bill that can created by admin
// const {isAdminLoggedIn } = require("../middleware");


// router.get("/dashboard", async (req, res) => {
//   const totalResidents = await SocitySetUp.findOne();
//   const totalComplains = await Complaints.countDocuments();
//   const totalParkingTaken = await NewMember.countDocuments({
//     $or: [
//       { two_wheeler: { $exists: true, $ne: "" } },
//       { four_wheeler: { $exists: true, $ne: "" } }
//     ]
//   });
//   res.render("admin/dashboard.ejs", { totalResidents, totalComplains, totalParkingTaken });
// })




// router.get("/admin/addNewResident", isAdminLoggedIn, (req, res) => {
//   res.render("forms/addResident")
// })










// module.exports = router;
