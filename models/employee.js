const mongoose = require("mongoose");
const { Schema } = mongoose;

const employeesSchema = new Schema({
    name : {
        type : String,
        required : true
    },
    role : {
        type : String,
        enum : ['Security Guard', 'Housekeeping', 'Electrician', 'Plumber', 'Gardener', 'Manager', 'Other'],
        required : true
    },
    contact : {
        type : Number,
        required : true
    },
    salary : {
        type : Number,
        required : true
    },
    join_date : {
        type : Date,
        required : true
    },
    status : {
        type : String,
        enum : ['Active', 'Inactive'],
        required : true
    },
    location : {
        type : String,
        required : true
    }
});


module.exports = mongoose.model("Employees", employeesSchema);
