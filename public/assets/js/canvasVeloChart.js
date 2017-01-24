$(document).ready(function(){
  createCanvasJS();
});

function createCanvasJS () {

		var chart = new CanvasJS.Chart("dataGraphII",{
			height: 100,
      width: 200,
      interactivityEnabled: false,
      animationEnabled: true,
      backgroundColor: "rgba(0,0,0,0.75)",
      data: [{
				type: "line",
        xValueType: "dateTime",
				dataPoints: canvasJSData
			}],
       axisY:{
         title: "km/h",
         titleFontColor: "white",
         lineThickness: 1,
         tickThickness: 1,
         gridThickness: 0,
         interval: 10,
         labelFontSize: 8,
         labelFontColor: "white",
       },
       axisX:{
         lineThickness: 1,
         tickThickness: 1,
         gridThickness: 0,
         labelFontSize: 8,
         labelFontColor: "white",
         intervalType: "minute",
         valueFormatString: "H:m:s",
         interval: 10,
         labelAutoFit: true
       }
		});

		var xVal = 0;
		var yVal = 100;
		var updateInterval = 100;
// 		var dataLength = 200; // number of dataPoints visible at any point

		var updateChart = function () {

			chart.render();

		};

		// generates first set of dataPoints
		updateChart();

		// update chart after specified time.
		setInterval(function(){updateChart()}, updateInterval);

	}