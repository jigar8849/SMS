const mongoose = require("mongoose");
const { Schema } = mongoose;


const newMemberSchema = new Schema({
    owner_name : {
        type : String,
        required : true
    },
    mobile_number : {
        type : Number,
        required : true
    },
    number_of_member : {
        type : Number,
        required : true
    },
    name_of_each_member :{
        type : [String],
        required : true
    },
    block : {
        type : String,
        required : true
    },
    floor_number : {
        type : Number,
        required : true
    },
    flat_number : {
        type : Number,
        required : true
    }
});

module.exports = mongoose.model("NewMember",newMemberSchema);

