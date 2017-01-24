
var express = require('express');
var router = express.Router();
var jsSHA = require("jssha");

/*
var mongo = require('mongoskin');
var db = mongo.db("mongodb://" + process.env.MONGODB_USERNAME + ":" +process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_VODA + ":27017/streaming", {native_parser:true});

db.bind('rmc');
*/


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: "Real-Time Biking", replay: "none" });
});

/* GET home page. */
router.get('/replay', function(req, res, next) {
  res.render('index', { title: "Real-Time Biking", replay: "inline-block" });
});

var python_hk_scripts = [];

/* GET home page. */
router.get('/hongkong', function(req, res, next) {
  var PythonShell = require('python-shell');
  PythonShell.defaultOptions = { scriptPath: appRoot + '/scripts' };
  var curr_script = PythonShell.run('generate_stream.py', function (err) {
    if (err)
    {
      console.log(err);
    }
    else {
      console.log('finished');
    }
  });
  python_hk_scripts.push(curr_script);
  res.send("script started");
});

var python_rio_scripts = [];

/* GET home page. */
router.get('/rio', function(req, res, next) {
  var PythonShell = require('python-shell');
  PythonShell.defaultOptions = { scriptPath: appRoot + '/scripts' };
  var curr_script = PythonShell.run('generate_stream_rio.py', function (err) {
    if (err)
    {
      console.log(err);
    }
    else {
      console.log('finished');
    }
  });
  python_rio_scripts.push(curr_script);
  res.send("script started");
});

/* POST Stop Python Process */
router.post('/stop', function(req, res) {
  var password = req.body.p;
  var actual = hash(process.env.STOP_PASS);
  if (password === actual) {
    console.log("good password - killing python");
    killPython();
    res.send(true);
  } else {
    res.send(false);
  }
});

function killPython(){
  for (let pythonScript of python_hk_scripts){
    try {
      pythonScript.childProcess.kill();
      console.log("killed hk");
    } catch(e) {
      // Ignore malformed lines.
      console.log("failed to hk rio");
    }
  }
  python_hk_scripts = [];

  for (let pythonScript of python_rio_scripts){
    try {
      pythonScript.childProcess.kill();
      console.log("killed rio");
    } catch(e) {
      // Ignore malformed lines.
      console.log("failed to kill rio");
    }
  }
  python_rio_scripts = [];
}

/* Hash function from client */
function hash(pwd) {
  var shaObj = new jsSHA("SHA-256", "TEXT");
  var coeff = 1000 * 5;
  var date = Date.now();  //or use any other date
  var rounded = Math.round(date / coeff) * coeff;
  shaObj.update(pwd + rounded);
  var hash = shaObj.getHash("HEX");
  return hash;
}

/* GET home page. */
/*router.get('/swiss', function(req, res, next) {
  var PythonShell = require('python-shell');
  PythonShell.defaultOptions = { scriptPath: appRoot + '/scripts' };
  PythonShell.run('generate_stream_swiss.py', function (err) {
    if (err)
    {
      console.log(err);
    }
    else {
      console.log('finished');
    }
  });
  res.send("script started");

});*/

module.exports = router;
