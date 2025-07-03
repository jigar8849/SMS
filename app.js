const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate")
const NewMember = require('./models/newMember'); //require model that store new member details
const SocitySetUp = require('./models/socitySetUp');  //require model that store society setup details
const Complaints = require("./models/complain");   //require model that store complaint details
const Employees = require("./models/employee");    // require model that store employee details
const session = require('express-session');  // require midleware sessions



// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
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
  res.render("admin/dashboard.ejs", { user: req.session.admin });
})



app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});


app.get("/residents", (req, res) => {
  res.render("admin/residents");
})

app.get("/payments", (req, res) => {
  res.render("admin/payments");
})

app.get("/parking", (req, res) => {
  res.render("admin/parking");
})

app.get("/employees", (req, res) => {
  res.render("admin/employees");
})

app.get("/flatList", (req, res) => {
  res.render("admin/flatList");
})

app.get("/complaints", (req, res) => {
  res.render("admin/complaints");
})




app.get("/resident-dashboard", (req, res) => {
  res.render("resident/dashboard", { user: req.session.addNewMember })
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