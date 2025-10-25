  
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

module.exports.newComplaintsDataAPI = async (req, res) => {
  try {
    const { title, category, priority, description, date } = req.body;

    if (!title || !category || !priority || !description || !date) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Assuming resident ID is sent in the request body or from session/auth
    const residentId = req.body.resident || req.session?.addNewMember?.id;
    // For testing purposes, use a dummy resident ID if not authenticated
    const finalResidentId = residentId && residentId !== 'some-resident-id' ? residentId : '507f1f77bcf86cd799439011'; // Dummy ObjectId for testing

    const newComplain = new Complaints({
      title,
      category,
      priority,
      description,
      created_at: new Date(date),
      resident: residentId
    });

    await newComplain.save();

    res.status(201).json({ success: true, message: "Complaint submitted successfully.", complaint: newComplain });
  } catch (err) {
    console.error("🔴 Error in newComplaintsDataAPI:", err);
    res.status(500).json({ success: false, message: "Failed to submit complaint." });
  }
};



module.exports.complaintsDelete = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('DELETE request for complaint ID:', id);
    console.log('Request headers:', req.headers);
    console.log('ID length:', id.length, 'Is valid ObjectId:', /^[a-f\d]{24}$/i.test(id));

    // Check if ID is valid MongoDB ObjectId
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ success: false, message: 'Invalid complaint ID format' });
    }

    const complaint = await Complaints.findByIdAndDelete(id);
    console.log('Deleted complaint:', complaint);

    // Even if complaint is not found, consider it a successful delete operation
    // (it might have been deleted already or the UI had stale data)
    console.log('Delete operation completed for ID:', id);
    return res.status(200).json({
      success: true,
      message: complaint ? 'Complaint deleted successfully' : 'Complaint was already deleted or not found'
    });
  } catch (err) {
    console.error('Error deleting complaint:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ success: false, message: `Failed to delete complaint: ${err.message}` });
  }
}

module.exports.getComplaintsAPI = async (req, res) => {
  try {
    // Temporarily return all complaints for testing (remove resident filter)
    const complaints = await Complaints.find({}).sort({ created_at: -1 });

    const formattedComplaints = complaints.map(complaint => ({
      id: complaint._id,
      title: complaint.title,
      description: complaint.description,
      filedOn: complaint.created_at.toISOString().split('T')[0], // YYYY-MM-DD
      category: complaint.category,
      status: complaint.status === "Complete" ? "Resolved" :
              complaint.status === "Reject" ? "Rejected" :
              complaint.status === "InProgress" ? "In Progress" :
              complaint.status === "On-hold" ? "Pending" : complaint.status,
      priority: complaint.priority,
      attachments: complaint.Attachments ? 1 : 0 // Assuming one attachment or none
    }));

    res.status(200).json({ success: true, complaints: formattedComplaints });
  } catch (err) {
    console.error("🔴 Error in getComplaintsAPI:", err);
    res.status(500).json({ success: false, message: "Failed to fetch complaints." });
  }
};

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

module.exports.eventDeleteAPI = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('DELETE request for event ID:', id);
    console.log('ID length:', id.length, 'Is valid ObjectId:', /^[a-f\d]{24}$/i.test(id));

    // Check if ID is valid MongoDB ObjectId
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const event = await Event.findByIdAndDelete(id);
    console.log('Deleted event:', event);

    // Even if event is not found, consider it a successful delete operation
    // (it might have been deleted already or the UI had stale data)
    console.log('Delete operation completed for ID:', id);
    return res.status(200).json({
      success: true,
      message: event ? 'Event deleted successfully' : 'Event was already deleted or not found'
    });
  } catch (err) {
    console.error('Error deleting event:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ success: false, message: `Failed to delete event: ${err.message}` });
  }
}

module.exports.newEventDataAPI = async (req, res) => {
  try {
    const { title, venueId, attendees, date, startTime, endTime } = req.body;

    if (!title || !venueId || !attendees || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Get resident ID from session or request body (temporarily allow without auth for testing)
    const residentId = req.session?.addNewMember?.id || req.body.residentId || '507f1f77bcf86cd799439011'; // Dummy ObjectId for testing

    // Map venueId to venue name (you might want to create a venue model later)
    const venueMap = {
      "v1": "Club House",
      "v2": "Garden Area",
      "v3": "Community Hall",
      "v4": "Terrace Garden"
    };
    const venue = venueMap[venueId] || venueId;

    const newEvent = new Event({
      title,
      venue,
      date: new Date(date),
      startTime,
      endTime,
      attendees: Number(attendees),
      createdBy: residentId
    });

    await newEvent.save();

    res.status(201).json({
      success: true,
      message: "Event booked successfully.",
      event: newEvent
    });
  } catch (err) {
    console.error("🔴 Error in newEventDataAPI:", err);
    res.status(500).json({ success: false, message: "Failed to book event." });
  }
};

module.exports.getEventsAPI = async (req, res) => {
  try {
    const residentId = req.session?.addNewMember?.id || req.query.residentId || '507f1f77bcf86cd799439011'; // Dummy ObjectId for testing

    const events = await Event.find({ createdBy: residentId })
      .populate("createdBy", "first_name last_name")
      .sort({ date: -1 });

    // Map venue back to venueId for frontend compatibility
    const venueMap = {
      "Club House": "v1",
      "Garden Area": "v2",
      "Community Hall": "v3",
      "Terrace Garden": "v4"
    };

    const formattedEvents = events.map(event => ({
      id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      startTime: event.startTime,
      endTime: event.endTime,
      venueId: venueMap[event.venue] || event.venue,
      attendees: event.attendees,
      organizer: event.createdBy ? `${event.createdBy.first_name} ${event.createdBy.last_name}` : "Unknown",
      status: event.status
    }));

    res.status(200).json({
      success: true,
      events: formattedEvents
    });
  } catch (err) {
    console.error("🔴 Error in getEventsAPI:", err);
    res.status(500).json({ success: false, message: "Failed to fetch events." });
  }
};

module.exports.getEventByIdAPI = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('GET request for event ID:', id);

    // Check if ID is valid MongoDB ObjectId
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const event = await Event.findById(id).populate("createdBy", "first_name last_name");

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Map venue back to venueId for frontend compatibility
    const venueMap = {
      "Club House": "v1",
      "Garden Area": "v2",
      "Community Hall": "v3",
      "Terrace Garden": "v4"
    };

    const formattedEvent = {
      id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      startTime: event.startTime,
      endTime: event.endTime,
      venueId: venueMap[event.venue] || event.venue,
      attendees: event.attendees,
      organizer: event.createdBy ? `${event.createdBy.first_name} ${event.createdBy.last_name}` : "Unknown",
      status: event.status
    };

    res.status(200).json({
      success: true,
      event: formattedEvent
    });
  } catch (err) {
    console.error('Error fetching event:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ success: false, message: `Failed to fetch event: ${err.message}` });
  }
};

module.exports.updateEventAPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, venueId, attendees, date, startTime, endTime } = req.body;

    console.log('PUT request for event ID:', id);
    console.log('Request body:', req.body);

    // Check if ID is valid MongoDB ObjectId
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    // Validate required fields
    if (!title || !venueId || !attendees || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Map venueId to venue name
    const venueMap = {
      "v1": "Club House",
      "v2": "Garden Area",
      "v3": "Community Hall",
      "v4": "Terrace Garden"
    };
    const venue = venueMap[venueId] || venueId;

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      {
        title,
        venue,
        date: new Date(date),
        startTime,
        endTime,
        attendees: Number(attendees)
      },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      event: updatedEvent
    });
  } catch (err) {
    console.error('Error updating event:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ success: false, message: `Failed to update event: ${err.message}` });
  }
};

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