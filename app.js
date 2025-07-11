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
const session = require('express-session');  // require midleware sessions
const { isResidentLoggedIn , isAdminLoggedIn} = require("./middleware");





// Middleware to parse JSON requests
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"))
app.use(express.json());

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() * 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // httpOnly : true,
  }
}))

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
app.get("/residents/:id/edit", async (req, res) => {

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
app.delete("/residents/:id", async (req, res) => {
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

app.get("/complaints", async (req, res) => {
  const complainsDetails = await Complaints.find().populate("resident", "owner_name block flat_number")
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

app.delete("/resident-complaints/:id", async (req, res) => {
  const { id } = req.params;
  await Complaints.findByIdAndDelete(id);
  res.redirect("/resident-complaints")
})


app.get("/resident-bookEvent", (req, res) => {
  res.render("resident/bookEvent")
})


app.get("/resident-ownerList", (req, res) => {
  res.render("resident/ownerList")
})


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