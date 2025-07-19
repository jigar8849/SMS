const mongoose = require("mongoose");
const { Schema } = mongoose;
const passportLocalMongoose = require("passport-local-mongoose");


const socitySetUp = new Schema({
    socity_name: {
        type: String,
        required: true
    },
    socity_address: {
        type: String,
        required: true
    },
    role : {
        type : String,
        default : "admin"
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: Number,
        required: true
    },
    total_block: {
        type: Number,
        required: true
    },
    total_floor: {
        type: Number,
        required: true
    },
    total_flat : {
        type : Number,
        required : true
    },
    house_per_level: {
        type: Number,
        required: true
    },
    total_four_wheeler_slot : {
        type : Number,
        required : true
    },
    total_two_wheeler_slot : {
        type : Number,
        required : true
    },
    admin_name: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true
    },
    email: {
        type: String,
        required: true
    }
    // create_password: {
    //     type: String,
    //     required: true
    // },
    // confirm_password: {
    //     type: String,
    //     required: true
    // },
});

socitySetUp.plugin(passportLocalMongoose, { usernameField: "email" });


module.exports = mongoose.model("SocitySetUp", socitySetUp);