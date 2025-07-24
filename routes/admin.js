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


/* DASHBOARD */
//render to dashboard in admin panel
router.get("/dashboard", async (req, res) => {
    try {
        const totalResidents = await SocitySetUp.findOne();
        const totalComplains = await Complaints.countDocuments();
        const totalParkingTaken = await NewMember.countDocuments({
            $or: [
                { two_wheeler: { $exists: true, $ne: "" } },
                { four_wheeler: { $exists: true, $ne: "" } }
            ]
        });

        res.render("admin/dashboard.ejs", { totalResidents, totalComplains, totalParkingTaken });
    } catch (err) {
        console.log("Error in /admin/dashboard route:", err);
        res.status(500).send("Internal Server Error");
    }
});

/* RESIDENT */
// simple admin page RESIDENTS page route
router.get("/residents", async (req, res) => {
    const allMemberDetails = await NewMember.find({});
    res.render("admin/residents", { allMemberDetails });
})

// this is for add new resident btn 
router.get("/addNewResident", isAdminLoggedIn, (req, res) => {
    res.render("forms/addResident")
})


//this route add mew member take there details and post them in database
router.post("/addNewResident", async (req, res) => {
    try {
        const {
            first_name, last_name, email,
            mobile_number, number_of_member, birth_date,
            emergency_number, name_of_each_member,
            block, floor_number, flat_number,
            four_wheeler, two_wheeler, create_password
        } = req.body;

        const newResident = new NewMember({
            first_name,
            last_name,
            email,
            mobile_number,
            number_of_member,
            birth_date,
            emergency_number,
            name_of_each_member,
            block,
            floor_number,
            flat_number,
            four_wheeler,
            two_wheeler,
            role: "resident"
        });

        // hash and save password
        await NewMember.register(newResident, create_password); // <- this is what hashes and salts the password

        res.redirect("/admin/residents")
    } catch (error) {
        console.error(error);
        res.send("❌ Error adding resident");
    }
});


// EDIT - this edit ICON redirect to the edit form page
router.get("/residents/:id/edit", isAdminLoggedIn, async (req, res) => {
    const residentDetails = await NewMember.findById(req.params.id);
    res.render("forms/editResident", { residentDetails })
})



//EDIT - This page edit the existing residents details(DATA)
router.put("/residents/:id", async (req, res) => {
    const id = req.params.id;
    const updatedDetails = req.body;
    //this line do that it take multiple user name in single line by coma seprated and store in array form
    updatedDetails.name_of_each_member = updatedDetails.name_of_each_member.split(",").map(name => name.trim());
    await NewMember.findByIdAndUpdate(id, updatedDetails, { new: true });
    res.redirect("/admin/residents");
});

//DELETE - this route use to delete perticular one resident from table
router.delete("/residents/:id", isAdminLoggedIn, async (req, res) => {
    const id = req.params.id;
    await NewMember.findByIdAndDelete(id);
    res.redirect("/admin/residents");
})


/* PAYMENTS */
//render to payment page in admin page
router.get("/payments", async (req, res) => {
    const billDetails = await ResidentBill.find({}).populate("resident", "first_name last_name block flat_number ")

        .populate("billTemplate", "title amount dueDate ")
    res.render("admin/payments", { billDetails });
})


//render to create bill page
router.get("/createBill", isAdminLoggedIn, (req, res) => {
    res.render("forms/createBill");
});

//save created bill data in database
router.post("/createBill", isAdminLoggedIn, async (req, res) => {
    try {
        const { title, type, amount, penalty, dueDate } = req.body;

        if (!req.session.admin || !req.session.admin.id) {
            return res.status(401).send("Unauthorized: Admin not logged in");
        }

        const newBillTemplate = new AdminBillTemplate({
            title,
            type,
            amount,
            penalty,
            dueDate: new Date(dueDate),
            createdBy: req.session.admin.id
        });

        await newBillTemplate.save();

        const residents = await NewMember.find();
        const residentBills = residents.map(resident => ({
            resident: resident._id,
            billTemplate: newBillTemplate._id,
            amount,
            dueDate: new Date(dueDate),
            penaltyPerDay: penalty,
            isPaid: false
        }));

        await ResidentBill.insertMany(residentBills);

        console.log("Bill created successfully!");
        res.redirect("/admin/payments");
    } catch (err) {
        console.error("Error creating bill:", err);
        console.error("Failed to create bill");
        res.redirect("/admin/createBill");
    }
});


// GET: Render created bill list for admin
router.get("/bill-list", isAdminLoggedIn, async (req, res) => {
    try {
        // Verify admin session
        if (!req.session.admin?.id) {
            req.flash('error', 'Session expired. Please login again');
            return res.redirect('/admin-login');
        }

        const bills = await AdminBillTemplate.find({
            createdBy: req.session.admin.id
        })
            .sort({ dueDate: 1 })
            .lean(); // Convert to plain JS objects for EJS

        // Calculate bill statuses for the view
        const billsWithStatus = bills.map(bill => ({
            ...bill,
            isOverdue: new Date(bill.dueDate) < new Date(),
            formattedDate: bill.dueDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        }));

        res.render("forms/billList", {
            bills: billsWithStatus,
            success: req.flash('success'),
            error: req.flash('error')
        });

    } catch (err) {
        console.error("Error fetching bills:", err);
        req.flash('error', 'Failed to load bills. Please try again.');
        res.redirect('/admin/dashboard');
    }
});

// GET: Render bill edit form
router.get("/bills/:id/edit", isAdminLoggedIn, async (req, res) => {
    try {
        // Verify ownership before allowing edit
        const bill = await AdminBillTemplate.findOne({
            _id: req.params.id,
            createdBy: req.session.admin.id
        });

        if (!bill) {
            req.flash('error', 'Bill not found or unauthorized access');
            return res.redirect("/admin/bill-list");
        }

        // Format date for date input field (YYYY-MM-DD)
        const formattedDate = bill.dueDate.toISOString().split('T')[0];

        res.render("forms/editBill", {
            bill: {
                ...bill._doc,
                formattedDate
            },
            success: req.flash('success'),
            error: req.flash('error')
        });

    } catch (err) {
        console.error("Error fetching bill:", err);
        req.flash('error', 'Failed to load bill for editing');
        res.redirect("/admin/bill-list");
    }
});

// PUT: Update bill created bills
router.put("/bills/:id", isAdminLoggedIn, async (req, res) => {
  try {
    // Verify ownership before update
    const existingBill = await AdminBillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.session.admin.id
    });

    if (!existingBill) {
      req.flash('error', 'Bill not found or unauthorized access');
      return res.redirect("/admin-bill-list");
    }

    const { title, type, amount, penalty, dueDate } = req.body;

    // Update template
    await AdminBillTemplate.findByIdAndUpdate(req.params.id, {
      title,
      type,
      amount,
      penalty,
      dueDate: new Date(dueDate)
    }, { new: true });

    // Update all resident bills
    await ResidentBill.updateMany(
      { billTemplate: req.params.id },
      {
        amount,
        dueDate: new Date(dueDate),
        penaltyPerDay: penalty
      }
    );

    req.flash('success', 'Bill updated successfully!');
    res.redirect("/admin/bill-list");

  } catch (err) {
    console.error("Error updating bill:", err);
    req.flash('error', 'Failed to update bill. Please try again.');
    res.redirect(`/admin/bills/${req.params.id}/edit`);
  }
});


// DELETE: delete created bills bill
router.delete("/bills/:id", isAdminLoggedIn, async (req, res) => {
  try {
    // Verify ownership before deletion
    const bill = await AdminBillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.session.admin.id
    });

    if (!bill) {
      req.flash('error', 'Bill not found or unauthorized access');
      return res.redirect("/admin/bill-list");
    }

    await AdminBillTemplate.findByIdAndDelete(req.params.id);
    await ResidentBill.deleteMany({ billTemplate: req.params.id });

    req.flash('success', 'Bill deleted successfully!');
    res.redirect("/admin/bill-list");

  } catch (err) {
    console.error("Error deleting bill:", err);
    req.flash('error', 'Failed to delete bill. Please try again.');
    res.redirect("/admin/bill-list");
  }
});

//this route use to mark as paid when admin click on "Mark Paid" text
router.get("/payments/mark/:id", async (req, res) => {
    let id = req.params.id;
    await ResidentBill.findByIdAndUpdate(id, {
        isPaid: true,
        paidAt: new Date()
    })
    res.redirect("/admin/payments");
})


/* PARKING */
//this route is render to parking page
router.get("/parking", async (req, res) => {
  const allParkingDetails = await NewMember.find()
  const twoWheeler = await NewMember.countDocuments({ two_wheeler: { $exists: true, $ne: "" } });
  const fourWheeler = await NewMember.countDocuments({ four_wheeler: { $exists: true, $ne: "" } });
  const society = await SocitySetUp.findOne({}, "total_four_wheeler_slot total_two_wheeler_slot");
  res.render("admin/parking", { allParkingDetails, society, twoWheeler, fourWheeler });
})


/* EMPLOYEE */
//this route is render to Employee page
router.get("/employees", async (req, res) => {
  const allEmployeeDetails = await Employees.find();
  const totalEmployees = await Employees.countDocuments();
  const totalActiveEmployees = await Employees.countDocuments({ status: "Active" });
  const totalSalary = await Employees.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: "$salary" }
      }
    }
  ]);
  const totalSalaryAmount = totalSalary[0] ? totalSalary[0].total : 0;

  res.render("admin/employees", { allEmployeeDetails, totalEmployees, totalActiveEmployees, totalSalaryAmount });
})

// This is for add new employee BTN
router.get("/addNewEmployee", isAdminLoggedIn, (req, res) => {
  res.render("forms/newEmployee")
})

//post new employee data to database
router.post("/addNewEmployee", async (req, res) => {
  const newEmployee = new Employees(req.body)
  await newEmployee.save();
  res.redirect("/admin/employees")
})

//this route is use to render employee edit page
router.get("/employees/:id/edit", isAdminLoggedIn, async (req, res) => {
  const employee = await Employees.findById(req.params.id);
  res.render("forms/employeeManage", { employee });
})

//EDIT- This route is use to edit the existing data of employee
router.put("/employees/:id", async (req, res) => {
  const id = req.params.id;
  await Employees.findByIdAndUpdate(id, req.body);
  res.redirect("/admin/employees");
})

//DELETE- use to delete the employee
router.delete("/employees/:id", async (req, res) => {
  const id = req.params.id;
  const temp = await Employees.findByIdAndDelete(id)
  console.log(temp);
  res.redirect("/admin/employees");
})


/* FLAT LIST */

//this route render to flat list page
router.get("/flatList", async (req, res) => {
  const blockList = await SocitySetUp.find();
  const totalNumberFlats = await NewMember.countDocuments();
  res.render("admin/flatList", { blockList, totalNumberFlats });
})

// When we click any block box than table show
router.get("/flatList/:blockName", isAdminLoggedIn, async (req, res) => {
  const blockName = req.params.blockName
  const members = await NewMember.find({ block: blockName });
  res.render("forms/flatListBlock", { blockName, members })
})

// this route is use to generate PDF for any perticular block members
router.get('/download-pdf', async (req, res) => {
  try {
    const blockName = req.query.block;

    if (!blockName) {
      return res.status(400).send('Block parameter is required');
    }

    const members = await NewMember.find({ block: blockName })
      .sort({ flat_number: 1 });

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Set PDF filename with block name
    res.setHeader('Content-disposition', `attachment; filename="block-${blockName}-residents.pdf"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Title with block name (black text)
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#000000') // Pure black
      .text(`Block ${blockName} Resident List`, { align: 'center' })
      .moveDown(0.5);

    // Generation info (gray text)
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#555555') // Dark gray
      .text(`Generated on ${new Date().toLocaleDateString()} • ${members.length} residents`,
        { align: 'center' })
      .moveDown(1.5);

    // Table setup
    const tableTop = 150;
    const rowHeight = 25;
    const colWidths = [100, 250, 150]; // House No, Owner Name, Contact
    const tableLeft = (doc.page.width - colWidths.reduce((a, b) => a + b, 0)) / 2;

    // Draw table header (black background with white text)
    doc.rect(tableLeft, tableTop - 25, colWidths.reduce((a, b) => a + b, 0), 25)
      .fill('#000000'); // Black header

    // Header text (white)
    doc.font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#ffffff') // White text
      .text('House No.', tableLeft + 10, tableTop - 20)
      .text('Owner Name', tableLeft + colWidths[0] + 10, tableTop - 20)
      .text('Contact', tableLeft + colWidths[0] + colWidths[1] + 10, tableTop - 20);

    // Table rows (black text on white/gray alternating background)
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#000000'); // Black text

    members.forEach((member, i) => {
      const y = tableTop + (i * rowHeight);

      // Alternate row background (white and light gray)
      if (i % 2 === 0) {
        doc.fillColor('#ffffff') // White
          .rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
          .fill();
      } else {
        doc.fillColor('#f0f0f0') // Light gray
          .rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
          .fill();
      }

      // Reset to black text after filling background
      doc.fillColor('#000000');

      // Row content
      doc.text(`${blockName}-${member.flat_number}`, tableLeft + 10, y + 8)
        .text(`${member.first_name} ${member.last_name}`, tableLeft + colWidths[0] + 10, y + 8)
        .text(member.mobile_number, tableLeft + colWidths[0] + colWidths[1] + 10, y + 8);

      // Horizontal line between rows (light gray)
      doc.strokeColor('#e0e0e0') // Light gray line
        .moveTo(tableLeft, y + rowHeight)
        .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y + rowHeight)
        .stroke();
    });

    // Vertical borders (gray)
    doc.strokeColor('#d0d0d0') // Medium gray
      .lineWidth(0.5)
      .moveTo(tableLeft + colWidths[0], tableTop - 25)
      .lineTo(tableLeft + colWidths[0], tableTop + (members.length * rowHeight))
      .stroke()
      .moveTo(tableLeft + colWidths[0] + colWidths[1], tableTop - 25)
      .lineTo(tableLeft + colWidths[0] + colWidths[1], tableTop + (members.length * rowHeight))
      .stroke();

    // Outer border (black)
    doc.strokeColor('#000000') // Black border
      .lineWidth(1)
      .rect(tableLeft, tableTop - 25, colWidths.reduce((a, b) => a + b, 0),
        tableTop + (members.length * rowHeight) - (tableTop - 25))
      .stroke();

    // Footer (gray text)
    doc.fontSize(9)
      .fillColor('#777777') // Medium gray
      .text('© Your Society Management System', 50, doc.page.height - 50,
        { align: 'left', width: doc.page.width - 100 })
      .text(`Page 1 of 1`, 50, doc.page.height - 50,
        { align: 'right', width: doc.page.width - 100 });

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).send('Error generating PDF');
  }
});


/* COMPLAINTS */
//this routes are use to render complaint page
router.get("/complaints", async (req, res) => {
  const complainsDetails = await Complaints.find().populate("resident", "first_name last_name block flat_number")
  complainsDetails.map(item => item.toJSON())
  res.render("admin/complaints", { complainsDetails });
})

// render to complaint MANAGE page
router.get("/complaints/:id/edit", isAdminLoggedIn, async (req, res) => {
  const complain = await Complaints.findById(req.params.id);
  res.render("forms/complainManage", { complain });
})

// POST the complaint Manage detail from admin page
router.post("/complaints/:id/edit", async (req, res) => {
  const id = req.params.id;
  const data = req.body
  await Complaints.findByIdAndUpdate(id, data)
  res.redirect("/admin/complaints");
})


module.exports = router;
