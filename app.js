require('dotenv').config();
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
const AdminBillTemplate = require("./models/adminBill"); //admin can create bill and store data in this
const ResidentBill = require("./models/residentBill");  // Resident pay bill that can created by admin
const Razorpay = require('razorpay');
const crypto = require("crypto");
// const bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const adminRoutes = require("./routes/admin");
const residentsRoutes = require("./routes/residents");


const session = require('express-session');  // require midleware sessions
const RedisStore = require('connect-redis').default // use to store sessions
const { createClient } = require('redis');   // use to store sessions
const { isResidentLoggedIn, isAdminLoggedIn, catchAsync } = require("./middleware");
const flash = require('connect-flash');
const PDFDocument = require('pdfkit');
const router = require('./routes/admin');
require('pdfkit-table');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


// Middleware to parse JSON requests
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static('public'));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"))
app.use(express.json());

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());


app.use((req, res, next) => {
  res.locals.user = req.session.addNewMember || req.session.admin || null;
  next();
});

// flash massages
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use("/admin", adminRoutes);
app.use("/resident", residentsRoutes);

// Connect to MongoDB
main().catch(err => console.log("MongoDB Connection Error:", err));

async function main() {
await mongoose.connect("mongodb://127.0.0.1:27017/SMS");
  console.log("MongoDB Connected");
}

app.get("/", (req, res) => {
  res.render("home");
});






app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});




//Pay Now btn press kharavathi paid thay se
// NEW: Creates Razorpay order and redirects to checkout
app.post("/pay-bill/:id", isResidentLoggedIn, async (req, res) => {
  const billId = req.params.id;
  const residentId = req.session.addNewMember.id;

  const bill = await ResidentBill.findOne({ _id: billId, resident: residentId });

  if (!bill) return res.status(404).send("Bill not found");
  if (bill.isPaid) return res.status(400).send("Bill already paid");

  // Create a Razorpay order
  const options = {
    amount: bill.amount * 100, // in paise
    currency: "INR",
    receipt: `receipt_bill_${billId}`,
  };

  try {
    const order = await instance.orders.create(options);

    // Save Razorpay order ID for verification
    bill.razorpayOrderId = order.id;
    bill.isPaid = true
    await bill.save();

    // Redirect to a payment page (or render a view with Razorpay checkout script)
    res.render("forms/payPage", {
      bill,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: bill.amount * 100
    });

  } catch (err) {
    console.error("Razorpay order creation failed", err);
    res.status(500).send("Failed to initiate payment");
  }
});

//razorpay payment success
app.post("/verify-payment", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      billId // custom hidden field sent from frontend
    } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Signature is valid => mark bill as paid
      await ResidentBill.findByIdAndUpdate(billId, {
        isPaid: true,
        paidAt: new Date()
      });

      return res.send("✅ Payment verified and bill marked as paid");
    } else {
      return res.status(400).send("❌ Payment verification failed");
    }
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).send("Server error");
  }
});





// This route render to ADMIN panel dashboard quick access side that open and give permission to "Approved", "Rejected","Pending"
app.get("/approveEvent", async (req, res) => {
  const eventDetails = await Event.find().populate("createdBy", "first_name last_name block flat_number")
  res.render("forms/eventApprove", { eventDetails })
})

// update the status to APPROVED
app.post("/approveEvent/:id/approve", async (req, res) => {
  await Event.findByIdAndUpdate(req.params.id, { status: "Approved" });
  res.redirect("/approveEvent");
})

// update the status to REJECTED
app.post("/approveEvent/:id/reject", catchAsync(async (req, res) => {
  await Event.findByIdAndUpdate(req.params.id, { status: "Rejected" })
  res.redirect("/approveEvent");
}))


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

app.get("/create-account", (req, res) => {
  res.render("admin/createAccount");
})

app.get("/admin-login", (req, res) => {
  res.render("login/admin");
})

app.post("/admin-login", async (req, res) => {
  const { email, create_password } = req.body;

  try {
    const admin = await SocitySetUp.findOne({ email });

    // ❌ Not an admin
    if (!admin || admin.role !== "admin") {
      req.flash("error", "Access denied. Admins only.");
      return res.redirect("/admin-login");
    }

    // ✅ Try to authenticate
    const authenticatedAdmin = await new Promise((resolve, reject) => {
      SocitySetUp.authenticate()(email, create_password, (err, user, options) => {
        if (err || !user) return reject("❌ Incorrect email or password");
        resolve(user);
      });
    });

    // ✅ Save to session
    req.session.admin = {
      id: authenticatedAdmin._id,
      email: authenticatedAdmin.email,
      role: authenticatedAdmin.role
    };

        req.flash("success", "✅ Logged in successfully!");
    res.redirect("/admin/dashboard");
  } catch (err) {
    req.flash("error", typeof err === "string" ? err : "❌ Login failed");
    res.redirect("/admin-login");
  }
});



app.get("/resident-login", (req, res) => {
  res.render("login/resident");
})

app.post("/resident-login", async (req, res) => {
  const { email, create_password } = req.body;

  try {
    const resident = await NewMember.findOne({ email });

    if (!resident) {
      req.flash("error", "❌ Resident not found with that email.");
      return res.redirect("/resident-login");
    }

    if (resident.role !== "resident") {
      req.flash("error", "❌ Access denied. This account is not a resident.");
      return res.redirect("/resident-login");
    }

    const authenticatedResident = await new Promise((resolve, reject) => {
      NewMember.authenticate()(email, create_password, (err, user, options) => {
        if (err || !user) return reject("❌ Incorrect email or password");
        resolve(user);
      });
    });

    req.session.addNewMember = {
      id: authenticatedResident._id,
      email: authenticatedResident.email,
      role: authenticatedResident.role
    };

    req.flash("success", "✅ Logged in successfully!");
    res.redirect("/resident/dashboard");

  } catch (err) {
    req.flash("error", typeof err === "string" ? err : "❌ Login failed. Please try again.");
    res.redirect("/resident-login");
  }
});


app.post("/create-account", async (req, res) => {
  const { password, confirm_password, ...otherFields } = req.body;

  if (password !== confirm_password) {
    return res.send("❌ Passwords do not match");
  }

  try {
    const newAdmin = new SocitySetUp(otherFields); // create admin without password
    await SocitySetUp.register(newAdmin, password); // hashes and saves password
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("❌ Error while creating account:", err);
    res.send("❌ Failed to create society account. Maybe email is already taken?");
  }
});

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
