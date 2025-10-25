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

/* ✅ CORS */
const cors = require("cors");

/* ✅ read allowed origin from env (fallback to local Next) */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

/* ✅ trust proxy (useful behind Render/Nginx) */
app.set("trust proxy", 1);

/* ✅ Global CORS (with credentials) */
app.use(cors({
  origin: FRONTEND_ORIGIN,     // your Next.js URL
  credentials: true,           // allow cookies/authorization headers
  methods: ["GET","HEAD","PUT","PATCH","POST","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"]
}));

/* ✅ Handle preflight (Express 5 compatible) */
app.options(/.*/, cors());   // <-- use a RegExp, not a string

/* Razorpay instance */
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
app.use(express.json()); // (left as-is per your request)

/* 🔧 Session cookie for cross-origin (CORS) */
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true"; // set true in production HTTPS
app.use(
  session({
    secret: process.env.SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none",   // required for cross-site
      secure: COOKIE_SECURE // true on HTTPS prod, false on local HTTP
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
  await mongoose.connect("mongodb://127.0.0.1:27017/NextSMS");
  // await mongoose.connect(process.env.MONGO_URL);
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

// app.get("/admin-login", (req, res) => {
//   res.render("login/admin");
// })

app.post("/admin-login", async (req, res) => {
  const wantsJSON =
    (req.headers.accept && req.headers.accept.includes("application/json")) ||
    req.headers["content-type"] === "application/json" ||
    req.xhr;

  try {
    const { email, create_password } = req.body;

    // Basic guard
    if (!email || !create_password) {
      if (wantsJSON) return res.status(400).json({ ok: false, error: "Email and password are required" });
      req.flash("error", "Email and password are required");
      return res.redirect("/admin-login");
    }

    const admin = await SocitySetUp.findOne({ email });

    if (!admin) {
      if (wantsJSON) return res.status(404).json({ ok: false, error: "Admin not found" });
      req.flash("error", "Admin not found");
      return res.redirect("/admin-login");
    }

    if (admin.role !== "admin") {
      if (wantsJSON) return res.status(403).json({ ok: false, error: "Access denied. Admins only." });
      req.flash("error", "Access denied. Admins only.");
      return res.redirect("/admin-login");
    }

    // passport-local-mongoose authenticate using email (usernameField is 'email')
    SocitySetUp.authenticate()(email, create_password, (err, user /*, info */) => {
      if (err || !user) {
        if (wantsJSON) return res.status(401).json({ ok: false, error: "Incorrect email or password" });
        req.flash("error", "Incorrect email or password");
        return res.redirect("/admin-login");
      }

      // Save to session
      req.session.admin = {
        id: user._id,
        email: user.email,
        role: user.role
      };

      if (wantsJSON) {
        return res.status(200).json({ ok: true, message: "Logged in", redirect: "/admin/dashboard" });
      }

      req.flash("success", "✅ Logged in successfully!");
      return res.redirect("/admin/dashboard");
    });
  } catch (err) {
    console.error("❌ Admin login error:", err);
    if (wantsJSON) return res.status(500).json({ ok: false, error: "Internal server error" });
    req.flash("error", "Login failed");
    return res.redirect("/admin-login");
  }
});


// app.get("/resident-login", (req, res) => {
//   res.render("login/resident");
// })

app.post("/resident-login", async (req, res) => {
  const wantsJSON =
    (req.headers.accept && req.headers.accept.includes("application/json")) ||
    req.headers["content-type"] === "application/json" ||
    req.xhr;

  try {
    const { email, create_password } = req.body;

    if (!email || !create_password) {
      if (wantsJSON) return res.status(400).json({ ok: false, error: "Email and password are required" });
      req.flash("error", "Email and password are required");
      return res.redirect("/resident-login");
    }

    const resident = await NewMember.findOne({ email });
    if (!resident) {
      if (wantsJSON) return res.status(404).json({ ok: false, error: "Resident not found" });
      req.flash("error", "Resident not found with that email.");
      return res.redirect("/resident-login");
    }

    if (resident.role !== "resident") {
      if (wantsJSON) return res.status(403).json({ ok: false, error: "Access denied. This account is not a resident." });
      req.flash("error", "Access denied. This account is not a resident.");
      return res.redirect("/resident-login");
    }

    NewMember.authenticate()(email, create_password, (err, user /*, info */) => {
      if (err || !user) {
        if (wantsJSON) return res.status(401).json({ ok: false, error: "Incorrect email or password" });
        req.flash("error", "Incorrect email or password");
        return res.redirect("/resident-login");
      }

      req.session.addNewMember = {
        id: user._id,
        email: user.email,
        role: user.role,
      };

      if (wantsJSON) {
        return res.status(200).json({ ok: true, message: "Logged in", redirect: "/resident/dashboard" });
      }

      req.flash("success", "✅ Logged in successfully!");
      return res.redirect("/resident/dashboard");
    });
  } catch (err) {
    console.error("❌ Resident login error:", err);
    if (wantsJSON) return res.status(500).json({ ok: false, error: "Internal server error" });
    req.flash("error", "Login failed. Please try again.");
    return res.redirect("/resident-login");
  }
});

app.post("/create-account", async (req, res) => {
  try {
    const { password, confirm_password, ...otherFields } = req.body;

    if (!password || !confirm_password) {
      return res.status(400).json({ ok: false, error: "Password and confirm_password are required" });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ ok: false, error: "Passwords do not match" });
    }

    // Optional pre-check for clarity
    const exists = await SocitySetUp.findOne({ email: otherFields.email });
    if (exists) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const draft = new SocitySetUp(otherFields);
    await SocitySetUp.register(draft, password); // hashes & saves
    return res.status(201).json({ ok: true, message: "Account created", id: draft._id });

  } catch (err) {
    if (err && err.name === "UserExistsError") {
      // Thrown by passport-local-mongoose when the username (email) already exists
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }
    console.error("❌ Create-account error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* 🔧 Use PORT var so log matches the actual port */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} (CORS origin: ${FRONTEND_ORIGIN})`);
});

// If route not found
app.use((req, res, next) => {
  // Check if it's an API request
  const isAPI = req.path.startsWith('/resident/api/') || req.path.startsWith('/admin/api/');
  if (isAPI) {
    return res.status(404).json({ success: false, message: 'Endpoint not found' });
  }
  res.status(404).send('404 Not Found');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Check if it's an API request
  const isAPI = req.path.startsWith('/resident/api/') || req.path.startsWith('/admin/api/');
  if (isAPI) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
  res.status(500).send('Something went wrong!');
});
