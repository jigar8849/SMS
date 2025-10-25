const Complaints = require("../models/complain");

module.exports.dashboard = async (req, res) => {
  // TODO: Implement dashboard logic
  res.send("Dashboard");
};

module.exports.residents = async (req, res) => {
  // TODO: Implement residents logic
  res.send("Residents");
};

module.exports.getResidentsAPI = async (req, res) => {
  // TODO: Implement getResidentsAPI logic
  res.json({ residents: [] });
};

module.exports.addNewResident = async (req, res) => {
  // TODO: Implement addNewResident logic
  res.send("Add New Resident");
};

module.exports.addNewResidentData = async (req, res) => {
  // TODO: Implement addNewResidentData logic
  res.send("Add New Resident Data");
};

module.exports.residentEdit = async (req, res) => {
  // TODO: Implement residentEdit logic
  res.send("Resident Edit");
};

module.exports.residentEditData = async (req, res) => {
  // TODO: Implement residentEditData logic
  res.send("Resident Edit Data");
};

module.exports.residentDelete = async (req, res) => {
  // TODO: Implement residentDelete logic
  res.send("Resident Delete");
};

module.exports.payments = async (req, res) => {
  // TODO: Implement payments logic
  res.send("Payments");
};

module.exports.createBill = async (req, res) => {
  // TODO: Implement createBill logic
  res.send("Create Bill");
};

module.exports.createBillData = async (req, res) => {
  // TODO: Implement createBillData logic
  res.send("Create Bill Data");
};

module.exports.billList = async (req, res) => {
  // TODO: Implement billList logic
  res.send("Bill List");
};

module.exports.billEditForm = async (req, res) => {
  // TODO: Implement billEditForm logic
  res.send("Bill Edit Form");
};

module.exports.billUpdate = async (req, res) => {
  // TODO: Implement billUpdate logic
  res.send("Bill Update");
};

module.exports.billDelete = async (req, res) => {
  // TODO: Implement billDelete logic
  res.send("Bill Delete");
};

module.exports.mark = async (req, res) => {
  // TODO: Implement mark logic
  res.send("Mark Paid");
};

module.exports.parking = async (req, res) => {
  // TODO: Implement parking logic
  res.send("Parking");
};

module.exports.employees = async (req, res) => {
  // TODO: Implement employees logic
  res.send("Employees");
};

module.exports.addNewEmployee = async (req, res) => {
  // TODO: Implement addNewEmployee logic
  res.send("Add New Employee");
};

module.exports.addNewEmployeeData = async (req, res) => {
  // TODO: Implement addNewEmployeeData logic
  res.send("Add New Employee Data");
};

module.exports.editEmpPage = async (req, res) => {
  // TODO: Implement editEmpPage logic
  res.send("Edit Employee Page");
};

module.exports.editEmpData = async (req, res) => {
  // TODO: Implement editEmpData logic
  res.send("Edit Employee Data");
};

module.exports.empDelete = async (req, res) => {
  // TODO: Implement empDelete logic
  res.send("Employee Delete");
};

module.exports.flatList = async (req, res) => {
  // TODO: Implement flatList logic
  res.send("Flat List");
};

module.exports.flatListBlock = async (req, res) => {
  // TODO: Implement flatListBlock logic
  res.send("Flat List Block");
};

module.exports.pdfDownload = async (req, res) => {
  // TODO: Implement pdfDownload logic
  res.send("PDF Download");
};

module.exports.complaints = async (req, res) => {
  const complainsDetails = await Complaints.find().populate("resident", "first_name last_name block flat_number")
  complainsDetails.map(item => item.toJSON())
  res.render("admin/complaints", { complainsDetails });
}

module.exports.getComplaintsAPI = async (req, res) => {
  try {
    const complaints = await Complaints.find()
      .populate("resident", "first_name last_name block flat_number")
      .sort({ created_at: -1 });

    const formattedComplaints = complaints.map(complaint => ({
      id: complaint._id,
      title: complaint.title,
      description: complaint.description,
      resident: complaint.resident ? `${complaint.resident.first_name} ${complaint.resident.last_name}` : "Unknown",
      flat: complaint.resident ? `${complaint.resident.block}-${complaint.resident.flat_number}` : "N/A",
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status === "Complete" ? "Resolved" :
              complaint.status === "Reject" ? "Rejected" :
              complaint.status === "InProgress" ? "In-Progress" :
              complaint.status === "On-hold" ? "Pending" : complaint.status,
      date: complaint.created_at.toISOString().split('T')[0], // YYYY-MM-DD
      attachments: complaint.Attachments ? 1 : 0
    }));

    res.status(200).json({ success: true, complaints: formattedComplaints });
  } catch (err) {
    console.error("🔴 Error in getComplaintsAPI:", err);
    res.status(500).json({ success: false, message: "Failed to fetch complaints." });
  }
};

module.exports.complaintEditPage = async (req, res) => {
  // TODO: Implement complaintEditPage logic
  res.send("Complaint Edit Page");
};

module.exports.complaintsData = async (req, res) => {
  // TODO: Implement complaintsData logic
  res.send("Complaints Data");
};
