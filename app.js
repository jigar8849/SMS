const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate")
const NewMember = require('./models/newMember'); //require model that store new member details
const SocitySetUp = require('./models/socitySetUp');  //require model that store society setup details
const Complaints = require("./models/complain");   //require model that store complaint details
const Employees = require("./models/employee");    // require model that store employee details
const Event = require("./models/event");
const session = require('express-session');  // require midleware sessions
const RedisStore = require('connect-redis').default // use to store sessions
const { createClient } = require('redis');   // use to store sessions
const { isResidentLoggedIn , isAdminLoggedIn, catchAsync} = require("./middleware");

const PDFDocument = require('pdfkit');
require('pdfkit-table');
const fs = require('fs');



// Middleware to parse JSON requests
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"))
app.use(express.json());

app.use(
  session({
    secret: 'your-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.admin || req.session.addNewMember || null;
  next();
});



// Connect to MongoDB
main().catch(err => console.log("MongoDB Connection Error:", err));

async function main() {
  await mongoose.connect("mongodb://localhost:27017/SMS");
  console.log("MongoDB Connected");
}

app.get("/", (req, res) => {
  res.render("home");
});


app.get("/dashboard", async (req, res) => {
  const totalResidents = await SocitySetUp.findOne();
  const totalComplains = await Complaints.countDocuments();
  const totalParkingTaken = await NewMember.countDocuments({
    $or: [
      { two_wheeler: { $exists: true, $ne: "" } },
      { four_wheeler: { $exists: true, $ne: "" } }
    ]
  });
  res.render("admin/dashboard.ejs", { totalResidents, totalComplains, totalParkingTaken });
})



app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});


//simple admin page RESIDENTS page route
app.get("/residents", async (req, res) => {
  const allMemberDetails = await NewMember.find({});
  res.render("admin/residents", { allMemberDetails });
})

// this is for add new resident btn 
app.get("/addNewResident", isAdminLoggedIn,(req, res) => {
  res.render("forms/addResident")
})

//this will add take new resident details and save to database
app.post("/addNewResident", async (req, res) => {
  const newAddedMember = new NewMember(req.body);
  await newAddedMember.save();
  res.redirect("/residents")
})

// edit - this page redirect to the edit form page
app.get("/residents/:id/edit",isAdminLoggedIn, async (req, res) => {

  const residentDetails = await NewMember.findById(req.params.id);
  res.render("forms/editResident", { residentDetails })
})

//EDIT - This page edit the existing residents details
app.put("/residents/:id", async (req, res) => {
  const id = req.params.id;
  const updatedDetails = req.body;
  //this line do that it take multiple user name in single line by coma seprated and store in array form
  updatedDetails.name_of_each_member = updatedDetails.name_of_each_member.split(",").map(name => name.trim());
  await NewMember.findByIdAndUpdate(id, updatedDetails, { new: true });
  res.redirect("/residents");
});


//DELETE - this route use to delete perticular one resident from table
app.delete("/residents/:id",isAdminLoggedIn, async (req, res) => {
  const id = req.params.id;
  await NewMember.findByIdAndDelete(id);
  res.redirect("/residents");
})

app.get("/payments", (req, res) => {
  res.render("admin/payments");
})

app.get("/parking", async (req, res) => {
  const allParkingDetails = await NewMember.find()
  const twoWheeler = await NewMember.countDocuments({ two_wheeler: { $exists: true, $ne: "" } });
  const fourWheeler = await NewMember.countDocuments({ four_wheeler: { $exists: true, $ne: "" } });
  const society = await SocitySetUp.findOne({}, "total_four_wheeler_slot total_two_wheeler_slot");
  res.render("admin/parking", { allParkingDetails, society, twoWheeler, fourWheeler });
})




app.get("/employees", async (req, res) => {
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

app.get("/employees/:id/edit",isAdminLoggedIn, async (req, res) => {
  const employee = await Employees.findById(req.params.id);
  res.render("forms/employeeManage", { employee });
})

app.put("/employees/:id", async (req, res) => {
  const id = req.params.id;
  await Employees.findByIdAndUpdate(id, req.body);
  res.redirect("/employees");
})

app.delete("/employees/:id", async (req, res) => {
  const id = req.params.id;
  const temp = await Employees.findByIdAndDelete(id)
  console.log(temp);
  res.redirect("/employees");
})



app.get("/flatList", async (req, res) => {
  const blockList = await SocitySetUp.find();
  const totalNumberFlats = await NewMember.countDocuments();
  res.render("admin/flatList", { blockList, totalNumberFlats });
})

app.get("/flatList/:blockName",isAdminLoggedIn, async (req, res) => {
  const blockName = req.params.blockName
  const members = await NewMember.find({ block: blockName });
  res.render("forms/flatListBlock", { blockName, members })
})


app.get('/download-pdf', async (req, res) => {
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

app.get("/complaints", async (req, res) => {
  const complainsDetails = await Complaints.find().populate("resident", "first_name last_name block flat_number")
  complainsDetails.map(item => item.toJSON())
  res.render("admin/complaints", { complainsDetails });
})

app.get("/complaints/:id/edit",isAdminLoggedIn, async (req, res) => {
  const complain = await Complaints.findById(req.params.id);
  res.render("forms/complainManage", { complain });
})

app.post("/complaints/:id/edit", async (req, res) => {
  const id = req.params.id;
  const data = req.body
  await Complaints.findByIdAndUpdate(id, data)
  res.redirect("/complaints");
})



app.get("/addNewEmployee",isAdminLoggedIn, (req, res) => {
  res.render("forms/newEmployee")
})


app.post("/addNewEmployee", async (req, res) => {
  const newEmployee = new Employees(req.body)
  await newEmployee.save();
  res.redirect("/employees")
})




//Middleware for resident

// function isResidentLoggedIn(req, res, next) {
//   if (!req.session.addNewMember) {
//     return res.status(401).send("❌ You must be logged in as a resident.");
//   }
//   next();
// }




app.get("/resident-dashboard", async(req, res) => {
  const resName = await NewMember.findOne();
  res.render("resident/dashboard",{resName})
})

app.get("/resident-billsPayment", (req, res) => {
  res.render("resident/billsPayment")
})


app.get("/resident-complaints", async (req, res) => {
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



app.get("/newComplain", isResidentLoggedIn, async (req, res) => {
  res.render("forms/newComplain");
})


app.post("/newComplain", isResidentLoggedIn, async (req, res) => {
  const newComplainData = req.body;
  //Attach the logged-in resident’s ID
  newComplainData.resident = req.session.addNewMember.id;
  const newComplain = new Complaints(newComplainData);
  await newComplain.save();
  res.redirect("/resident-complaints");
});

app.delete("/resident-complaints/:id",isResidentLoggedIn ,async (req, res) => {
  const { id } = req.params;
  await Complaints.findByIdAndDelete(id);
  res.redirect("/resident-complaints")
})


//this page redirect to main EVENT BOOK page
app.get("/resident-bookEvent", async(req, res) => {
  const eventDetails = await Event.find({}).populate("createdBy","first_name last_name")
  res.render("resident/bookEvent",{eventDetails})
})

//this page to Render to EVENT BOOK Form page 
app.get("/resident-bookEvent/book",isResidentLoggedIn,(req,res)=>{
  res.render("forms/eventBook")
})

//This route render to ADMIN panel dashboard quick access side that open and give permission to "Approved", "Rejected","Pending"
app.get("/approveEvent",async(req,res)=>{
  const eventDetails = await Event.find().populate("createdBy","first_name last_name block flat_number")
  res.render("forms/eventApprove",{eventDetails})
})

//update the status to APPROVED
app.post("/approveEvent/:id/approve",async(req,res)=>{
  await Event.findByIdAndUpdate(req.params.id, {status : "Approved"});
  res.redirect("/approveEvent");
})

//update the status to REJECTED
app.post("/approveEvent/:id/reject",catchAsync(async(req,res)=>{
  await Event.findByIdAndUpdate(req.params.id, {status : "Rejected"})
  res.redirect("/approveEvent");
}))

app.get("/resident-bookEvent/:id/edit",async(req,res)=>{
  const id = req.params.id;
  const eventDetails = await Event.findById(id)
  res.render("forms/updateEvent",{eventDetails})
})

app.post("/resident-bookEvent/:id/edit",async(req,res)=>{
  await Event.findByIdAndUpdate(req.params.id, req.body)
  res.redirect("/resident-bookEvent")
})

//DELETE the created event
app.delete("/resident-bookEvent/:id",async(req,res)=>{
  await Event.findByIdAndDelete(req.params.id);
  res.redirect("/resident-bookEvent");
})

//this route use to check the venue is available for any event for perticular date
app.post("/check-availability", async (req, res) => {
  const { venue, date } = req.body;

  if (!venue || !date) {
    return res.status(400).json({ available: false, message: "Missing data" });
  }

  const isBooked = await Event.exists({
    venue: venue,
    date: new Date(date)
  });

  if (isBooked) {
    return res.json({ available: false, message: "Not Available" });
  } else {
    return res.json({ available: true, message: "Available" });
  }
});



app.post("/resident-bookEvent/book",isResidentLoggedIn,async(req,res)=>{
  const data = req.body;
  const newEvent = new Event({
    ...data,
    createdBy: req.session.addNewMember.id //  This links the event to the user!
  });  await newEvent.save()
  res.redirect("/resident-bookEvent")

})


app.get("/resident-ownerList", async(req, res) => {
   const BlockList = await SocitySetUp.find();
  res.render("resident/ownerList",{BlockList})
})

app.get("/resident-ownerList/:blockName", async(req,res)=>{
    const blockName = req.params.blockName
     const members = await NewMember.find({ block: blockName });
  res.render("forms/ownerList",{blockName,members})
})

//generate RESIDENT side owner list PDF
app.get('/resident-download-pdf', async (req, res) => {
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



app.get("/resident-vehicleSearch", async (req, res) => {
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


app.get("/resident-societyStaff", async (req, res) => {
  const staffDetails = await Employees.find();
  res.render("resident/societyStaff", { staffDetails })
})


app.get("/resident-profile", async (req, res) => {
  const profileInfo = await NewMember.findById(req.session.addNewMember.id);
  res.render("resident/profile", { profileInfo });
});


app.get("/resident-profile/:id/edit",isResidentLoggedIn, async (req, res) => {
  const id = req.params.id;
  const profileInfo = await NewMember.findById(id)
  res.render("forms/editProfile", { profileInfo });
})

app.post("/resident-profile/:id/edit", async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  await NewMember.findByIdAndUpdate(id, data);
  res.redirect("/resident-profile")
})


app.get("/addFamilyMember/:id/add",isResidentLoggedIn,async (req, res) => {
  const memberDetailId = await NewMember.findById(req.session.addNewMember.id);
  res.render("forms/addFamilyMember", { memberDetailId });
});

app.post("/addFamilyMember/:id/add", async (req, res) => {
  const id = req.params.id
  const data = req.body;
  await NewMember.findByIdAndUpdate(id, data)
  res.redirect("/resident-profile")
})


// app.get("addFamilyMember/:id/delete",async(req,res)=>{
//   const profileInfo = await NewMember.findById(id)
//   res.redirect("/resident-profile",{profileInfo})
// })

//2
app.get("resident-profile/:id/delete", async (req, res) => {
  const profileInfo = await NewMember.findById(id)
  res.render("resident/profile", { profileInfo })
})

app.delete("resident-profile/:id/delete", async (req, res) => {
  const id = req.params.id
  await NewMember.findByIdAndDelete(id)
})








app.get("/create-account", (req, res) => {
  res.render("admin/createAccount");
})

app.get("/admin-login", (req, res) => {
  res.render("login/admin");
})

app.post("/admin-login", async (req, res) => {
  const { email, create_password } = req.body;

  const admin = await SocitySetUp.findOne({ email })

  if (admin.role !== "admin") {
    return res.setEncoding("❌ Access denied: Not an admin")
  }

  if (admin.create_password !== create_password) {
    return res.send("❌ Incorrect password");
  }

  req.session.admin = {
    id: admin._id,
    email: admin.email,
    role: admin.role
  }
  res.redirect("/dashboard")
})

app.get("/resident-login", (req, res) => {
  res.render("login/resident");
})

app.post("/resident-login", async (req, res) => {
  const { email, create_password } = req.body;

  const addNewMember = await NewMember.findOne({ email });

  if (!addNewMember) {
    res.send("<h1>Admin not fount</h1>")
  }


  if (addNewMember.role !== "resident") {
    return res.send("❌ Access denied: Not an resident")
  }

  if (addNewMember.create_password !== create_password) {
    return res.send("❌ Incorrect password");
  }
  req.session.addNewMember = {
    id: addNewMember._id,
    email: addNewMember.email,
    role: addNewMember.role
  }
  res.redirect("/resident-dashboard")
})

app.post("/create-account", async (req, res) => {
  const newAccount = new SocitySetUp(req.body);
  await newAccount.save();
  res.redirect("/dashboard");
})

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});





// If route not found
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});
