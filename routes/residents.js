const express = require("express");
const router = express.Router();
const NewMember = require('../models/newMember'); //require model that store new member details
const SocitySetUp = require('../models/socitySetUp');  //require model that store society setup details
const Complaints = require("../models/complain");   //require model that store complaint details
const Employees = require("../models/employee");    // require model that store employee details
const Event = require("../models/event");
const AdminBillTemplate = require("../models/adminBill"); //admin can create bill and store data in this
const ResidentBill = require("../models/residentBill");  // Resident pay bill that can created by admin
const { isResidentLoggedIn } = require("../middleware");
const PDFDocument = require('pdfkit');
const { route } = require("./admin");
const residentController = require("../controllers/resident")


/* Dashboard */
//this router is render dashboard page
router.get("/dashboard", residentController.dashboard);

/* BILL-PAYMENT */
// this route is render bill&payment page
router.get("/billsPayment", residentController.billPayment);

/* COMPLAINTS */
// this route render to complaint page
router.get("/complaints", residentController.complaints)

//this route render new complain page
router.get("/newComplain", isResidentLoggedIn, residentController.newComplaints)

//POST the newComplain data to the database
router.post("/newComplain", isResidentLoggedIn, residentController.newComplaintsData);

//DELETe the created complain
router.delete("/complaints/:id", isResidentLoggedIn, residentController.complaintsDelete)


/* EVENT */
//this page redirect to main EVENT BOOK page
router.get("/bookEvent", residentController.eventBook)

//this page to Render to EVENT BOOK Form page 
router.get("/bookEvent/book", isResidentLoggedIn,residentController.eventBookForm)

//this route to POST the event data to the database
router.post("/bookEvent/book", isResidentLoggedIn,residentController.eventBookData)

//this route render to edit page
router.get("/bookEvent/:id/edit", residentController.eventEditForm)

//EDIT the created event
router.post("/bookEvent/:id/edit", residentController.eventEditData)

//DELETE the created event
router.delete("/bookEvent/:id", residentController.eventDelete)


//this route is render to ownerList  page
router.get("/ownerList", residentController.ownerList);

router.get("/ownerList/:blockName", residentController.ownerListBlock)


//generate RESIDENT side owner list PDF
router.get('/download-pdf', residentController.pdfDownload);

//this route use to render vehicle search page
router.get("/vehicleSearch", residentController.vehicleSearch)

//this route use to render society staff page
router.get("/societyStaff",residentController.societyStaff)

//this route use to render Profile page
router.get("/profile", residentController.profile);

//EDIT - this route is render to edit the profile of the user
router.get("/profile/:id/edit", isResidentLoggedIn, residentController.profileEditPage)

// EDIT - edit profile info and post on database
router.post("/profile/:id/edit", residentController.profileEditData)

//this route is render addFamilyMember page
router.get("/addFamilyMember/:id/add", isResidentLoggedIn,residentController.addMemberPage);

//this route post data to database and redirect to profile page
router.post("/addFamilyMember/:id/add", residentController.addMemberData)


//this route render to change password page
router.get("/profile/:id/change-password", isResidentLoggedIn,residentController.profilePasswordPage);

//this route post new PAssword in database
router.post("/profile/:id/change-password", isResidentLoggedIn, residentController.profilePasswordData);


module.exports = router;
