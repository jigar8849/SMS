
const NewMember = require('../models/newMember'); //require model that store new member details
const SocitySetUp = require('../models/socitySetUp');  //require model that store society setup details
const Complaints = require("../models/complain");   //require model that store complaint details
const Employees = require("../models/employee");    // require model that store employee details
const Event = require("../models/event");
const AdminBillTemplate = require("../models/adminBill"); //admin can create bill and store data in this
const ResidentBill = require("../models/residentBill");  // Resident pay bill that can created by admin
const PDFDocument = require('pdfkit');



module.exports.dashboard = async (req, res) => {
  const resId = req.session.addNewMember?.id;

  if (!resId) return res.redirect("/login");
  const resName = await NewMember.findById(resId);
  res.render("resident/dashboard", { resName });
}

module.exports.billPayment = async (req, res) => {
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
}

module.exports.complaints = async (req, res) => {
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
}

module.exports.newComplaints = async (req, res) => {
  res.render("forms/newComplain");
}

module.exports.newComplaintsData = async (req, res) => {
  try {
    if (!req.body || !req.body.title || !req.body.description) {
      req.flash("error", "All fields are required.");
      return res.redirect("/resident/complaints");
    }

    req.body.resident = req.session.addNewMember.id;

    const newComplain = new Complaints(req.body);
    await newComplain.save();

    req.flash("success", "Complaint submitted successfully.");
    res.redirect("/resident/complaints");
  } catch (err) {
    console.error("🔴 Error in newComplaintsData:", err);
    req.flash("error", "Failed to submit complaint.");
    res.redirect("/resident/complaints");
  }
};



module.exports.complaintsDelete = async (req, res) => {
  const { id } = req.params;
  await Complaints.findByIdAndDelete(id);
  res.redirect("/resident/complaints")
}

module.exports.eventBook = async (req, res) => {
  const eventDetails = await Event.find({}).populate("createdBy", "first_name last_name")
  res.render("resident/bookEvent", { eventDetails })
}

module.exports.eventBookForm =  (req, res) => {
  res.render("forms/eventBook")
}

module.exports.eventBookData =  async (req, res) => {
  const data = req.body;
  const newEvent = new Event({
    ...data,
    createdBy: req.session.addNewMember.id //  This links the event to the user!
  }); await newEvent.save()
  res.redirect("/resident/bookEvent")

}

module.exports.eventEditForm = async (req, res) => {
  const id = req.params.id;
  const eventDetails = await Event.findById(id)
  res.render("forms/updateEvent", { eventDetails })
}

module.exports.eventEditData = async (req, res) => {
  await Event.findByIdAndUpdate(req.params.id, req.body)
  res.redirect("/resident/bookEvent")
}

module.exports.eventDelete =async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.redirect("/resident/bookEvent");
}

module.exports.ownerList = async (req, res) => {
  const BlockList = await SocitySetUp.find();
  res.render("resident/ownerList", { BlockList })
}

module.exports.ownerListBlock = async (req, res) => {
  const blockName = req.params.blockName
  const members = await NewMember.find({ block: blockName });
  res.render("forms/ownerList", { blockName, members })
}

module.exports.pdfDownload = async (req, res) => {
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
}


module.exports.vehicleSearch = async (req, res) => {
  const allParkingDetails = await NewMember.find({
    $or: [
      { two_wheeler: { $exists: true, $ne: "" } },
      { four_wheeler: { $exists: true, $ne: "" } }
    ]
  });
  const twoWheeler = await NewMember.countDocuments({ two_wheeler: { $exists: true, $ne: "" } });
  const fourWheeler = await NewMember.countDocuments({ four_wheeler: { $exists: true, $ne: "" } });
  res.render("resident/vehicleSearch", { allParkingDetails, twoWheeler, fourWheeler });
}

module.exports.societyStaff =  async (req, res) => {
  const staffDetails = await Employees.find();
  res.render("resident/societyStaff", { staffDetails })
}


module.exports.profile = async (req, res) => {
  const profileInfo = await NewMember.findById(req.session.addNewMember.id);
  res.render("resident/profile", { profileInfo });
}

module.exports.profileEditPage = async (req, res) => {
  const id = req.params.id;
  const profileInfo = await NewMember.findById(id)
  res.render("forms/editProfile", { profileInfo });
}

module.exports.profileEditData = async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  await NewMember.findByIdAndUpdate(id, data);
  res.redirect("/resident/profile")
}

module.exports.addMemberPage =  async (req, res) => {
  const memberDetailId = await NewMember.findById(req.session.addNewMember.id);
  res.render("forms/addFamilyMember", { memberDetailId });
}

module.exports.addMemberData = async (req, res) => {
  const id = req.params.id
  const data = req.body;
  await NewMember.findByIdAndUpdate(id, data)
  res.redirect("/resident/profile")
}

module.exports.profilePasswordPage =  async (req, res) => {
  const profileInfo = await NewMember.findById(req.params.id);
  if (!profileInfo) return res.status(404).send("User not found");
  res.render("forms/changePass", { profileInfo });
}

module.exports.profilePasswordData = async (req, res) => {
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
}