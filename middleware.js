const NewMember = require("./models/newMember");
const SocitySetUp = require("./models/socitySetUp");


module.exports.isResidentLoggedIn = (req, res, next) => {
  if (!req.session.addNewMember) {
    req.flash("error", "Please Login first to access the functionality");
    return res.redirect("/resident-login")
  }
  next();
}

module.exports.isAdminLoggedIn = (req, res, next) => {
  if (!req.session.admin) {
    req.flash("error", "Please Login first to access the functionality");
    return res.redirect("/admin-login")
  }
  next();
}


// utils/catchAsync.js
module.exports.catchAsync = fn => {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
};

