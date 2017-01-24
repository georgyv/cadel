new function() {
  $.ajax({ url: '/assets/racePath/rioPath.csv',
    success: function(data) {
      var line = data.split("\n");
      var importEvery = 1;
      var routePoints = [];

      for (var i in line) {
        if (i % importEvery == 0) {
          var row = line[i].split(",")
          var lat = parseFloat(row[0]);
          var lon = parseFloat(row[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            routePoints.push([lon, lat]);
          }
        }
      }

      var routeLine = [{
        "type": "LineString",
        "coordinates": routePoints
      }];

      var routeStyle = {
          "color": "#ff0000",
          "weight": 3,
          "opacity": 0.65
      };

      L.geoJson(routeLine, {
          style: routeStyle
      }).addTo(map);
     }
  });
}();
