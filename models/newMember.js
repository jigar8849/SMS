const mongoose = require("mongoose");
const { Schema } = mongoose;
const passportLocalMongoose = require("passport-local-mongoose");


const newMemberSchema = new Schema({
    first_name : {
        type : String,
        required : true
    },
    last_name : {
        type : String,
        required : true
    },
    birth_date : {
        type : Date,
        required : true
    },
    role : {
        type : String,
        default : "resident"
    },
    mobile_number : {
        type : Number,
        required : true
    },
    emergency_number: {
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
    status : {
        type : String,
        enum: ["active", "in-active"],
        default : "active"
    },
    two_wheeler : {
        type : String
    },
    
    four_wheeler : {
        type : String
    },
    flat_number : {
        type : Number,
        required : true
    },
    email : {
        type : String,
        required :true
    },
    // create_password : {
    //     type : String,
    //     required : true
    // },
    createdAt : {
        type : Date,
        default : Date.now()
    },
    society : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'SocitySetUp',
    }
});

newMemberSchema.plugin(passportLocalMongoose, { usernameField: "email" });


module.exports = mongoose.model("NewMember",newMemberSchema);

