import * as d3 from "d3";


export default class ProjectionPlot{
    constructor(){
        this.isInitialized = false;
    }

    initialize(div, projectData, categoryColor, 
        setSelectedInstances, legendAttr, 
        meanL2Range, setSelectedPerturbPoints){

      this.div = div; 
      this.categoryColor = categoryColor.reduce((acc, item) => {
        acc[item.name] = item.color; // Map 'name' to 'color'
        return acc;
      }, {});

      this.setSelectedInstances = setSelectedInstances;
      this._measureSize();
      d3.select(this.div).selectAll('svg').remove(); 
      this.svg = d3.select(this.div)
        .append('svg')
        .attr("viewBox", [-this.width/2, -this.height/2, this.width, this.height])
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto; display: block;")
        .attr('width', this.width)
        .attr('height', this.height);

      //operations
      this.brush = '';
      this.zoom = '';
      this.transform = {'k':1, 'x': 0, 'y': 0};
      this.clickedPoints = [];

      this.legendAttr = legendAttr;
      this.meanL2Range = meanL2Range;
      this.setSelectedPerturbPoints = setSelectedPerturbPoints;
      this.projectData = projectData;

      // element groups
      this.circlesG = ''; // all the points
      this.perturbCirclesG = '';

      this.draw_scatter_plot();
      this.setZooming(true); 

      this.isInitialized = true;
    }

    _measureSize() {
      const node = this.div;
      const measured = node?.clientWidth || parseInt(d3.select(node).style('width'), 10) || 0;
      // Fall back to the left-panel content width if the container is not laid out yet.
      this.width = Math.max(measured, 280);
      this.height = this.width;
    }

    _resizeSvg() {
      this._measureSize();
      if (!this.svg) return;
      this.svg
        .attr("viewBox", [-this.width/2, -this.height/2, this.width, this.height])
        .attr('width', this.width)
        .attr('height', this.height);
    }

    draw_scatter_plot(){
        // clear the svg.
        this.svg.selectAll('*').remove(); // Clear the existing plot
        if (!Array.isArray(this.projectData) || this.projectData.length === 0) {
            return;
        }

        const padding = 5;
        const xExtent = d3.extent(this.projectData, d => Number(d.x));
        const yExtent = d3.extent(this.projectData, d => Number(d.y));
        const xSpan = (xExtent[1] - xExtent[0]) || 1;
        const ySpan = (yExtent[1] - yExtent[0]) || 1;
        const xScaleFactor = (this.width-padding*2)/xSpan;
        const yScaleFactor = (this.height-padding*2)/ySpan;
        const scaleFactor = Math.min(xScaleFactor, yScaleFactor);
        this.xyScale = (value)=>scaleFactor*value;
        this.xCenter = (xExtent[0]+xExtent[1])/2;
        this.yCenter = (yExtent[0]+yExtent[1])/2;

        // translate the point cloud
        this.projectData.map((item)=>{
            item['x'] -= this.xCenter; 
            item['y'] -= this.yCenter; 
            return item;
        });

        // Create a group for the circles
        this.circlesG = this.svg.append('g'); // all the points
        this.circlesG = this.circlesG.selectAll("circle")
            .data(this.projectData)
            .enter()
            .append("circle")
            .attr('id', d=>`instance-${d.id}`)
            .attr("cx", d => this.xyScale(d.x))     
            .attr("cy", d => this.xyScale(d.y))     
            .attr("r", 2)                     
            .attr("fill", d=>{
                if(this.legendAttr==='Label'){return this.categoryColor[d['label']] || '#cccccc';}
                else{
                    return d3.interpolateViridis(d['L2Norm']);
                }
                })        
            .attr("stroke", "white")
            .style("stroke-width", "0.1px")
            .classed('projection-point', true);
    } 

    updateProjection(newProjectData) {
        this.projectData = newProjectData;
        this._resizeSvg();
        this.svg.selectAll('*').remove(); // Clear the existing plot
        this.draw_scatter_plot(); // Redraw the plot with the new data
        this.setZooming(true);
    }

    // draw the pertrubation points and path
    drawPerturbPoints(points){
        // Teporarily remove the hilight points
        this.circlesG.classed("points-unselected", true);

        if(points.length===0 && this.perturbCirclesG){
            this.perturbCirclesG.selectAll('*').remove();
        }

        let that = this;
        points.map((item) => {
            item['x'] -= this.xCenter;
            item['y'] -= this.yCenter;
            return item;
        });
    
        let selectedId = ''; // Track selected ID 

        if(this.perturbCirclesG){
            this.perturbCirclesG.selectAll('*').remove();
        }

        this.perturbCirclesG = this.svg.append('g');

        this.perturbCircles = this.perturbCirclesG.selectAll("circle")
            .data(points)
            .join("circle")
            .attr('id', d => `perturb-${d.id}`)
            .attr("cx", d => this.xyScale(d.x))
            .attr("cy", d => this.xyScale(d.y))
            .attr("r", 0.3)
            .attr("fill", (d, i) => (i === 0 || i === points.length - 1) ? "black" : "grey")
            .attr("stroke", "white")
            .style("stroke-width", "0.1px")
            .on("click", function (event, d) {
                if (selectedId===d.id) {
                    // Second click: Deselect
                    selectedId='';
                    that.setSelectedPerturbPoints([]);
                } else {
                    // First click: Select and reset others
                    selectedId=d.id;
                    that.setSelectedPerturbPoints([selectedId]);
                }
            });

         // Draw the path connecting the points
        const lineGenerator = d3.line()
            .x(d => this.xyScale(d.x))
            .y(d => this.xyScale(d.y));

        this.perturbCirclesG.append("path")
            .datum(points)
            .attr("d", lineGenerator)
            .attr("fill", "none")
            .attr("stroke", "grey")
            .attr("stroke-width", 0.1);
        
        this.perturbCirclesG.attr('transform', `translate(${this.transform.x}, ${this.transform.y}) scale(${this.transform.k})`);
        // this.perturbCirclesG.attr('transform', this.transform); 

    } 

    // draw the pertrubation points
    highlightPerturbPoints(point_id_list){
        if (!this.perturbCirclesG) return; // Ensure group exists
        
        this.perturbCirclesG.selectAll("circle")
            .attr("stroke", d => {
                return point_id_list.includes(d.id) ? "red" : "white"})
            .style("stroke-width", d => point_id_list.includes(d.id) ? "2px" : "0.1px");
    } 

    // redraw circles when the legend attribute is changed
    updatePointsByLegend(legendAttr){
        if(!this.isInitialized){return;}
        this.legendAttr = legendAttr;

        this.circlesG
            .attr("fill", d=>{
                if(this.legendAttr==='Label'){return this.categoryColor[d['label']] || '#cccccc';}
                else{
                    return d3.interpolateViridis(d['L2Norm']);
                }
                })         
            .attr("stroke", "white")
            .style("stroke-width", "0.1px");
    }

    // Update categoryColor when legendInfo changes
    updateCategoryColor(categoryColor){
        if(!this.isInitialized){return;}
        const nextColors = categoryColor.reduce((acc, item) => {
            acc[item.name] = item.color;
            return acc;
        }, {});
        // Legend clicks only update selectedNum; skip redraw when colors are unchanged
        // so selection dimming is not wiped by regenerating points.
        const colorKeys = new Set([...Object.keys(this.categoryColor || {}), ...Object.keys(nextColors)]);
        const colorsUnchanged = [...colorKeys].every(
            (key) => (this.categoryColor || {})[key] === nextColors[key]
        );
        this.categoryColor = nextColors;
        if(this.legendAttr === 'Label' && !colorsUnchanged){
            this.updatePointsByLegend(this.legendAttr);
        }
    }

    // enable click on the points or not
    setClick(flag){
        // click nodes
        if(!flag){
            this.clickedPoints=[];
            return;
        }
        let that = this;
        this.circlesG
            .on('mouseover', function(){
                d3.select(this).attr("stroke", "black")
                    .attr('r', 3)
                    .style('fill-opacity', 1);
            })
            .on('mouseout', function(){
                d3.select(this).attr("stroke", "white")
                    .attr('r', 1)
                    .style('fill-opacity', null); // revert to CSS-based opacity
            })
            .on('click', function(_, d, i){
                let id = d.id;
                let index = that.clickedPoints.indexOf(id);
                index>-1? that.clickedPoints.splice(index, 1):that.clickedPoints.push(id);
                that.setSelectedInstances({"instances": that.clickedPoints, "startId": `projection-points`}); // intentionally not specify the startID
            });
    }

    setZooming(flag){// true/not
        if (!flag) {
            this.svg.on(".zoom", null);
            return;
        }  
        
        this.zoom = d3.zoom().scaleExtent([0.5, 20])
            .on('zoom', (e)=>{
                if (this.circlesG) {
                    this.circlesG.attr('transform', e.transform);
                }
                if (this.perturbCirclesG) {
                    this.perturbCirclesG.attr('transform', e.transform);
                }
                this.transform = e.transform;
        });
        this.svg.call(this.zoom);
    }

    setBrush(flag){// true/false
        if (!flag) {
            if(this.brush!=='') this.svg.call(this.brush.move, null);
            this.svg.select('.overlay').remove();
            this.svg.on(".brush", null);
            return;
        }
        let that = this;
        this.brush = d3.brush()                
            .extent([[-this.width/2, -this.height/2], [this.width, this.height]])
            .on("start brush", updateChart)
            .on('end', brushEnd);
        this.svg.call(this.brush);
        function updateChart(e) {
            if (!e.selection) return;
            let extent = e.selection;
            that.circlesG.classed("points-unselected", function(d){ return isBrushed(extent, that.xyScale(d.x), that.xyScale(d.y)) } );
        }
        function brushEnd(e){
            let selectedInstances = [];   
            if(e.selection===null){
                that.circlesG.classed("points-unselected", false); 
            }
            else{
                let extent = e.selection; 
                that.circlesG.each(function(d, i){
                    d3.select(this).classed("points-unselected", ()=>{
                        let notbrushed = isBrushed(extent, that.xyScale(d.x), that.xyScale(d.y));
                        if(!notbrushed){selectedInstances.push(d['id']);};
                        return notbrushed;
                    });
                }); 
            }
            let selectInstances =  {"instances": selectedInstances, "startId": `projection`};
            that.setSelectedInstances(selectInstances);
        }
        function isBrushed(brush_coords, cx, cy) { 
            let x0 = brush_coords[0][0],
                x1 = brush_coords[1][0],
                y0 = brush_coords[0][1],
                y1 = brush_coords[1][1];
            x0 = (x0-that.transform.x)/that.transform.k;
            x1 = (x1-that.transform.x)/that.transform.k;
            y0 = (y0-that.transform.y)/that.transform.k;
            y1 = (y1-that.transform.y)/that.transform.k;
            return !(x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1);
        }        
    }

    setLasso(flag){// true/false
        if (!flag) {
            this.svg.on(".drag", null);

            return;
        }
        let that = this;
        let coords = [];
        const lineGenerator = d3.line();

        const pointInPolygon = function (point, vs) {
            let x = point[0],
                y = point[1];

            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i][0],
                    yi = vs[i][1];
                let xj = vs[j][0],
                    yj = vs[j][1];
                xi = (xi-that.transform.x)/that.transform.k;
                xj = (xj-that.transform.x)/that.transform.k;
                yi = (yi-that.transform.y)/that.transform.k;
                yj = (yj-that.transform.y)/that.transform.k;

                let intersect =
                    (yi > y) !== (yj > y) &&
                    x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
                if (intersect) inside = !inside;
            }

            return inside;
        };

        function drawPath() {
            that.svg.select("#lasso")
                    .style("stroke", "grey")
                    .style("stroke-width", "1.5px")
                    .style("fill", "grey")
                    .style("fill-opacity", "0.1")
                    .attr("d", lineGenerator(coords));
        }

        function dragStart() {
            coords = [];
            that.circlesG.classed("points-unselected", true);
            that.svg.select("#lasso").remove();
            that.svg
                .append("path")
                .attr("id", "lasso");
        }

        function dragMove(event) {
            let mouseX = event.x;
            let mouseY = event.y;
            coords.push([mouseX-that.width/2, mouseY-that.height/2]);
            drawPath();
        }

        function dragEnd() {
            let selectedDots = [];
            that.circlesG.each(function(d, i){
                let point = [
                    that.xyScale(d.x), 
                    that.xyScale(d.y)
                ];
                if (pointInPolygon(point, coords)) {
                    selectedDots.push(d.id);
                    d3.select(this).classed("points-unselected", false).raise();
                }
            });
            let selectInstances =  {"instances": selectedDots, "startId": `projection`};
            that.setSelectedInstances(selectInstances);
        }

        const drag = d3
            .drag()
            .on("start", dragStart)
            .on("drag", dragMove)
            .on("end", dragEnd);

        this.svg.call(drag);
    }

    // {"instances": [], "startId": ""}
    highlight_instances(selectedInstances){
        if(selectedInstances['startId']==='projection'){return;} // do not highlight the selected instances
        // clear lasso and brush if necessary
        this.svg.select('#lasso').remove();
        
        let selectedInstanceIds = selectedInstances['instances'];
        let empty = selectedInstanceIds.length===0;
        this.circlesG.classed("points-unselected", false);
        this.circlesG.each(function(d, i){
            let instanceId = d.id;
            if(empty||selectedInstanceIds.includes(instanceId)){
                d3.select(this).raise();
            }
            else{
                d3.select(this).classed("points-unselected", true);
            }
        })
    }

    setMode(viewMode){
        // null projection-left-points projection-left-lasso projection-left-brush
        let useZoom = !viewMode.startsWith('projection-');
        let useLasso = viewMode===`projection-lasso`;
        let useBrush = viewMode===`projection-brush`; 
        let useClick = viewMode===`projection-points`;
        this.setZooming(useZoom); 
        this.setLasso(useLasso);
        this.setBrush(useBrush);
        this.setClick(useClick);
    }
}