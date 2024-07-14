var windowWidth = window.innerWidth;
var windowHeight = window.innerHeight; 

var mapImg = "";
var selectedImg = "";
var urlOfImageFile;

var xPos = 0;
var yPos = 0;
var zoom = 1;

function setup() {
    createCanvas(windowWidth - 50, windowHeight - 70);
}

function draw() {
    drawBackground();
    calculatePan();

    const selectedMapFile = document.getElementById('mapSelect');
    var input = selectedMapFile.value;

    // The user inputted a new file.
    if(input != "" && selectedImg != input){
        selectedImg = input;
        var mapImageFile = selectedMapFile.files[0];
        urlOfMapImageFile = URL.createObjectURL(mapImageFile);
        mapImg = loadImage(urlOfMapImageFile);
    }

    // Check if we have a file and draw it.
    if(mapImg != ""){
        drawMap();
    }
    drawTrailPath();
    drawLengthSection();
    //points.forEach((e) => e.draw());
    drawElevationPoints();
    drawElevationGraph();

  }

  function drawBackground(){

    var backgroundColorInput = document.getElementById('backgroundColor');

    background(backgroundColorInput.value)
  }

  function drawMap(){
    image(mapImg, (0 + xPos)*zoom, (0 + yPos)*zoom, mapImg.width*zoom*.8, mapImg.height*zoom*.8);
  }

  window.onresize = function() {
    // Assigns new values for width and height variables.
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;  
    resizeCanvas(windowWidth - 50, windowHeight - 70);
  }

  document.addEventListener('contextmenu', event => event.preventDefault());

  function keyPressed(){
    if(key == "e"){
        endElevationSelection();
        endTrailPath();
    }
    if(key == "s" && trailDone){
        // If the trail is done a "s" means add an elevation line at the same level. 
        addElevationPoint(1);
    }
    if(key == "Backspace"){
        handleUndo();
    }
  }

  function drawTriangle(x, y, size, upsideDown){
    if(upsideDown){
        // 1.732 = sqrt 3, all these numbers are because math.
        triangle(x, y+(size/1.732), x-(size/2), y-(size/(2*1.732)), x+(size/2), y-(size/(2*1.732)));
    } else {
        triangle(x, y-(size/1.732), x-(size/2), y+(size/(2*1.732)), x+(size/2), y+(size/(2*1.732)));
    }
  }

  ////////////////////////////////////////////////////
  // Zoom/pan
  ////////////////////////////////////////////////////

  function mouseWheel(event) {
    var percentChange = 10;
    if(event.delta > 0){
        zoom = zoom*(1+percentChange/100);
    }else if(event.delta < 0){
        zoom = zoom/(1+percentChange/100);
    }
  }

  var panning = false;
  var originalMouseX = 0;
  var originalMouseY = 0;
  var originalX = xPos;
  var originalY = yPos;
  var mouseX = 0;
  var mouseY = 0;

  document.onmousemove = function(event)
    {
        mouseX = event.pageX;
        mouseY = event.pageY;
    }

  function mousePressed(event) {
    // Middle button check.
    if(event.button == 1){
        panning = true;
        originalMouseX = mouseX;
        originalMouseY = mouseY;
        originalX = xPos;
        originalY = yPos;
    }else if(trailDone && event.button != 1){
        // If the trail is done and it is not a pan action this means we are placing elevation lines and we should do that.
        addElevationPoint(event.button);
    }
  }

  function mouseReleased(event) {
    if(event.button == 1){
        panning = false;
    }
  }

  function calculatePan() {
    if(panning){
        xPos = originalX - ((originalMouseX-mouseX)/zoom);
        yPos = originalY - ((originalMouseY-mouseY)/zoom);
    }
  }


  ////////////////////////////////////////////////////
  // Trail functions
  ////////////////////////////////////////////////////

  class TrailPoint {
    constructor(x, y){
        this.x = x;
        this.y = y;
    }

    draw(){
        strokeWeight(1);
        fill(color(151, 0, 0))
        circle((this.x + xPos)*zoom, (this.y + yPos)*zoom, 10);
    }
  }

  var points = [];
  var trailDone = false;

  function mouseClicked(event) {
    if(!trailDone){
        points.push(new TrailPoint((mouseX/zoom)-xPos, (mouseY/zoom)-yPos));
    }else if(trailDone && elevationDone){
        handleLengthAdd();
    }
  }

  function handleTrailUndo(){
    if(points.length > 0){
        points.pop();
    }
  }

  function drawTrailPath(){
    if(points.length > 0){        
        noFill();
        var lineColorInput = document.getElementById('lineColor');
        stroke(lineColorInput.value);
        strokeWeight(3);
        beginShape();
        // Draw line segments between the points.
        points.forEach((e) => vertex((e.x + xPos)*zoom, (e.y + yPos)*zoom));
        // Add the mouse as a position as well if the trail is not done.
        if(!trailDone){
            vertex(mouseX, mouseY);
        }
        endShape();
    }
  }

  function endTrailPath(){
    trailDone = true;
    if(!elevationDone){
        remainingPathPoints = points;
    }
  }

  class TrailElevationPoint {
    constructor(x, y, elevation, previousPoints){
        this.x = x;
        this.y = y;
        this.elevation = elevation;
        this.previousPoints = previousPoints;
    }
  }

  var currentElevation = 0;
  var elevationPoints = [];
  var elevationDone = false;

  // Mouse button == 0 if it is left click, 1 middle(actually an "s" letter because middle is for panning), 2 left.
  function addElevationPoint(mouseButton){
    if(!trailDone || elevationDone){
        return;
    }
    if(mouseButton == 0){
        // Left click means up.
        currentElevation++;
    }else if(mouseButton == 2){
        // Right click means down.
        currentElevation--;
    }
    // Middle click means stay the same.
    //Now add the elevation point where it should be
    var closestPoint = calculateClosestTrailPoint((mouseX/zoom)-xPos, (mouseY/zoom)-yPos);

    if(elevationPoints.length > 0){
        closestPoint = handleElevationPointOrder(closestPoint);
    }

    elevationPoints.push(new TrailElevationPoint(closestPoint.x, closestPoint.y, currentElevation, closestPoint.previousPoints));
  }

  function handleElevationUndo(){
    if(elevationPoints.length > 0){
        var poppedPoint = elevationPoints.pop();
        if(elevationPoints.length == 1){
            remainingPathPoints = points;
            //reset the first points previous points to the 2 border points.
            if(elevationPoints[0].previousPoints.length == 1){
                var firstPoint = points[0] == elevationPoints[0].previousPoints[0];
                if(firstPoint){
                    elevationPoints[0].previousPoints.push(points[1]);
                }else{
                    elevationPoints[0].previousPoints.push(points[points.length - 2]);
                }
                return;
            }
            var pointLocation = 0;
            var secondPointLocation = 0;
            for(var i = 0; i < points.length; i++){
                if(points[i] == elevationPoints[0].previousPoints[elevationPoints[0].previousPoints.length-1]){
                    pointLocation = i;
                }
                if(points[i] == elevationPoints[0].previousPoints[elevationPoints[0].previousPoints.length-2]){
                    secondPointLocation = i;
                }
            } 
            elevationPoints[0].previousPoints = [points[2*pointLocation - secondPointLocation], points[pointLocation]];
        }else if(elevationPoints.length > 1){
            var newRemainingPoints = poppedPoint.previousPoints;
            for(var i = 0; i < remainingPathPoints.length; i++){
                newRemainingPoints.push(remainingPathPoints[i]);
            }
            remainingPathPoints = newRemainingPoints;
        }   
    }else{
        trailDone = false;
    }

    if(elevationPoints.length > 0){
        currentElevation = elevationPoints[elevationPoints.length-1].elevation;
    }else{
        currentElevation = 0;
    }
  }

  function drawElevationPoints(){
    var triangleSize = 15;
    
    // Plot the mouse circle so the user knows where they will place the line when they click, only if they aren't done.
    if(trailDone && !elevationDone){
        fill(151, 255, 245);
        strokeWeight(0);
        var trailPoint = calculateClosestTrailPoint((mouseX/zoom)-xPos, (mouseY/zoom)-yPos);
        circle((trailPoint.x + xPos) * zoom, (trailPoint.y + yPos) * zoom, triangleSize*.8);
    }
    // Don't plot any points if there aren't any.
    if(elevationPoints.length == 0){
        return;
    }

    // Plot all the points except the last.
    for(var i = 0; i < elevationPoints.length-1; i++){
        if(elevationPoints[i].elevation < elevationPoints[i+1].elevation){
            // The trail is going up so point up.
            fill(color(63, 102, 52));
            strokeWeight(0);
            drawTriangle((elevationPoints[i].x + xPos) * zoom, (elevationPoints[i].y + yPos) * zoom, triangleSize, false);
        }else if(elevationPoints[i].elevation > elevationPoints[i+1].elevation){
            // The trail is going down so point down.
            fill(color(82, 255, 238));
            strokeWeight(0);
            drawTriangle((elevationPoints[i].x + xPos) * zoom, (elevationPoints[i].y + yPos) * zoom, triangleSize, true);
        }else{
            // the trail is the same level.
            fill(49, 180, 119);
            strokeWeight(0);
            circle((elevationPoints[i].x + xPos) * zoom, (elevationPoints[i].y + yPos) * zoom, triangleSize*.8);
        }
    }

    // PLot the last one as a circle because we don't know what it's symbol is yet.
    fill(151, 255, 245);
    strokeWeight(0);
    circle((elevationPoints[elevationPoints.length-1].x + xPos) * zoom, (elevationPoints[elevationPoints.length-1].y + yPos) * zoom, triangleSize*.8);
  }

  function endElevationSelection(){
    if(trailDone){
        elevationDone = true;
        populateElevationGraphPoints();
    }
  }

  /////////
  // Calc closest point
  /////////

  var remainingPathPoints = [];

  function calculateClosestTrailPoint(x, y){
    var closestPoints = [];
    for(var i = 0; i < remainingPathPoints.length - 1; i++){
        var closePoint = calculateClosestPointToSegment(x, y, remainingPathPoints[i], remainingPathPoints[i + 1]);
        closestPoints.push(new TrailElevationPoint(closePoint.x, closePoint.y, 0, [remainingPathPoints[i], remainingPathPoints[i + 1]]))
    }

    var closestIndex = 0;
    for(var i = 1; i < closestPoints.length; i++){
        var closestDistanceSquared = sq(x - closestPoints[closestIndex].x) + sq(y - closestPoints[closestIndex].y);
        var nextDistanceSquared = sq(x - closestPoints[i].x) + sq(y - closestPoints[i].y);
        if(nextDistanceSquared < closestDistanceSquared){
            closestIndex = i;
        }
    }
    return closestPoints[closestIndex];
  }

  function calculateClosestPointToSegment(x, y, start, end){
    var closestPointToLine = calculateClosestPointToLine(x, y, start, end);
    // Check if the point lines between the 2 given points.
    if((closestPointToLine.x >= start.x && closestPointToLine.x <= end.x) || (closestPointToLine.x <= start.x && closestPointToLine.x >= end.x)){
        // Checking the y just to be sure.
        if((closestPointToLine.y >= start.y && closestPointToLine.y <= end.y) || (closestPointToLine.y <= start.y && closestPointToLine.y >= end.y)){
            return closestPointToLine;
        }
    }
    var startDistSquared = sq(x - start.x) + sq(y - start.y);
    var endDistSquared = sq(x - end.x) + sq(y - end.y);
    if(startDistSquared > endDistSquared){
        return end;
    }else{
        return start;
    }
  }

  function calculateClosestPointToLine(x, y, start, end){
    // Zero or infinity slopes edge cases.
    if(start.x == end.x){
        return new TrailPoint(start.x, y);
    }else if(start.y == end.y){
        return new TrailPoint(x, start.y);
    }

    var slopeLine = (start.y - end.y)/(start.x - end.x);
    var perpendicularSlope = -1/slopeLine;
    var closestX = (end.y - (slopeLine*end.x) - y + (perpendicularSlope*x))/(perpendicularSlope-slopeLine)
    var closestY = slopeLine*(closestX - end.x) + end.y;
    return new TrailPoint(closestX, closestY);
  }

  function handleElevationPointOrder(closestPoint){
    if(elevationPoints.length == 1){
        initialTrailTrim(closestPoint);
    }
    var tempRemainingPathPoints = [];
    var borderPoints = closestPoint.previousPoints;
    closestPoint.previousPoints = [];
    var reachedClosestPoint = false;
    for(var i = 0; i < remainingPathPoints.length; i++){
        if(!reachedClosestPoint){
            closestPoint.previousPoints.push(remainingPathPoints[i])
        }else{
            tempRemainingPathPoints.push(remainingPathPoints[i]);
        }
        if((remainingPathPoints[i] == borderPoints[0] || remainingPathPoints[i] == borderPoints[1]) && !reachedClosestPoint){
            reachedClosestPoint = true;
            tempRemainingPathPoints.push(closestPoint);
        }
    }
    remainingPathPoints = tempRemainingPathPoints;
    return closestPoint;
  }

  function initialTrailTrim(closestPoint){
    var firstEleTrailPoint = new TrailPoint(elevationPoints[0].x, elevationPoints[0].y);
    var firstPointIndex = -1;
    var closestPointIndex = -1;
    for(var i = 0; i < remainingPathPoints.length; i++){
        if(firstPointIndex == -1 && (remainingPathPoints[i] == elevationPoints[0].previousPoints[0] || remainingPathPoints[i] == elevationPoints[0].previousPoints[1])){
            firstPointIndex = i;
        }
        if(closestPointIndex == -1 && (remainingPathPoints[i] == closestPoint.previousPoints[0] || remainingPathPoints[i] == closestPoint.previousPoints[1])){
            closestPointIndex = i;
        }
    }
    // Try to find the border point that the next point is on the side of
    var side = closestPointIndex - firstPointIndex;
    if(side == 0){
        var firstDistanceSquared = sq(remainingPathPoints[closestPointIndex].x - elevationPoints[0].x) + sq(remainingPathPoints[closestPointIndex].y - elevationPoints[0].y);
        var closestDistanceSquared = sq(remainingPathPoints[closestPointIndex].x - closestPoint.x) + sq(remainingPathPoints[closestPointIndex].y - closestPoint.y);
        side = closestDistanceSquared - firstDistanceSquared;
        if(side == 0){
            side = -1;
        }
        if(side > 0){
            if(remainingPathPoints[closestPointIndex] == closestPoint.previousPoints[0]){
                closestPoint.previousPoints[0] = firstEleTrailPoint;
            }else{
                closestPoint.previousPoints[1] = firstEleTrailPoint;
            }
        }else{
            if(remainingPathPoints[closestPointIndex] == closestPoint.previousPoints[0]){
                closestPoint.previousPoints[1] = firstEleTrailPoint;
            }else{
                closestPoint.previousPoints[0] = firstEleTrailPoint;
            }
        }
    }
    // Negative side means the 0-x points are the valid points.
    // Positive side means the x-length points are the valid points.
    remainingPathPoints = [];
    remainingPathPoints.push(firstEleTrailPoint);
    elevationPoints[0].previousPoints = [];
    if(side < 0){
        for(var k = points.length-1; k >= 0; k--){
            if(k > firstPointIndex){
                // Update the previous path of the original now that we know the direction.
                elevationPoints[0].previousPoints.push(points[k]);
            }else{
                // Add the other points in the correct order.
                remainingPathPoints.push(points[k]);
            }
        }
    }else{
        for(var k = 0; k < points.length; k++){
            if(k < firstPointIndex + 1){
                elevationPoints[0].previousPoints.push(points[k]);
            }else{
                remainingPathPoints.push(points[k]);
            }
        }
    }
  }

  ///////////////////////
  // Create elevation plot
  ///////////////////////

  var elevationGraphPoints = [];

  function populateElevationGraphPoints(){
    elevationGraphPoints = [];
    populateFirstPoint();
    var currentDistance = 0;
    for(var i = 0; i < elevationPoints.length; i++){
        var lengthToPrevious = calculateLengthToPrevious(elevationPoints[i]);
        currentDistance = currentDistance + lengthToPrevious;
        elevationGraphPoints.push(new TrailPoint(currentDistance, elevationPoints[i].elevation));
    }
    populateLastPoint(currentDistance);
  }

  function populateFirstPoint(){
    if(elevationPoints[0].elevation == 0){
        elevationGraphPoints.push(new TrailPoint(0, 0));
    }
    if(elevationPoints[0].elevation == 1){
        elevationGraphPoints.push(new TrailPoint(0, .5));
    }
    if(elevationPoints[0].elevation == -1){
        elevationGraphPoints.push(new TrailPoint(0, -.5));
    }
  }

  function calculateLengthToPrevious(elePoint){
    var dist = 0;
    for(var i = 0; i < elePoint.previousPoints.length-1; i++){
        dist = dist + sqrt(sq(elePoint.previousPoints[i].x - elePoint.previousPoints[i+1].x) + sq(elePoint.previousPoints[i].y - elePoint.previousPoints[i+1].y));
    }
    dist = dist + sqrt(sq(elePoint.previousPoints[elePoint.previousPoints.length-1].x - elePoint.x) + sq(elePoint.previousPoints[elePoint.previousPoints.length-1].y - elePoint.y));
    return dist;
  }

  function populateLastPoint(currentDistance){
    var finalDistance = currentDistance + calculateRemainingPathLength();

    if(elevationPoints.length < 2){
        elevationGraphPoints.push(new TrailPoint(finalDistance, -0.5));
        return;
    }
    if(elevationPoints[elevationPoints.length-2].elevation == elevationPoints[elevationPoints.length-1].elevation){
        elevationGraphPoints.push(new TrailPoint(finalDistance, elevationPoints[elevationPoints.length-1].elevation));
    }
    if(elevationPoints[elevationPoints.length-2].elevation > elevationPoints[elevationPoints.length-1].elevation){
        elevationGraphPoints.push(new TrailPoint(finalDistance, elevationPoints[elevationPoints.length-1].elevation - 0.5));
    }
    if(elevationPoints[elevationPoints.length-2].elevation < elevationPoints[elevationPoints.length-1].elevation){
        elevationGraphPoints.push(new TrailPoint(finalDistance, elevationPoints[elevationPoints.length-1].elevation + 0.5));
    }
  }

  function calculateRemainingPathLength(){
    var dist = 0;
    for(var i = 0; i < remainingPathPoints.length-1; i++){
        dist = dist + sqrt(sq(remainingPathPoints[i].x - remainingPathPoints[i+1].x) + sq(remainingPathPoints[i].y - remainingPathPoints[i+1].y));
    }
    return dist;
  }

  function drawElevationGraph(){
    var elevationLineHeight = document.getElementById('elevationLineHeight').value/10;
    var graphOffset = document.getElementById('graphHeight').value * -1;
    if(elevationGraphPoints.length > 0){ 
        if(document.getElementById('showElevationLines').checked){
            drawElevationLines();  
            drawLengthLines();
        }
        noFill();
        var lineColorInput = document.getElementById('lineColor');
        stroke(lineColorInput.value);
        strokeWeight(3);
        beginShape();
        // Add the first and last point twice because the spline ignores them.
        curveVertex((elevationGraphPoints[0].x + xPos)*zoom, ((-elevationGraphPoints[0].y*elevationLineHeight) + yPos + graphOffset)*zoom);
        // Draw line segments between the points.
        elevationGraphPoints.forEach((e) => curveVertex((e.x + xPos)*zoom, ((-e.y*elevationLineHeight) + yPos + graphOffset)*zoom));
        // Add the mouse as a position as well if the trail is not done.
        curveVertex((elevationGraphPoints[elevationGraphPoints.length-1].x + xPos)*zoom, ((-elevationGraphPoints[elevationGraphPoints.length-1].y*elevationLineHeight) + yPos + graphOffset)*zoom);
        endShape();

        drawElevationChange()
    }
  }

  function drawElevationLines(){
    var elevationLineHeight = document.getElementById('elevationLineHeight').value/10;
    var graphOffset = document.getElementById('graphHeight').value * -1;
    var width = elevationGraphPoints[elevationGraphPoints.length - 1].x + 50;
    var maxElevation = elevationGraphPoints[0].y;
    elevationGraphPoints.forEach((e) => {
        if(maxElevation < e.y){
            maxElevation = e.y
        }
    });
    var minElevation = elevationGraphPoints[0].y;
    elevationGraphPoints.forEach((e) => {
        if(minElevation > e.y){
            minElevation = e.y
        }
    });
    maxElevation = ceil(maxElevation) + 1;
    minElevation = floor(minElevation) - 1;
    var lineColorInput = document.getElementById('lineColor');
    noFill();
    stroke(lineColorInput.value + "40");
    
    strokeWeight(1);
    for(var i = minElevation; i <= maxElevation; i++){
        beginShape();
        vertex((-25 + xPos)*zoom, ((-i*elevationLineHeight) + yPos + graphOffset)*zoom)
        vertex((width + xPos)*zoom, ((-i*elevationLineHeight) + yPos + graphOffset)*zoom)
        endShape();
    }
  }

  function drawElevationChange(){
    var upDistance = calculateElevationChange(true);
    var downDistance = calculateElevationChange(false);
    var total = upDistance + downDistance;
    var message = upDistance + " Total Uphill Elevation\n" + downDistance + " Total Downhill Elevation\n" + total + " Total Elevation Change(uphill + downhill)";
    var lineColorInput = document.getElementById('lineColor');
    fill(lineColorInput.value);
    textSize(13*zoom);
    strokeWeight(.5);
    text(message, (-300 + xPos)*zoom, (yPos + (document.getElementById('graphHeight').value * -1))*zoom);
  }

  function calculateElevationChange(up){
    var change = 0;
    for(var i = 0; i < elevationGraphPoints.length-1; i++){
        if(elevationGraphPoints[i].y < elevationGraphPoints[i+1].y && up){
            change = change + elevationGraphPoints[i+1].y - elevationGraphPoints[i].y
        }else if(elevationGraphPoints[i].y > elevationGraphPoints[i+1].y && !up){
            change = change + elevationGraphPoints[i].y - elevationGraphPoints[i+1].y
        }
    }
    return change*document.getElementById('elevationInterval').value;
  }

  function handleUndo(){
    if(!trailDone){
        handleTrailUndo();
    }
    if(!elevationDone){
        handleElevationUndo();
    }else{
        handleLengthUndo();
    }
  }


  ///////////////
  // Length Lines
  ///////////////

  var lengthDone = false;
  var lengthPoints = [];

  function handleLengthAdd(){
    if(lengthDone){
        return;
    }
    lengthPoints.push(new TrailPoint((mouseX/zoom)-xPos, (mouseY/zoom)-yPos))
    if(lengthPoints.length == 2){
        lengthDone = true;
    }
  }

  function handleLengthUndo(){
    if(lengthPoints.length == 0){
        elevationDone = false;
        handleElevationUndo();
    }else{
        lengthDone = false;
        lengthPoints.pop();
    }
  }

  function drawLengthSection(){
    if(lengthPoints.length == 1){
        noFill();
        var lineColorInput = document.getElementById('lineColor');
        stroke(lineColorInput.value);
        strokeWeight(3);
        beginShape();
        vertex((lengthPoints[0].x + xPos)*zoom, (lengthPoints[0].y + yPos)*zoom);
        vertex(mouseX, mouseY);
        endShape();
    }else if(lengthPoints.length == 2){
        noFill();
        var lineColorInput = document.getElementById('lineColor');
        stroke(lineColorInput.value);
        strokeWeight(3);
        beginShape();
        vertex((lengthPoints[0].x + xPos)*zoom, (lengthPoints[0].y + yPos)*zoom);
        vertex((lengthPoints[1].x + xPos)*zoom, (lengthPoints[1].y + yPos)*zoom);
        endShape();
    }
  }

  function drawLengthLines(){
    if(!lengthDone){
        return;
    }
    var elevationLineHeight = document.getElementById('elevationLineHeight').value/10;
    var graphOffset = document.getElementById('graphHeight').value * -1;
    var width = elevationGraphPoints[elevationGraphPoints.length - 1].x + 50;
    var maxElevation = elevationGraphPoints[0].y;
    elevationGraphPoints.forEach((e) => {
        if(maxElevation < e.y){
            maxElevation = e.y
        }
    });
    var minElevation = elevationGraphPoints[0].y;
    elevationGraphPoints.forEach((e) => {
        if(minElevation > e.y){
            minElevation = e.y
        }
    });
    maxElevation = ceil(maxElevation) + 1;
    minElevation = floor(minElevation) - 1;

    var lengthSize = sqrt(sq(lengthPoints[0].x - lengthPoints[1].x) + sq(lengthPoints[0].y - lengthPoints[1].y));

    var lineColorInput = document.getElementById('lineColor');
    noFill();
    stroke(lineColorInput.value + "40");
    
    strokeWeight(1);
    for(var i = 0; i <= width; i = i + lengthSize){
        beginShape();
        vertex(((i) + xPos)*zoom, ((-minElevation*elevationLineHeight) + yPos + graphOffset)*zoom)
        vertex(((i) + xPos)*zoom, ((-maxElevation*elevationLineHeight) + yPos + graphOffset)*zoom)
        endShape();
    }
  }
