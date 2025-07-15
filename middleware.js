const NewMember = require("./models/newMember");
const SocitySetUp = require("./models/socitySetUp");


module.exports.isResidentLoggedIn = (req, res, next)=>{
  if (!req.session.addNewMember) {
    return res.status(401).send("❌ You must be logged in as a resident.");
  }
  next();
}

module.exports.isAdminLoggedIn = (req,res,next)=>{
    if(!req.session.admin){
        return res.status(401).send("❌ You must be logged in as an admin.");
    }
    next();
}


// utils/catchAsync.js
module.exports.catchAsync = fn => {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
};

