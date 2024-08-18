const express = require("express");

const app = express();
app.use(express.static("public"));

app.listen(5173, "127.0.0.1");
