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



/* Dashboard */
//this router is render dashboard page
router.get("/dashboard", async (req, res) => {
  const resId = req.session.addNewMember?.id;

  if (!resId) return res.redirect("/login");
  const resName = await NewMember.findById(resId);
  res.render("resident/dashboard", { resName });
});

/* BILL-PAYMENT */
// this route is render bill&payment page
router.get("/billsPayment", async (req, res) => {
  try {
    if (!req.session.addNewMember?.id) {
      return res.redirect("/resident-login");
    }

    const residentBills = await ResidentBill.find({
      resident: req.session.addNewMember.id
    }).populate("billTemplate");

    // Calculate next due date
    const upcomingBills = residentBills.filter(bill => !bill.isPaid && bill.dueDate);
    let nextDueDate = 'No dues';
    if (upcomingBills.length > 0) {
      const dates = upcomingBills.map(bill => new Date(bill.dueDate));
      const minDate = new Date(Math.min(...dates));
      nextDueDate = minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Calculate totals
    const pendingTotal = residentBills
      .filter(bill => !bill.isPaid)
      .reduce((sum, bill) => sum + bill.amount, 0);

    const paidTotal = residentBills
      .filter(bill => bill.isPaid)
      .reduce((sum, bill) => sum + bill.amount, 0);

    res.render("resident/billsPayment", {
      billDetails: residentBills.map(bill => ({
        _id: bill._id,
        title: bill.billTemplate?.title || "Untitled Bill",
        amount: bill.amount,
        dueDate: bill.dueDate,
        status: bill.isPaid ? "Paid" : "Pending",
        paidAt: bill.paidAt,
        type: bill.billTemplate?.type
      })),
      nextDueDate,
      pendingTotal,
      paidTotal
    });

  } catch (err) {
    console.error("Error in /resident-billsPayment:", err);
    res.status(500).send("Error loading bills");
  }
});

/* COMPLAINTS */
// this route render to complaint page
router.get("/complaints", async (req, res) => {
  const complainsDetails = await Complaints.find()
  const totalComplains = await Complaints.countDocuments()
  const statusCounts = await Complaints.aggregate([
    {
      $match: {
        status: { $in: ["Reject", "Complete", "InProgress"] }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  // Turn it into an object for easy EJS use:
  const counts = {
    Reject: 0,
    Complete: 0,
    InProgress: 0
  };

  statusCounts.forEach(item => {
    counts[item._id] = item.count;
  });
  res.render("resident/complaints", { complainsDetails, totalComplains, counts })
})

//this route render new complain page
router.get("/newComplain", isResidentLoggedIn, async (req, res) => {
  res.render("forms/newComplain");
})

//POST the newComplain data to the database
router.post("/newComplain", isResidentLoggedIn, async (req, res) => {
  const newComplainData = req.body;
  //Attach the logged-in resident’s ID
  newComplainData.resident = req.session.addNewMember.id;
  const newComplain = new Complaints(newComplainData);
  await newComplain.save();
  res.redirect("/resident/complaints");
});

//DELETe the created complain
router.delete("/complaints/:id", isResidentLoggedIn, async (req, res) => {
  const { id } = req.params;
  await Complaints.findByIdAndDelete(id);
  res.redirect("/resident/complaints")
})


/* EVENT */
//this page redirect to main EVENT BOOK page
router.get("/bookEvent", async (req, res) => {
  const eventDetails = await Event.find({}).populate("createdBy", "first_name last_name")
  res.render("resident/bookEvent", { eventDetails })
})

//this page to Render to EVENT BOOK Form page 
router.get("/bookEvent/book", isResidentLoggedIn, (req, res) => {
  res.render("forms/eventBook")
})

//this route to POST the event data to the database
router.post("/bookEvent/book", isResidentLoggedIn, async (req, res) => {
  const data = req.body;
  const newEvent = new Event({
    ...data,
    createdBy: req.session.addNewMember.id //  This links the event to the user!
  }); await newEvent.save()
  res.redirect("/resident/bookEvent")

})

//this route render to edit page
router.get("/bookEvent/:id/edit", async (req, res) => {
  const id = req.params.id;
  const eventDetails = await Event.findById(id)
  res.render("forms/updateEvent", { eventDetails })
})

//EDIT the created event
router.post("/bookEvent/:id/edit", async (req, res) => {
  await Event.findByIdAndUpdate(req.params.id, req.body)
  res.redirect("/resident/bookEvent")
})

//DELETE the created event
router.delete("/bookEvent/:id", async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.redirect("/resident/bookEvent");
})


//this route is render to ownerList  page
router.get("/ownerList", async (req, res) => {
  const BlockList = await SocitySetUp.find();
  res.render("resident/ownerList", { BlockList })
})

router.get("/ownerList/:blockName", async (req, res) => {
  const blockName = req.params.blockName
  const members = await NewMember.find({ block: blockName });
  res.render("forms/ownerList", { blockName, members })
})


//generate RESIDENT side owner list PDF
router.get('/download-pdf', async (req, res) => {
  try {
    const blockName = req.query.block;

    if (!blockName) {
      return res.status(400).send('Block parameter is required');
    }

    const members = await NewMember.find({ block: blockName })
      .sort({ flat_number: 1 });

    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'portrait'
    });

    // Set PDF filename with block name
    res.setHeader('Content-disposition', `attachment; filename="block-${blockName}-residents.pdf"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Title with block name
    doc.fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(`Block ${blockName} Resident List`, { align: 'center' })
      .moveDown(0.5);

    // Generation info
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#555555')
      .text(`Generated on ${new Date().toLocaleDateString()} • ${members.length} residents`,
        { align: 'center' })
      .moveDown(1.5);

    // Table setup - optimized column widths
    const tableTop = 120;
    const rowHeight = 25;
    const colWidths = [50, 150, 100, 150, 80]; // No., Owner Name, Contact, Email, Family
    const tableLeft = 50; // Fixed left margin instead of centering

    // Draw table header
    doc.rect(tableLeft, tableTop - 25, colWidths.reduce((a, b) => a + b, 0), 25)
      .fill('#333333'); // Darker header

    // Header text (white)
    doc.font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#ffffff')
      .text('House No.', tableLeft + 1, tableTop - 20)
      .text('Owner Name', tableLeft + colWidths[0] + 5, tableTop - 20)
      .text('Contact', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop - 20)
      .text('Email', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop - 20)
      .text('Total Members', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop - 20);

    // Table rows
    doc.font('Helvetica')
      .fontSize(9)
      .fillColor('#000000');

    members.forEach((member, i) => {
      const y = tableTop + (i * rowHeight);

      // Alternate row background
      doc.fillColor(i % 2 === 0 ? '#ffffff' : '#f8f8f8')
        .rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
        .fill();

      // Reset to black text
      doc.fillColor('#000000');

      // Row content - with proper text wrapping for long fields
      doc.text(`${member.block}-${member.flat_number}`, tableLeft + 5, y + 8)
        .text(`${member.first_name} ${member.last_name}`, tableLeft + colWidths[0] + 5, y + 8, {
          width: colWidths[1] - 10,
          ellipsis: true
        })
        .text(member.mobile_number, tableLeft + colWidths[0] + colWidths[1] + 5, y + 8)
        .text(member.email || 'N/A', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, y + 8, {
          width: colWidths[3] - 10,
          ellipsis: true
        })
        .text(member.number_of_member?.toString() || 'N/A', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, y + 8);

      // Horizontal line between rows
      doc.strokeColor('#e0e0e0')
        .moveTo(tableLeft, y + rowHeight)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y + rowHeight)
        .stroke();
    });

    // Vertical borders
    doc.strokeColor('#d0d0d0')
      .lineWidth(0.5);

    // Draw vertical lines between columns
    let verticalLineX = tableLeft;
    for (let i = 0; i < colWidths.length; i++) {
      verticalLineX += colWidths[i];
      doc.moveTo(verticalLineX, tableTop - 25)
        .lineTo(verticalLineX, tableTop + (members.length * rowHeight))
        .stroke();
    }

    // Outer border
    doc.strokeColor('#000000')
      .lineWidth(1)
      .rect(tableLeft, tableTop - 25, colWidths.reduce((a, b) => a + b, 0),
        tableTop + (members.length * rowHeight) - (tableTop - 25))
      .stroke();

    // Footer
    doc.fontSize(9)
      .fillColor('#777777')
      .text('© Your Society Management System', 50, doc.page.height - 30,
        { align: 'left', width: doc.page.width - 100 })
      .text(`Page 1 of 1`, 50, doc.page.height - 30,
        { align: 'right', width: doc.page.width - 100 });

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).send('Error generating PDF');
  }
});

//this route use to render vehicle search page
router.get("/vehicleSearch", async (req, res) => {
  const allParkingDetails = await NewMember.find({
    $or: [
      { two_wheeler: { $exists: true, $ne: "" } },
      { four_wheeler: { $exists: true, $ne: "" } }
    ]
  });
  const twoWheeler = await NewMember.countDocuments({ two_wheeler: { $exists: true, $ne: "" } });
  const fourWheeler = await NewMember.countDocuments({ four_wheeler: { $exists: true, $ne: "" } });
  res.render("resident/vehicleSearch", { allParkingDetails, twoWheeler, fourWheeler });
})

//this route use to render society staff page
router.get("/societyStaff", async (req, res) => {
  const staffDetails = await Employees.find();
  res.render("resident/societyStaff", { staffDetails })
})

//this route use to render Profile page
router.get("/profile", async (req, res) => {
  const profileInfo = await NewMember.findById(req.session.addNewMember.id);
  res.render("resident/profile", { profileInfo });
});

//EDIT - this route is render to edit the profile of the user
router.get("/profile/:id/edit", isResidentLoggedIn, async (req, res) => {
  const id = req.params.id;
  const profileInfo = await NewMember.findById(id)
  res.render("forms/editProfile", { profileInfo });
})

// EDIT - edit profile info and post on database
router.post("/profile/:id/edit", async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  await NewMember.findByIdAndUpdate(id, data);
  res.redirect("/resident/profile")
})

//this route is render addFamilyMember page
router.get("/addFamilyMember/:id/add", isResidentLoggedIn, async (req, res) => {
  const memberDetailId = await NewMember.findById(req.session.addNewMember.id);
  res.render("forms/addFamilyMember", { memberDetailId });
});

//this route post data to database and redirect to profile page
router.post("/addFamilyMember/:id/add", async (req, res) => {
  const id = req.params.id
  const data = req.body;
  await NewMember.findByIdAndUpdate(id, data)
  res.redirect("/resident/profile")
})


//this route render to change password page
router.get("/profile/:id/change-password", isResidentLoggedIn, async (req, res) => {
  const profileInfo = await NewMember.findById(req.params.id);
  if (!profileInfo) return res.status(404).send("User not found");
  res.render("forms/changePass", { profileInfo });
});

//this route post new PAssword in database
router.post("/profile/:id/change-password", isResidentLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.send("New password and confirm password do not match");
  }

  try {
    const user = await NewMember.findById(id);
    if (!user) return res.status(404).send("User not found");

    await user.changePassword(oldPassword, newPassword); // from passport-local-mongoose
    await user.save();

    res.redirect("/resident/profile")

  } catch (err) {
    console.error("Password change error:", err);
    res.send("Failed to change password. Make sure the old password is correct.");
  }
});


module.exports = router;
