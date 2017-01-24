L.mapbox.accessToken = 'pk.eyJ1Ijoic3RlcGhhbmVtYWFyZWsiLCJhIjoiY2lvbnFxY252MDAwenZta3Zzcnh3em5iMiJ9.LPA9WqiByWidzfRtQBsgBA';
var map = L.mapbox.map('map', 'mapbox.streets').setView([29, -26], 2);

var canvasJSData = zeroTimeData();
var maxDataPoints = 200; //Maximum velocity datapoints to store for canvasJS
var rio = false;
var progressLastUpdated = 0;

// console.log(#{JSON.stringify(replay)});
// document.getElementById("replayDrop").style.display = '#{JSON.stringify(replay)}';

var mobile=false;
if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
  mobile=true;
  $('.panel-body').appendTo('#mobileSidebarBody');
  $('.sidebar-table').appendTo('#mobileSidebarBody');
  $('.sidebar-table').removeClass();
  $('.panel-body').removeClass();
  $('#sidebar').remove();
  $('#leaderboardButton').removeClass();
}

//Tools
function calcMean(array) {
  var sum = 0;
  for (var i in array) {
    sum = sum + array[i];
  }
  return sum/array.length;
}

function zeroTimeData() {
  zeroData = [];
  now = new Date().getTime();
  for (var i = maxDataPoints; i > 0; i--) {
    zeroData.push({x:(now - (10000*i/maxDataPoints).toFixed(1)), y:0});
  }
  return zeroData;
}

//default is autoimatic camera
$("#manualcamera-btn").hide();

//the camera icons actually perform the opposite function as they should be
//displaying the current mode and toggle on the opposite mode
$("#manualcamera-btn").click(function() {

  $("#manualcamera-btn").hide();
  $("#autocamera-btn").show();

  manualCamera=false;
  map.scrollWheelZoom.disable();
  map.dragging.disable();

  // automatic camera
  fitWindow();
  fitWindowTimer = window.setInterval(fitWindow, fitWindowInterval);
  return true;
});

$("#autocamera-btn").click(function() {

  $("#manualcamera-btn").show();
  $("#autocamera-btn").hide();

  // manual camera
  manualCamera=true;
  map.scrollWheelZoom.enable();
  map.dragging.enable();
  clearInterval(fitWindowTimer); // we clear out the interval
  return true;
});

map.scrollWheelZoom.disable();
map.dragging.disable();
var manualCamera=false;

function onPopup() {
  canvasJSData = zeroTimeData();
  createCanvasJS();

  $("#dataGraph").css("display", "block");
  $("#dataGraphII").css("display", "block");
}

// http://stackoverflow.com/questions/22538473/leaflet-center-popup-and-marker-to-the-map
map.on('popupopen', function(e) {
  if (!currentOpenedMarkerBikeId && manualCamera){
    var px = map.project(e.popup._latlng); // find the pixel location on the map where the popup anchor is
    px.y -= e.popup._container.clientHeight/2 // find the height of the popup container, divide by 2, subtract from the Y axis of marker location
    map.panTo(map.unproject(px),{animate: true}); // pan to new center
  }
  var markerID = $('#popupContent').attr('value');

  //select the leaderboard entry and scroll to it
  $('#user_'+markerID).prop('checked',true);

  currentOpenedMarkerBikeId = markerID;

  //TODO ensure that the leaderboard element is in view if not scrolled on the page.
  //this was taken out as when always calling the function it moved focus when clicking on a rider on the leaderboard
  //$('#user_'+markerID).parent().parent().get(0).scrollIntoView();

  onPopup();
});
map.on('popupclose', function(e) {
  resetPopup();
});
function resetPopup() { //Code to run when a popup closes
  currentOpenedMarkerBikeId = -1;
  $('#dataGraph').css("display","none");
  $("#dataGraphII").css("display", "none");
}

// empty dictonary
var markers_dict = {};
// ride_id to lat lng
var markers_map = {};
var set_of_markers = [];
var array_of_markers = [];
var group = L.featureGroup(array_of_markers);

var socket = null;

var dataPointInterval = setInterval(showDataPointCount, 1000);
var dataPointCounter = 0;

// dict of fake users mapped to names
bikeIDtoName = null;
$.ajax({
  dataType: "json",
  url: "/assets/bikeID.json",
  success: function(data) {
    bikeIDtoName = data;
    socket = io();
    socket.on('gps', function(iodata){
      // we read binary data from a buffer and unpack it with msgpack in order to save on bandwidth, at the sacrifice of CPU
      var jsonpacked = iodata.jsonpacked;
      var jsonArray = jsonpack.unpack(jsonpacked);
      for (var i=0; i < jsonArray.length; i++) {
        processStreamData(jsonArray[i]);
      }
    });
  }
});




function updateDict(dict1,dict2){
  if (dict1 == null) return dict2;
  for (var attrname in dict2) { dict1[attrname] = dict2[attrname] };
  return dict1;
}

var movingAverageQ = new Array(5);  //Number in array is moving average number
var lastAdded = 0;

/*function checkLoading() {
  var currentTime = new Date().getTime();
  if (currentTime - lastAdded < 2000) {
    $('#load').css("display", "block");
  } else {
    $('#load').css("display", "none");
    clearInterval(loadingID);
    if( !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
      setInterval(function(){updateTable();}, 500);
    }
  }
}*/

setInterval(function(){updateTable();}, 1100);

  //var loadingID = setInterval(function(){checkLoading();}, 100);

var iceInserted = false;

function processStreamData(json) {
  dataPointCounter++;
  if (json) {
    json.received_utc = Date.now();
    if (!(json['bike_id'] in markers_map)) {
      // get bike properties
      json.name = bikeIDtoName[json['bike_id']] || "Unknown Rider";
      json.color = stringToColour(json.name);

      var rankID = 'notRio';
      if (json['perc_compl']!=null) {
        rankID = 'rank';
      }

      $rowHTML = '<tr class="feature-row" id="' + json['bike_id'] +'" rank='+json['rank']+'><td style="vertical-align: middle;"><input type="radio" name="focusUser" value="user_' + json['bike_id'] + '" class="focusUser" id="user_' + json['bike_id'] + '" /></td><td><span class="'+rankID+'">'+json['rank']+'</span><td> <span class="userName">' + json.name + '</span><br/><span class="timeGap">'+json['ttf']+'</span><span class="distGap">'+ formatDist(json) + '</span></td><td><span class="userColor pullRight" style="background:' + json.color + ';"></span></td></tr>';

      if (rankID === 'rank') {
        $("#velo-list tbody").append($rowHTML);
      } else {
        $($rowHTML).insertAfter('#velo-list tbody')
      }

      var marker = createCircleMarker(json);

      marker.addTo(map);
      set_of_markers[json['bike_id']] = marker;
      markers_map[json['bike_id']] = marker;
      fitWindow();
    }
    markers_map[json['bike_id']].setLatLng(L.latLng(json['lat'],json['lon']));
    markers_dict[json['bike_id']] =  updateDict(markers_dict[json['bike_id']],json);
    json = markers_dict[json['bike_id']];
    /*if (json['bike_id']==currentOpenedMarkerBikeId && json['dist_frm_start'] != null) {
      var currTime = new Date().getTime();
      var deltaTime = currTime - lastTime;
      var deltaDisp = json['dist_frm_start'] - lastValue;
      lastTime = currTime;
      velocity = deltaDisp/deltaTime;
      lastValue = json['dist_frm_start'];
      //console.log(lastValue);
      data.append(currTime, velocity);
    }*/
    var currTime = new Date().getTime();
    if (json['bike_id']==currentOpenedMarkerBikeId && json['speed'] != null) {
      //Moving Average
      movingAverageQ.shift();
      movingAverageQ.push(parseFloat(json['speed']));
      var average = calcMean(movingAverageQ);
      //CanvasJS
      canvasJSData.push({
            x: currTime,
            y: average
          });
        if (canvasJSData.length > maxDataPoints)
        {
          canvasJSData.shift();
        }
      //Popup
      $('placeholder#speed').html(average.toFixed(2));
    };
    if (json['bike_id']==currentOpenedMarkerBikeId) {
      //Non speed popup
      $('placeholder#name').html(json.name + " | " + json.rank + " | " + json.ttf);
      $('placeholder#power').html(json['power']);
      $('placeholder#hr').html(json['hr']);
      $('placeholder#cadence').html(json['cadence']);
      $('placeholder#ei').html(json['ei']);
//       $('placeholder#elev').html(json['elev']);
    }
    //Update Table Fields
    if (json['perc_compl']!=null) {
      if (!rio) {
        showProfile();
        if (!iceInserted){
          $('.titleLogo').append("<img src='/assets/img/iceLogo.png' height='25px'></img>");
          iceInserted = true;
        }
        if (mobile) {
          $('#titleText').html('Rio 2016');
        } else {
          $('#titleText').html('Rio 2016: An EYC3 Virtual Race');
        }
        rio = true;
      }
      updateProgress(json,currentOpenedMarkerBikeId);
    } else {
      rio = false;
    }
  }
}

/*
  The first rider displays the distance from the start of the race and the remaining riders
  show the distance offset from this first rider. If the distance is less than 1km then convert to metres.
*/
function formatDist(json) {
  var distUnits = 'km';
  var distGap = json['distGap'];
  if (json['rank']==1) {
    distGap = json['fromStart'];
  }
  var scale = 1;
  if (distGap < 1) {
    distGap *= 1000;
    distUnits = 'm';
    scale = 0;
  }
  var dist = distGap.toFixed(scale) + '&nbsp;' + distUnits;
  if (json['rank'] != 1 ) {
    dist = '+' + dist;
  }
  return dist;
}

function updateTable() {
  // update the html of the td to match the new rank and distances / time
  // TODO: performance improvement possible when selecting the elements (getElementbyID)
  // https://learn.jquery.com/performance/optimize-selectors/
  // cached find: http://vaughnroyko.com/the-real-scoop-on-jquery-find-performance/
  $("#velo-list tr.feature-row").each(function() {
    $row = $(this);
    var bikeID = $row.attr('id');
    if (markers_dict[bikeID] != undefined) {
      $row.find("span.rank").html(markers_dict[bikeID].rank);
      $row.find("span.timeGap").html(markers_dict[bikeID].ttf);
      $row.find("span.distGap").html(formatDist(markers_dict[bikeID]));
    }
  });
  // TODO: performance improvement possible when selecting the elements (getElementbyID)
  // https://learn.jquery.com/performance/optimize-selectors/
  // cached find: http://vaughnroyko.com/the-real-scoop-on-jquery-find-performance/
  $("span.rank").sortElements(function(a, b){
    if( parseInt($.text([a])) == parseInt($.text([b])) )
      return 0;
    return parseInt($.text([a])) > parseInt($.text([b])) ? 1 : -1;
  }, function(){
    // parentNode.parentNode is the element we want to move
    return this.parentNode.parentNode;
  });
}

// styling function to create a circle marker
function createCircleMarker(json){
  var latlng = [json['lat'],json['lon']];
  // list of options here: http://leafletjs.com/reference.html#path-options
  var rad = 10;
  if (mobile) {
    rad = 5;
  }

  var marker = L.circleMarker(latlng, {
    radius: rad,
    color: "#000000",
    fillColor: json.color,
    fill: true,
    opacity: 0.5,
    fillOpacity: 1
  });


  var popup = L.popup({"autoPan": false, "minWidth": 150}).setContent("<div id='popupContent' value='"+json['bike_id']+"'><div class='popupNameWrapper'><placeholder id='name'>" + json.name + " | " + json.rank + " | " + json.ttf + "</placeholder></div><div class='popupValueContainer'><div class='popupSpeedWrapper'><img src='/assets/img/speed.png' title='Speed' class='popup-label-icon'></img><placeholder id='speed'></placeholder> km/h</div><div class='popupPowerWrapper'><img src='/assets/img/power.png' title='Power' class='popup-label-icon'></img><placeholder id='power'></placeholder> W</div><div class='popupHeartWrapper'><img src='/assets/img/heart.png' title='Heart rate' class='popup-label-icon'></img><placeholder id='hr'></placeholder> bpm</div><div class='popupCadenceWrapper'><img src='/assets/img/cadence.png' title='Cadence' class='popup-label-icon'></img><placeholder id='cadence'></placeholder> rpm</div><div class='popupEiWrapper'><img src='/assets/img/ei.png' title='Effort indicator' class='popup-label-icon'></img><placeholder id='ei'></placeholder></div></div></div>");//"Name: " + bikeIDtoName[json['bike_id']]
  marker.bindPopup(popup);
  return marker;
}

// styling function to create a pin marker
function createPinMarker(json){
  var latlng = [json['lat'],json['lon']];
  // create a new marker because it's the first time we see it
  var marker = L.marker(latlng, {
    icon: L.mapbox.marker.icon({
      'marker-color': json.color
    })
  });
  return marker;
}


// indicator which contains the current bikeID that's opened
var currentOpenedMarkerBikeId = -1;

$('body').on("change", ".focusUser", function() {
  //map.closePopup();
  var userID = $(this).attr("id");
  var length = userID.length;
  var bike_id = userID.slice(5, length);

  if (($(this).prop("checked") == true) && ($(this).attr("id").indexOf('user_') != -1)) {
    markers_map[bike_id].openPopup(); // show a popup
    currentOpenedMarkerBikeId = bike_id; // change the camera to only focus and follow that user
    onPopup();  //Open dataGraph box
    // TODO: display metrics about user in the right panel
  } else if (($(this).prop("checked") == false) && ($(this).attr("id").indexOf('user_') != -1)) {
    // TODO: Close popup of the specific marker markers_map[bike_id].closePopup() doesn't work
  }
  if (mobile) {
    $('#mobileSiderbar').modal('hide');
  }
});

//shows the data point per second
function showDataPointCount() {
  $('.dataPoints').html('<span class="bold">' + dataPointCounter + ' p/s</span>');
  dataPointCounter = 0;
}

$('#hongkong-btn').click(function(){
  $.get(
      "/hongkong",
      {},
      function(data) {
         alert(data);
      }
  );
});


$('#rio-btn').click(function(){
  $.get(
      "/rio",
      {},
      function(data) {
         alert(data);
      }
  );
});

$('#stop-btn').click(function(){
  $('#stopReplayModal').modal('show');
});

$('#showSidebarModal').click(function(){
  $('#mobileSiderbar').modal('show');
})

function hash(pwd) {
  var shaObj = new jsSHA("SHA-256", "TEXT");
  var coeff = 1000 * 5;
  var date = Date.now();  //or use any other date
  var rounded = Math.round(date / coeff) * coeff;
  shaObj.update(pwd + rounded);
  var hash = shaObj.getHash("HEX");
  return hash;
}

$('#pwdSubmit').click(function() {
  $('#stopReplayModal').modal('hide');
  var hashed = hash($('#pwd').val());
  $('#pwd').val('');
  $.post("/stop", "p="+hashed, function(result){
    if (result) {
      alert("Stopped");
    } else {
      alert("Not Stopped - Incorrect Password");
    }
  });
})

$('#pwd').keypress(function (e) {
  if (e.which == 13) {
    $('#pwdSubmit').click();
    return false;    //<---- Add this line
  }
});


function fitWindow() {

  if (currentOpenedMarkerBikeId != -1){
    // fit to one marker
    if (markers_map[currentOpenedMarkerBikeId]) {
      map.panTo(markers_map[currentOpenedMarkerBikeId].getLatLng());
    }
  } else{
    // fit to all markers
    array_of_markers = [];
    for(var key in set_of_markers) {
      if(set_of_markers.hasOwnProperty(key)){
        array_of_markers.push(set_of_markers[key]);
      }
    }
    group = L.featureGroup(array_of_markers);
    if (!jQuery.isEmptyObject(set_of_markers)) map.fitBounds(group.getBounds(), { "padding": [10,10] });
  }
}

// clear out old data
function clearData() {
  for (var key in markers_map) {
    var marker = markers_map[key];
    var json = markers_dict[key];
    // if the data is over a minute old
    if (!isNotTooOld(json)) {
      deleteMarker(key, marker);
    }
  }
}

// default refresh rate of 1 second (1000 milliseconds)
var fitWindowInterval = 1000
var fitWindowTimer = window.setInterval(fitWindow, fitWindowInterval);
// clear out old data every second (remains constant)
var clearDataTimer = window.setInterval(clearData, 1000);



var tooOldThresholdSeconds = 60;

function isNotTooOld(json) {
  if (json["received_utc"]) {
    var received_utc = parseInt(json["received_utc"]);
    var date_now = Date.now();
    return ((received_utc + (tooOldThresholdSeconds * 1000)) > date_now);
  } else {
    return false;
  }

};


function deleteMarker(bike_id, marker) {
  $('#' + bike_id).remove(); // remove user from the list
  delete markers_dict[bike_id];
  delete markers_map[bike_id];
  delete set_of_markers[bike_id];
  map.removeLayer(marker);
  //console.log(bike_id);
  if(parseInt(currentOpenedMarkerBikeId) === bike_id){
    currentOpenedMarkerBikeId = -1; // release the camera to default properties
    resetPopup();
    map.closePopup();
  }
};


// deterministic function that returns a random colour based on a string
function stringToColour(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var colour = '#';
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xFF;
    colour += ('00' + value.toString(16)).substr(-2);
  }
  return colour;
}

//refreshing the leaderboard back to the original state
$('#refresh-leaderboard').click(function(){
  $('#clear-filter').click();

  //scroll to the first rider on the leaderboard
  $('#velo-list tr').first().get(0).scrollIntoView();

  if (currentOpenedMarkerBikeId != -1) {
    $(".focusUser").prop('checked',false);
    currentOpenedMarkerBikeId = -1; // release the camera to default properties
    resetPopup();
    map.closePopup();
  }
});

// Getting the filter working
$('#filter').keyup(function(){
   var searchString = $('#filter').val();

  //show or hide the X on the filter
  $('#clear-filter').css('display', searchString == '' ? 'none' : 'inline');

  $('#velo-list > tbody > tr').each(function() {
     $this = $(this);
     var rowString = $this.find("span.userName").html();
     var rowID = $this.find("input.focusUser").attr('id');
     if ((-1 === rowString.toLowerCase().search(searchString.toLowerCase())) && (-1 === rowID.toLowerCase().search(searchString))) {
       $this.hide();
     } else {
       $this.show();
     }
   });
 });

//X - clearing the filter
$('#clear-filter').click(function(){
   $('#filter').val('');
   $('#filter').keyup();
 });

// Hacking the radio button selection thingy - not entirely sure if this properly selects the user though.
$('#velo-list').on('click', '.feature-row', function(){
  $(this).find('input').prop('checked',true);
  $('.focusUser').trigger('change');
});

//  DataGraph Box JS
$('#titleRight').click(function(){
  $("#dataGraph").css("display", "none");
  $("#dataGraphII").css("display", "none");
});

$(document).ready(function(){
  //createGraph();
  removeProfile();
  $('#load').remove();
});

function removeProfile() {
  $('#progress').css("display", "none");
  $('#map').css("height", "100%");
}

function showProfile() {
  $('#progress').css("display", "block");
  $('#map').css("height", "85%");
}

// Check if Rio is active; if not then close the profile graph
setInterval(function() {
    if (!rio) {
      removeProfile();
    }
}, 60 * 1000);