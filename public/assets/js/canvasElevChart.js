var topology = {};
var arrTopology = [];
var oldTop = [];
var bikeProgress = new Array();
var maxY = 0;
var minY = 0;
$.ajax({ url: '/assets/rideTopology/rioElevation.csv',
         success: function(data) {
              var line = data.split("\n");
              var importEvery = 1;
              for (var i in line) {
                if (i % importEvery == 0) {
                  var row = line[i].split(",")
                  row[0] = parseFloat(row[0]);
                  row[1] = parseFloat(row[1]);
                  if (row[1] > maxY) {
                    maxY = row[1];
                  }
                  if (row[1] < minY) {
                    minY = row[1];
                  }
                  //row[2] = null;
                  topology[row[0]] = {
                    x: row[0],
                    y: row[1],
                    label: roundToIncrement(parseFloat(row[2]), 15)
                  }
                }
              }
              if (minY < 0) {
                minY = minY * 1.2;
              }
              maxY = maxY * 1.2;
              // Set a callback to run when the Google Visualization API is loaded.
              oldTop = $.map(topology, function(prop,key){
                return { x: parseFloat(key), y: parseFloat(prop.y), label: prop.label};
              });
              oldTop = oldTop.sort(function(a, b) {
                return a.x - b.x;
              });
              if ( jQuery.isReady ) {
                createElevCanvasJS();
              } else {
                $(document).ready(function(){
                  createElevCanvasJS();
                });
              }
              setInterval(updateChart, 250);
            }
        });

var elevChart = null;
function createElevCanvasJS () {
      elevChart = new CanvasJS.Chart("elevationChart",{
        interactivityEnabled: false,
        animationEnabled: true,
        backgroundColor: "rgba(2,2,2,1)",
        data: [
          {
            type: "area",
            xValueType: "number",
            dataPoints: oldTop,
            color: "#F5BF33",
            fillOpacity: 1,
          },
          {
            type: "scatter",
            xValueType: "number",
            fillOpacity: 1,
            dataPoints: bikeProgress
          }
        ],
         axisY:{
           lineThickness: 1,
           tickThickness: 1,
           gridThickness: 1,
           interval: 100,
           labelFontSize: mobile ? 6 : 8,
           labelFontColor: "#FFFFFF",
           labelFontFamily: "EYReg",
           maximum: maxY,
           minimum: minY,
           title: "Elevation (m)",
           titleFontColor: "#FFFFFF",
         },
         axisX:{
           lineThickness: 1,
           gridThickness: 0,
           labelFontSize: mobile ? 6 : 8,
           labelFontColor: "#FFFFFF",
           //tickLength: 1,
           interval: 6,
           interlacedColor: "#020202",
           title: "Distance (km)",
           titleFontColor: "#FFFFFF",
         }
      });
}

function updateChart() {
  // Clear the chart
  bikeProgress.length = 0;
  // append the $.map array
  if (typeof markers_dict !== 'undefined') {
    bikeProgress.push.apply(bikeProgress, $.map(markers_dict, function(prop,key){
      return { "x": parseFloat(prop.x), "y": prop.y, "markerColor": prop.color, "markerType": prop.markerType};
    }));
  }
  if (typeof elevChart !== 'undefined') {
    elevChart.render();
  }
};

function updateProgress(json, soloID) {
  markers_dict[json['bike_id']].x=json['perc_compl'];
  var closestElev = topology[json["perc_compl"]].y;
  markers_dict[json['bike_id']].y=closestElev;
  if (soloID === json['bike_id']) {
    delete markers_dict['solo'];
    markers_dict['solo'] = {
      color: "white",
      markerType: "cross",
      x: json['perc_compl'],
      y: closestElev + 150
    };
  } else if (soloID === -1) {
    delete markers_dict['solo'];
  }
}

function roundToIncrement(num, increment) {
  var remainder = num % increment;
  if (remainder < (increment / 2)) {
    num -= remainder;
  } else {
    num += (increment - remainder);
  }
  return num.toFixed(0);
}
/*function updateProgress(bikeID, percentDone, soloID, colour) {
  var i = bikeProgress.map(function(x) {return x.id; }).indexOf(bikeID); //Get index of bike
  if (i===-1){ //See if bike exists
    bikeProgress.push({
      id: bikeID,
      markerColor: colour,
    });
    i = bikeProgress.map(function(x) {return x.id; }).indexOf(bikeID);
    //console.log(bikeID);
  }
  //console.log(bikeID);
  bikeProgress[i].x=percentDone;
  bikeProgress[i].y=oldTop[oldTop.map(function(z) {return z.x; }).indexOf(Math.round(percentDone*10)/10)].y;
  var selectedI = bikeProgress.map(function(x) {return x.id; }).indexOf(-1);
  if (soloID === bikeID) {
    if (selectedI != -1){
      bikeProgress.splice(selectedI,1);
    }
    bikeProgress.push({
      id: -1,
      markerColor: colour,
      markerType: "cross",
      x:percentDone,
      y:(bikeProgress[i].y+150)
    });
  } else if (soloID === -1) {
    if (selectedI != -1){
      bikeProgress.splice(selectedI,1);
    }
  }
}*/