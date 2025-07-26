const express = require("express");
const router = express.Router();
const NewMember = require('../models/newMember'); //require model that store new member details
const SocitySetUp = require('../models/socitySetUp');  //require model that store society setup details
const Complaints = require("../models/complain");   //require model that store complaint details
const Employees = require("../models/employee");    // require model that store employee details
const AdminBillTemplate = require("../models/adminBill"); //admin can create bill and store data in this
const ResidentBill = require("../models/residentBill");  // Resident pay bill that can created by admin
const { isAdminLoggedIn } = require("../middleware");
const PDFDocument = require('pdfkit');
const adminController = require("../controllers/admin")

/* DASHBOARD */
//render to dashboard in admin panel
router.get("/dashboard", adminController.dashboard);

/* RESIDENT */
// simple admin page RESIDENTS page route
router.get("/residents", adminController.residents)

// this is for add new resident btn 
router.get("/addNewResident", isAdminLoggedIn, adminController.addNewResident)


//this route add mew member take there details and post them in database
router.post("/addNewResident",adminController.addNewResidentData);


// EDIT - this edit ICON redirect to the edit form page
router.get("/residents/:id/edit", isAdminLoggedIn, adminController.residentEdit)


//EDIT - This page edit the existing residents details(DATA)
router.put("/residents/:id",adminController.residentEditData);

//DELETE - this route use to delete perticular one resident from table
router.delete("/residents/:id", isAdminLoggedIn, adminController.residentDelete)


/* PAYMENTS */
//render to payment page in admin page
router.get("/payments", adminController.payments)


//render to create bill page
router.get("/createBill", isAdminLoggedIn,adminController.createBill);

//save created bill data in database
router.post("/createBill", isAdminLoggedIn, adminController.createBillData);


// GET: Render created bill list for admin
router.get("/bill-list", isAdminLoggedIn,adminController.billList);

// GET: Render bill edit form
router.get("/bills/:id/edit", isAdminLoggedIn, adminController.billEditForm);

// PUT: Update bill created bills
router.put("/bills/:id", isAdminLoggedIn,adminController.billUpdate);


// DELETE: delete created bills bill
router.delete("/bills/:id", isAdminLoggedIn, adminController.billDelete);

//this route use to mark as paid when admin click on "Mark Paid" text
router.get("/payments/mark/:id",adminController.mark)


/* PARKING */
//this route is render to parking page
router.get("/parking", adminController.parking)


/* EMPLOYEE */
//this route is render to Employee page
router.get("/employees", adminController.employees)

// This is for add new employee BTN
router.get("/addNewEmployee", isAdminLoggedIn, adminController.addNewEmployee)

//post new employee data to database
router.post("/addNewEmployee", adminController.addNewEmployeeData)

//this route is use to render employee edit page
router.get("/employees/:id/edit", isAdminLoggedIn, adminController.editEmpPage)

//EDIT- This route is use to edit the existing data of employee
router.put("/employees/:id",adminController.editEmpData)

//DELETE- use to delete the employee
router.delete("/employees/:id",adminController.empDelete)


/* FLAT LIST */

//this route render to flat list page
router.get("/flatList", adminController.flatList)

// When we click any block box than table show
router.get("/flatList/:blockName", isAdminLoggedIn, adminController.flatListBlock)

// this route is use to generate PDF for any perticular block members
router.get('/download-pdf', adminController.pdfDownload);


/* COMPLAINTS */
//this routes are use to render complaint page
router.get("/complaints", adminController.complaints)

// render to complaint MANAGE page
router.get("/complaints/:id/edit", isAdminLoggedIn,adminController.complaintEditPage)

// POST the complaint Manage detail from admin page
router.post("/complaints/:id/edit", adminController.complaintsData)


module.exports = router;
