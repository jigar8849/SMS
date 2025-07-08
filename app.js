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


app.get("/testing", (req, res) => {
  res.render("admin/test.ejs");
})


app.get("/dashboard", (req, res) => {
  res.render("admin/dashboard.ejs");
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
app.get("/addNewResident", (req, res) => {
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

app.get("/parking", (req, res) => {
  res.render("admin/parking");
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

app.get("/employees/:id/edit", async (req, res) => {
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

app.get("/flatList/:blockName",async(req,res)=>{
  const blockName = req.params.blockName
  const members = await NewMember.find({block : blockName});
  res.render("forms/flatListBlock",{blockName,members})
})

app.get("/complaints", async(req, res) => {
  const complainsDetails = await Complaints.find().populate("resident","owner_name block flat_number")
  complainsDetails.map(item => item.toJSON())
  res.render("admin/complaints",{complainsDetails});
})

app.get("/complaints/:id/edit",async(req,res)=>{
    const complain = await Complaints.findById(req.params.id);
    res.render("forms/complainManage",{complain});
})

app.post("/complaints/:id/edit", async(req,res)=>{
  const id = req.params.id;
  const data = req.body
  await Complaints.findByIdAndUpdate(id, data)
  res.redirect("/complaints");
})



app.get("/addNewEmployee", (req, res) => {
  res.render("forms/newEmployee")
})


app.post("/addNewEmployee", async (req, res) => {
  const newEmployee = new Employees(req.body)
  await newEmployee.save();
  res.redirect("/employees")
})






app.get("/resident-dashboard", (req, res) => {
  res.render("resident/dashboard")
})

app.get("/resident-billsPayment", (req, res) => {
  res.render("resident/billsPayment")
})


app.get("/resident-complaints", (req, res) => {
  res.render("resident/complaints")
})


app.get("/resident-bookEvent", (req, res) => {
  res.render("resident/bookEvent")
})


app.get("/resident-ownerList", (req, res) => {
  res.render("resident/ownerList")
})


app.get("/resident-vehicleSearch", (req, res) => {
  res.render("resident/vehicleSearch")
})


app.get("/resident-societyStaff", (req, res) => {
  res.render("resident/societyStaff")
})


app.get("/resident-profile", (req, res) => {
  res.render("resident/profile")
})

app.get("/newComplain", (req, res) => {
  res.render("forms/newComplain")
})

app.post("/newComplain", async (req, res) => {
  const newComplainData = req.body;
//Attach the logged-in resident’s ID
  newComplainData.resident = req.session.addNewMember.id;
  const newComplain = new Complaints(newComplainData);
  await newComplain.save();
  res.redirect("/resident-complaints");
});




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