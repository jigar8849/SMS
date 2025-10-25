const NewMember = require("./models/newMember");
const SocitySetUp = require("./models/socitySetUp");


module.exports.isResidentLoggedIn = (req, res, next) => {
  if (!req.session.addNewMember) {
    // Check if request expects JSON (API call)
    const wantsJSON =
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.headers["content-type"] === "application/json" ||
      req.xhr;

    if (wantsJSON) {
      return res.status(401).json({ success: false, message: "Unauthorized: Please login first" });
    } else {
      req.flash("error", "Please Login first to access the functionality");
      return res.redirect("/resident-login");
    }
  }
  next();
}

module.exports.isAdminLoggedIn = (req, res, next) => {
  if (!req.session.admin) {
    // Check if request expects JSON (API call)
    const wantsJSON =
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.headers["content-type"] === "application/json" ||
      req.xhr;

    if (wantsJSON) {
      return res.status(401).json({ error: "Unauthorized: Admin login required" });
    } else {
      req.flash("error", "Please Login first to access the functionality");
      return res.redirect("/admin-login");
    }
  }
  next();
}


// utils/catchAsync.js
module.exports.catchAsync = fn => {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
};

