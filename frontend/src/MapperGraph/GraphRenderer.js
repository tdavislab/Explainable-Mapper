import * as d3 from 'd3';
import { grey } from "@mui/material/colors";
import {
    dragstarted,
    dragged,
    dragended,
    dragstartedAnchor,
    draggedAnchor,
    dragendedAnchor
} from './graphUtils';


export class GraphRenderer {
    constructor(nodesGroup, edgesGroup, nodes, links, visualEncoderConfig, onDragEnd = null, onDragStart = null) {
        this.nodesGroup = nodesGroup;
        this.edgesGroup = edgesGroup;
        this.nodes = nodes;
        this.links = links;
        this.onDragEnd = onDragEnd; // Callback function to call when drag ends
        this.onDragStart = onDragStart; // Callback function to call when drag starts

        // visual encoding
        let { categoryColor, legendAttr, nodeSizeAttr, edgeWidthAttr } = visualEncoderConfig;
        this.categoryColor = categoryColor.reduce((acc, item) => {
            acc[item.name] = item.color; // Map 'name' to 'color'
            return acc;
        }, {}); 
        this.legendAttr = legendAttr; // the attribute used to map to the node color 'Label' or 'none'
        this.nodeSizeAttr = nodeSizeAttr; // the attribute used to map to the node size 'none' or 'instance-count'
        this.edgeWidthAttr = edgeWidthAttr; // the attribute used to map to the edge width 'none' or jaccard similarity 

        // extra groups
        this.backgroundCircles = null; // the background circle of the node 

        // simulation 
        this.simulation = null; 

        // scales
        this.areaScale = d3.scaleLinear()   // scale for the circle area
            .domain([0, Math.max(...this.nodes.map(d=>d['vertices'].length))])   
            .range([70, 400]);
        this.fixedNodeRadius = 5; // the fixed radius of the node
        this.jacaardScale = d3.scaleLinear()   // scale for the edge width on jacaard similarity
            .domain([0, 1])   
            .range([0.1, 5]);

        // current zoom/pan transform (kept in sync by InteractionHandler)
        this.transform = { k: 1, x: 0, y: 0 };
    }

    clearGraph() {
        this.nodesGroup.selectAll("*").remove();
        this.edgesGroup.selectAll("*").remove();
    }

    drawForceDirected() {
        this.clearGraph();
        const xyScale = (value)=>value;
        const ticked = ()=>{
            this.edgesGroup.selectAll(".single-edge")
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            this.nodesGroup.selectAll(".single-node-group")
                .attr("transform", (d)=> `translate(${xyScale(d.x)}, ${xyScale(d.y)})`);
        }; 
        
        // simulation setup
        let tickCounter = 0; 
        this.simulation = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.links).id(function(d) { return d.id; }))
            .force("charge", d3.forceManyBody().strength(-60))
            .force("x", d3.forceX().strength(0.1)) // 0.22
            .force("y", d3.forceY().strength(0.1)) //0.22
            .on("tick", () => {
                if (tickCounter > 10000) {
                    this.simulation.stop();
                } else {
                    ticked();
                    tickCounter++;
                }
            });

        // each node is a group, don't assign this.nodesGroup again, as it will not reflectec in its parent class
        const nodesSelection = this.nodesGroup.selectAll("g")
            .data(this.nodes).enter().append("g")
            .attr("class", "single-node-group")
            .attr("id",(d)=>"group"+d.id)
            .call(d3.drag()
                .on("start", (event)=>{
                    dragstarted(event, this.simulation);
                    // Hide overlays when drag starts
                    if (this.onDragStart) {
                        this.onDragStart();
                    }
                })
                .on("drag", (event)=>dragged(event, this.simulation))
                .on("end", (event)=>{
                    dragended(event, this.simulation);
                    // Show overlays and regenerate them after drag ends
                    if (this.onDragEnd) {
                        this.onDragEnd();
                    }
                }));
        // each edge is a line
        const edgesSelection =  this.edgesGroup.selectAll("line")
            .data(this.links).enter().append("line")
            .classed("single-edge",true)
            .attr("id",d=>"link"+d.source.id+"_"+d.target.id)
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)
            .attr("stroke", grey[400])
            .attr("stroke-width", this.edgeWidthAttr==='none'? 1: d=>this.jacaardScale(d['jcd_sim']))
            .attr("stroke-opacity", 1);
        // each node has a white circle background
        this.backgroundCircles = nodesSelection.append("circle")
            .classed("node-background-circle",true)
            .style("stroke", "white")
            .style("stroke-width", "1.5")
            .attr("fill", "white")
            .attr("id",(d)=>"nodeCircle-"+d.id)
            .attr("r", d=>this.mapToRadius(d['vertices'].length))
            .attr("cx", 0)
            .attr("cy", 0);
        // add a color circle or pie chart for each node according to the legend attribute
        this.legendAttr==='Label'? this.generatePies(this.nodesGroup):this.generateColorCircle(this.nodesGroup);
        // each node has a text label
        this.texts = nodesSelection.append("text")
            .classed("node-text", true)
            .attr("fill", "black")
            .attr("font-size", "10")
            .attr("id",(d)=>"node-label-"+d.id)
            .text('')
            .attr("dx", '0em')
            .attr("dy",'0.35em')
            .attr("text-anchor",'middle')
            .attr('cursor', 'default');
    }

    drawAnchored(svgWidth, svgHeight) {
        this.clearGraph();
        const padding = 5;
        const xExtent = d3.extent(this.nodes, d => d.x);
        const yExtent = d3.extent(this.nodes, d => d.y);
        const xScaleFactor = (svgWidth - padding * 2) / (xExtent[1] - xExtent[0]);
        const yScaleFactor = (svgHeight - padding * 2) / (yExtent[1] - yExtent[0]);
        const scaleFactor = Math.min(xScaleFactor, yScaleFactor);

        // Compute center of the dataset
        const xMidpoint = (xExtent[0] + xExtent[1]) / 2;
        const yMidpoint = (yExtent[0] + yExtent[1]) / 2;
        // Define xyScale with centering
        const xyScaleX = x => scaleFactor * (x - xMidpoint);
        const xyScaleY = y => scaleFactor * (y - yMidpoint);
    
        // Helper function to access a node by ID
        const getNodeById = node_id => this.nodes.find(node => node.id === node_id);
        // Update link sources and targets
        this.links.forEach(link => {
            link.source = getNodeById(link.source);
            link.target = getNodeById(link.target);
        });
        /** Helper function: Compute point coordinates relative to zoom */
        const pointCoord = event => {
            const { offsetX, offsetY } = event.sourceEvent;
            const { k, x, y } = this.transform;
            return [(offsetX - svgWidth / 2 - x) / k, (offsetY - svgHeight / 2 - y) / k];
        };
    
        // Initialize nodes
        const nodesSelection = this.nodesGroup
            .selectAll("g")
            .data(this.nodes)
            .enter().append("g")
            .attr("class", "single-node-group")
            .attr("id", d => `group${d.id}`)
            .call(d3.drag()
                .on("start", (event)=>{
                    dragstartedAnchor(event, pointCoord);
                    // Hide overlays when drag starts
                    if (this.onDragStart) {
                        this.onDragStart();
                    }
                })
                .on("drag", (event, d)=>draggedAnchor(event, d, this.edgesGroup, pointCoord))
                .on("end", ()=>{
                    dragendedAnchor(xyScaleX, xyScaleY, this.edgesGroup);
                    // Show overlays and regenerate them after drag ends
                    if (this.onDragEnd) {
                        this.onDragEnd();
                    }
                }))
            .attr("transform", d => `translate(${xyScaleX(d.x)}, ${xyScaleY(d.y)})`);
    
        // Initialize links
        this.edgesGroup = this.edgesGroup
            .selectAll("line")
            .data(this.links)
            .enter().append("line")
            .classed("single-edge", true)
            .attr("id", d => `link${d.source.id}_${d.target.id}`)
            .attr("x1", d => xyScaleX(d.source.x))
            .attr("y1", d => xyScaleY(d.source.y))
            .attr("x2", d => xyScaleX(d.target.x))
            .attr("y2", d => xyScaleY(d.target.y))
            .attr("stroke", grey[400])
            .attr("stroke-width", d=>this.edgeWidthAttr==='none'? 1: this.jacaardScale(d['jcd_sim']))
            .attr("stroke-opacity", 1);
    
        // Initialize circles
        this.backgroundCircles = nodesSelection.append("circle")
            .classed("node-background-circle", true)
            .style("stroke", "white")
            .style("stroke-width", "1.5")
            .attr("fill", "white")
            .attr("id", d => `nodeCircle-${d.id}`)
            .attr("r", d => this.mapToRadius(d.vertices.length))
            .attr("cx", 0)
            .attr("cy", 0);
        // Generate labels or color-coded circles
        this.legendAttr === 'Label' ? this.generatePies(this.nodesGroup) : this.generateColorCircle(this.nodesGroup);
        // Initialize text labels
        this.texts = nodesSelection.append("text")
            .classed("node-text", true)
            .attr("fill", "black")
            .attr("font-size", "10")
            .attr("id", d => `node-label-${d.id}`)
            .text('')
            .attr("dx", '0em')
            .attr("dy", '0.35em')
            .attr("text-anchor", 'middle')
            .attr('cursor', 'default');
    }

    // add pie chart for each node when the legend attribute is 'Label'
    generatePies(selection) {
        let that = this;
        const pie = d3.pie().value(d => d[1]);
        const pies = selection.selectAll('.single-node-group').each(function(d, _){
            let categoryData = d['labels'];
            let prevEncode = d3.select(this).select("#node-encoder-"+d.id); 
            if(!prevEncode.empty()){    // if the pie chart is already drawn, remove it
                prevEncode.remove();   
            }
            d3.select(this)
                .append('g')
                .attr("id",(d)=>"node-encoder-"+d.id)
                .attr('fill-opacity', 1)
                .selectAll('paths')
                .data(pie(Object.entries(categoryData)))
                .enter()
                .append("path")
                .attr("d", d3.arc()
                            .outerRadius(that.mapToRadius(d['vertices'].length))
                            .innerRadius(0))
                .attr("fill", _d => that.categoryColor[_d.data[0]] || '#cccccc')
            });
    }

    // add color circle for each node when the legend attribute is 'L2Norm'
    generateColorCircle(selection) {
        let that = this;
        const circles = selection.selectAll('.single-node-group')
            .each(function(d){
                let prevEncode = d3.select(this).select("#node-encoder-"+d.id); 
                if(!prevEncode.empty()){    // if the pie chart is already drawn, remove it
                    prevEncode.remove();   
                } 
                d3.select(this)
                    .append("circle")
                    .attr("id",(d)=>"node-encoder-"+d.id)
                    .attr("r", _d=>that.mapToRadius(d['vertices'].length))
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("fill", _d =>d3.interpolateViridis(d['mean_L2Norm']));
                });
    }

    // redraw nodes when the legend attribute changed
    updateNodesByLegend(legendAttr){
        this.legendAttr = legendAttr; 

        if(this.legendAttr==='Average-L2-norm'){    // draw the L2 norm  
            this.generateColorCircle(this.nodesGroup);
        }
        else if(this.legendAttr==='Label'){
            this.generatePies(this.nodesGroup);
        }
        this.texts.raise();
        
        // After regenerating nodes, restore selection state if there's an active selection
        // This is handled by calling render_nodes() from InteractionHandler if needed
        if(this.onNodesRegenerated) {
            this.onNodesRegenerated();
        }
    }

    // Update categoryColor when legendInfo changes
    updateCategoryColor(categoryColor){
        const nextColors = categoryColor.reduce((acc, item) => {
            acc[item.name] = item.color;
            return acc;
        }, {});
        // Legend clicks only update selectedNum counts; skip redraw when colors are unchanged
        // so selection dimming is not wiped by regenerating pies.
        const colorKeys = new Set([...Object.keys(this.categoryColor || {}), ...Object.keys(nextColors)]);
        const colorsUnchanged = [...colorKeys].every(
            (key) => (this.categoryColor || {})[key] === nextColors[key]
        );
        this.categoryColor = nextColors;
        if(this.legendAttr === 'Label' && !colorsUnchanged){
            this.updateNodesByLegend(this.legendAttr);
        }
    }

    // update the vsual encoding of nodes and edges
    updateVisualEncoding(nodeSize, edgeWidth){
        this.nodeSizeAttr = nodeSize;
        this.edgeWidthAttr = edgeWidth;

        // update the node size
        // update the background node size
        this.backgroundCircles
            .attr("r", d=>this.mapToRadius(d['vertices'].length));
        // update the node encoder
        if(this.legendAttr==='Average-L2-norm'){    
            this.generateColorCircle(this.nodesGroup);
        }
        else if(this.legendAttr==='Label'){
            this.generatePies(this.nodesGroup);
        }
        this.texts.raise(); 

        // update the edge width
        this.edgesGroup.selectAll(".single-edge")
            .attr("stroke-width", this.edgeWidthAttr==='none'? 1: d=>this.jacaardScale(d['jcd_sim']))
        
        // After regenerating nodes, restore selection state if there's an active selection
        if(this.onNodesRegenerated) {
            this.onNodesRegenerated();
        }
    }

    // map node size to radius according to the legend attribute
    mapToRadius(value) {
        if(this.nodeSizeAttr==='none') return this.fixedNodeRadius;
        const area = this.areaScale(value);
        const radius = Math.sqrt(area / Math.PI); 
        return radius;
    }
}