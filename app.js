const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const NewMember = require('./models/newMember');

main().
    then(()=>{
        console.log("MongoDB Connected");
    }).
    catch(()=>{
        console.log("Error connecting to MongoDB");
    })

async function main(){
    await mongoose.connect("mongodb://localhost:27017/SMS")
}

const newMbr = new NewMember({
    owner_name: "John Doe",
    mobile_number: 1234567890,
    number_of_member : 4,
    name_of_each_member : ["jigar","jatin","shivam","don"],
    block : "A",
    floor_number : 7,
    flat_number : 703,
});

  await newMbr.save();

app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))


app.get("/", (req, res) => {
    res.render("home"); 
});


app.listen(3000,()=>{
    console.log("server is running on port 3000")
})