

"use strict"; 
var compression = require('compression');
var express = require('express');
var socket_io    = require( "socket.io" );

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var LinkedList = require('linkedlist');

var routes = require('./routes/index');

var app = express();

// Socket.io
var io           = socket_io();
app.io           = io;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



// global path variable
var path = require('path');
global.appRoot = path.resolve(__dirname);

var markers_dict = {};
var sendBuffer = [];
var timeseriece = [];
var activeBikes = {};
var ts = new LinkedList();

function cacheDataPoint(json){
  if (json && json['rmc_latitude'] && isNotTooOld(json) && isMoreRecent(json)){

    if (typeof(json['custom_perc_compl']) != 'undefined') {
      json.perc_compl = Math.round(json['custom_perc_compl']*10)/10;
    }

    //json.speed = parseFloat(parseFloat(json['rmc_speed']).toFixed(1));
	//json.power = parseInt(getValueWithDefault(json,'custom_power', '0'));
	//json.cadence = parseInt(getValueWithDefault(json,'custom_cadence', '0'));
	//json.hr = parseInt(getValueWithDefault(json,'custom_heart_rate', '0'));
	
	//Changes made for new message format - added speed (formaula added to calculate power), power & cadence
	
	
	var speed = ((json['speed_wheel_rpm'] * 2.11115 * 60)/1000).toFixed(2);
	
	console.log(speed);
	
	
	
	//json.speed = parseInt(json['speed_wheel_rpm']);
	json.speed = speed;
	json.power = parseInt(json['power_power_watts']);
	json.cadence = parseInt(json['cadence_pedal_rpm']);
	json.hr = parseInt(json['heart_rate_bpm']);
	
	
    json.rank = parseInt(getValueWithDefault(json,'custom_rank', '0'));
    json.elev = parseFloat(json['gga_antenna_altitude_geoid']);
    json.distGap = parseFloat(getValueWithDefault(json,'custom_dist_first_fm','0'));
    json.fromStart = parseFloat(parseFloat(getValueWithDefault(json,'custom_dist_start_km', '0')).toFixed(1));
    json.lat = parseFloat(convertCoord(json['rmc_latitude'], json['rmc_northings'], 2));
    json.lon = parseFloat(convertCoord(json['rmc_longitude'], json['rmc_eastings'], 3));
    json.ttf = getValueWithDefault(json,'custom_time_to_first', '0');
    
    
    //json.hr = parseInt(getValueWithDefault(json,'custom_heart_rate', '0'));
	//json.hr = parseInt(json['hr']);
	
    json.ei = parseInt(getValueWithDefault(json,'ei', '0'));
    var date_now = Date.now();
    //markers_dict[json['bike_id']] = json;
    // console.log(json);
    ts.push({"json": json, "timestamp": date_now});
    //markers_dict = getMarkersDict();
    //console.log(markers_dict)
    activeBikes[json['bike_id']] = date_now;
    cleanActiveBikes(date_now);
    createMarkers(date_now);
   }
}

var delay = 2000;
function createMarkers(date_now) {
  //console.log('Im out');
  while(ts.head['timestamp'] <= date_now - delay){
    //console.log('Im in');
    json = ts.shift()['json'];
    markers_dict[json['bike_id']] = json;
  }
//   console.log('----------------------------');
//   console.log(markers_dict);
//   console.log('----------------------------');
}

function cleanActiveBikes(date_now){
  for (var bikeId in activeBikes) {
    if (activeBikes[bikeId] < date_now - delay)
      delete activeBikes[bikeId];
  }
}
//setInterval(cleanActiveBikes,1000);

// Constracts markers_dict from timeseriece of json
function getMarkersDict(){
  result = {}
  latest_timestamp = {}
  active_bikes = {}
  newTs = []
  var date_now = Date.now();
  for(i = timeseriece.length - 1; i >= 0; i --) {
    json = timeseriece[i];
    bike_id = json['bike_id'];
    timestamp = parseInt(json["nifi_timestamp_utc"]);
    isWithinLatency = date_now - timestamp <= delay
    isActive = active_bikes[bike_id] == 1
    isLatest = latest_timestamp[bike_id] == null || timestamp > latest_timestamp[bike_id]
    if (isWithinLatency){
      active_bikes[bike_id] = 1;
      newTs.push(json);
    }
    else if (isActive && isLatest) {
      result[bike_id] = json;
      newTs.push(json);
    }
  }
  timeseriece = newTs.reverse();
  return result;
}

function getValueWithDefault(json, field, defalt) {
  var val = json[field];
  if (typeof(val) == 'undefined') {
    val = defalt;
  }
  return val;
}

function isMoreRecent(json){
  var curr_json = markers_dict[json['bike_id']];
  return (curr_json == null) || getDate(curr_json) < getDate(json);
}


function getDate(json){
  var date = json["rmc_date"]
  var time = json["rmc_time"]
  var reggie = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).(\d{2})/;
  var dateArray = reggie.exec(date+time);
  var dateObject = new Date(
      (+dateArray[3])+2000,
      (+dateArray[2])-1, // Careful, month starts at 0!
      (+dateArray[1]),
      (+dateArray[4]),
      (+dateArray[5]),
      (+dateArray[6]),
      (+dateArray[7])*10
  );

  return dateObject;
}


function convertCoord(coord, direction, split) {
  var days = coord.substring(0, split);
  var minutes = coord.substring(split, 10);
  return toDD(days, minutes, direction).toFixed(7);
};


function toDD(degrees, minutes, direction) {
  var out = parseInt(degrees) + (parseFloat(minutes) / 60);
  if (direction == "S" || direction == "W") {
    out = out * -1.0;
  }
  return out;
};

var isActive = false;

function fetchData(){

  //RethinkDB
  var r = require('rethinkdbdash')({
    port: process.env.RETHINKDB_PORT,
    host: process.env.RETHINKDB_HOST,
    username: process.env.RETHINKDB_USER,
    password: process.env.RETHINKDB_PASS,
    timeout: 40,
    timeoutError: 20000 // we wait 20 seconds to reconnect to rethinkdb in case of a server reboot
  });

  try{
    isActive = true;
    r.db(process.env.RETHINKDB_DB).table(process.env.RETHINKDB_TABLE)
      .changes()
      .run()
      .then(function(cursor) {
        cursor.each(function(err, result) {
          // add the data to the buffer
          if (err){
            r.getPoolMaster().drain();
            isActive = false;
            console.log(err);
          }
          else {
            isActive = true;
            cacheDataPoint(result['new_val']);
          }
        });
      })
      .error(function(){
        r.getPoolMaster().drain();
        isActive = false;
        console.log("An Error occurred while reading the table");
      });
  }
  catch (conn_err){
    isActive = false;
    r.getPoolMaster().drain();
    console.log("failed to reconnect");
  }
}

// a loop to help reconnect to the data stream in case of disconnection to rethinkdb
setInterval(function() {
  if (!isActive){
    fetchData();
  }
}, 5000);

var msgpack = require("msgpack-lite");

var keep_keys = ["bike_id", "speed", "rank", "distGap", "fromStart", "lat", "lon", "perc_compl", "elev",
                 "ttf", "cadence", "power", "hr", "total_time", "ei"];

function trimJSObject(json){
  var final_json = {};
  for (let key of keep_keys){
    var val = json[key];
    // http://stackoverflow.com/questions/2652319/how-do-you-check-that-a-number-is-nan-in-javascript
    if (!(val === undefined || val === null || val !== val)) {
      final_json[key] = val;
    }
  }
  return final_json;
};
var jsonpack = require('jsonpack/main');

var i = 0;
// send the data from the buffer
function sendData(){
  //track how many data points per second are written
  for (var key in markers_dict) {
    var json = markers_dict[key];
    var final_json = trimJSObject(json);
    sendBuffer.push(final_json);
//      console.log('*****************');
//      console.log(final_json);
//      console.log('*****************');
//     console.log('#################');
//     console.log(activeBikes);
//     console.log('#################');
  }

  if (sendBuffer.length > 0){
    // we pack the buffer in order to improve the bandwidth
    io.emit('gps', {jsonpacked: jsonpack.pack(sendBuffer)});
    io.emit('active', {jsonpacked: jsonpack.pack(activeBikes)});
    sendBuffer = [];
  }
  markers_dict = {};
}
// send the data every 100 millis
var t=setInterval(sendData,1000);

// function from public/assets/js/app.js
var tooOldThresholdSeconds = 120;

function isNotTooOld(json) {
  if ("nifi_timestamp_utc" in json) {
    var nifi_timestamp_utc = parseInt(json["nifi_timestamp_utc"]);
    var date_now = Date.now();
    return ((nifi_timestamp_utc + (tooOldThresholdSeconds * 1000)) > date_now);
  } else return false;
};


module.exports = app;
