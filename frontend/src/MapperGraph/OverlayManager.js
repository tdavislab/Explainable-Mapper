import * as BubbleSets from 'bubblesets-js';
import * as d3 from 'd3';
import { dragstarted, dragged, dragended } from './graphUtils';
import { grey } from '@mui/material/colors';

export class OverlayManager {
    constructor(graphSvg_g, nodesGroup, edgesGroup, nodes, links, setSelectedPerturbPoints) {
        this.graphSvg_g = graphSvg_g;
        this.nodesGroup = nodesGroup;
        this.edgesGroup = edgesGroup;
        this.setSelectedPerturbPoints = setSelectedPerturbPoints;
        this.nodes = nodes;
        this.links = links;
        this.componentsOverlay = null; // bubbleset overlay for components 
        this.componentsLabelsOverlay = null; // component labels overlay (on top)
        this.nodesLabelOverlay = null; // nodes label overlay
        this.perturbLine = null;    // perturbation line 
        // anntoation data
        this.annotationData = {'componentsData': '', 'nodesData': ''};
        this.nodesAnnotationData = {'nodesLabelData': '', 'nodesData': ''};
    }  

    zoomStarted() {
        // if the component overlay is shown, update the position of the overlay
        if(this.componentsLabelsOverlay) this.componentsLabelsOverlay.selectAll('.component-overlay-label').remove();
        if(this.nodesLabelOverlay) this.nodesLabelOverlay.selectAll('.node-label-overlay').remove();
    }

            // this function is called when the zoom is ended
        zoomUpdated(scaleFactor) {
            // if the component overlay is shown, update the position of the overlay
            if(this.annotationData['componentsData'] !== '' && this.annotationData['nodesData'] !== ''){
                this.showComponentOverlay(this.annotationData['componentsData'], this.annotationData['nodesData'], scaleFactor);
            }
            // if the nodes label overlay is shown, update the position of the overlay
            if(this.nodesAnnotationData['nodesLabelData'] !== '' && this.nodesAnnotationData['nodesData'] !== ''){
                this.showNodesLabelOverlay(this.nodesAnnotationData['nodesLabelData'], this.nodesAnnotationData['nodesData'], scaleFactor);
            }
        }

    showComponentOverlay(componentsData, nodesData, scaleFactor=1) {
        // draw bubble set overlay for the nodes
        // componentsData: A list of dict: [{component_id: [],  "nodeIds": [], "keywords": [using the original summary], "sim": num}, ..]
        if(this.componentsOverlay) this.componentsOverlay.remove();
        if(this.componentsLabelsOverlay) this.componentsLabelsOverlay.remove();
        // update the annotation data
        this.annotationData['componentsData'] = componentsData;
        this.annotationData['nodesData'] = nodesData;
        
        // Create component overlay BEFORE nodes and edges (so background appears behind)
        // Create two separate groups: background (behind) and labels (on top)
        this.componentsOverlay = this.graphSvg_g.insert("g", ":first-child");
        this.componentsLabelsOverlay = this.graphSvg_g.append("g"); // Labels will be on top
        
        let that = this;
        // a d3 color map for importance: domain:0-1, range: grey[100]-balck
        const colorScale = d3.scaleLinear()
            .domain([0.8, 1])
            .range([grey[100], 'black']);
        // let fontSize = scaleFactor>1.2 ? 12*1.2/scaleFactor : 12; // set a minimum scale factor
        let fontSize = scaleFactor>2.5 ? 18*2.5/scaleFactor : 18; // set a minimum scale factor


        // sort the componentsData  by "sim" in descending order
        componentsData = componentsData.sort((a, b) => b.sim - a.sim);
        const placedBBoxes = []; // bboxes of the each keyword

        // Render component backgrounds (behind nodes/edges)
        this.componentsOverlay.selectAll(".component-overlay")
            .data(componentsData)
            .enter()
            .append("g")
            .attr("class", "component-overlay")
            .each(function(d) {
                const componentId = d.component_id;
                const nodeIds = d.nodeIds;
                const labelText = d.keywords.slice(0, 2).join("-");
                const sim = d.sim;

                // 1. add the bubble set for the component (background only)
                let nodes = nodesData.filter(node => nodeIds.includes(node.id));
                const bubbleSets = new BubbleSets.BubbleSets();
                nodes.forEach(node => {
                    // get the radius of the node
                    let radius = parseFloat(that.nodesGroup.select(`#group${node.id}`)
                            .select('.node-background-circle').attr('r'));
                    bubbleSets.pushMember(BubbleSets.circle(node.x, node.y, radius));
                });
                const pointPath = bubbleSets.compute();
                const cleanPath = pointPath.sample(8).simplify(0).bSplines().simplify(0);
                d3.select(this).append("path")
                    .attr("class", "component-overlay-bubble")
                    .attr("d", cleanPath.toString())
                    .attr("fill", grey[200])
                    .attr("fill-opacity", 0.5)
                    .attr("stroke", "black")
                    .attr("stroke-width", 0);

                // 2. add text for the component (in separate overlay, on top)
                // get the center: cleanPath {points;[{x, y}, ...]} no centroid method
                const clusterCenter = pointPath.points.reduce((acc, item) => {   
                    acc.x += item.x;    
                    acc.y += item.y;
                    return acc;
                }, {x: 0, y: 0}); 
                clusterCenter.x /= pointPath.points.length;
                clusterCenter.y /= pointPath.points.length;
                const centroid = nodes.reduce((closestNode, node) => {
                    const distanceToClusterCenter = Math.sqrt(
                        Math.pow(node.x - clusterCenter.x, 2) + Math.pow(node.y - clusterCenter.y, 2)
                    );
                    if (distanceToClusterCenter < closestNode.distance) {
                        return { node, distance: distanceToClusterCenter };
                    }
                    return closestNode;
                }, { node: null, distance: Infinity }).node; 
                
                const label = that.componentsLabelsOverlay.append("text")
                    .attr("class", "component-overlay-label")
                    .attr("x", centroid.x)
                    .attr("y", centroid.y)
                    .attr("font-size", fontSize)
                    .text(labelText)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "middle")
                    .attr("font-family", "Arial")
                    .attr("font-weight", "500")
                    .attr("fill", colorScale(sim))
                    .style("stroke", "white") // Add white border
                    .style("stroke-width", "2px") // Adjust border thickness
                    .style("paint-order", "stroke"); // Ensure stroke is rendered before fill

                const bbox = label.node().getBBox();
                const maxOverlap = Math.max(
                    0,
                    ...placedBBoxes.map(box => that.iou(bbox, box))
                );
                if (maxOverlap > 0) {
                    label.remove(); // Too much overlap
                } else {
                    placedBBoxes.push(bbox); // Keep it
                }
            });
    }

    hideComponentOverlay() {
        // remove annotation data
        this.annotationData['componentsData'] = '';
        this.annotationData['nodesData'] = '';
        if(this.componentsOverlay) this.componentsOverlay.remove();
        if(this.componentsLabelsOverlay) this.componentsLabelsOverlay.remove();
    }

    showNodesLabelOverlay(nodesLabelData, nodesData, scaleFactor=1) {
        // draw bubble set overlay for the nodes
        // nodesLabelData: A list of dict: [{node_id: '', "keywords": [using the original summary], "sim": num}, ..]
        if(this.nodesLabelOverlay) this.nodesLabelOverlay.remove();
        // update the annotation data
        this.nodesAnnotationData['nodesLabelData'] = nodesLabelData;
        this.nodesAnnotationData['nodesData'] = nodesData;

        this.nodesLabelOverlay = this.graphSvg_g.append("g");
        let that = this;
        // a d3 color map for importance: domain:0-1, range: grey[100]-balck
        const colorScale = d3.scaleLinear()
            .domain([0.8, 1])
            .range([grey[100], 'black']);
        let fontSize = scaleFactor>2.5 ? 12*2.5/scaleFactor : 12; // set a minimum scale factor

        // sort the nodesLabelData  by "sim" in descending order
        nodesLabelData = nodesLabelData.sort((a, b) => b.sim - a.sim);
        const placedBBoxes = []; // bboxes of the each keyword and nodes
        // first put all nodes into the placedBBoxes
        nodesData.forEach(function(node) {
            const nodeSelection = that.nodesGroup.select(`#group${node.id}`); // .attr('fill-opacity', 1)  .attr("id",(d)=>"node-encoder-"+d.id)
            // get the fill opacity
            const fillOpacity = that.nodesGroup.select(`#node-encoder-${node.id}`).attr('fill-opacity');
            if (fillOpacity != 1) return; // skip the node if it is not visible
            // if (strokeColor !== 'black') 
            const radius = parseFloat(nodeSelection.select('.node-background-circle').attr('r'));
            const expandedBBox = {
                x: node.x - radius,
                y: node.y - radius,
                width: 2 * radius,
                height: 2 * radius
            };
            placedBBoxes.push(expandedBBox);
        });

        this.nodesLabelOverlay.selectAll('.node-label-overlay')
            .data(nodesLabelData)
            .enter()
            .append("g")
            .attr("class", "node-label-overlay")
            .each(function(d) {
                const node_id = d.node_id;
                const labelText = d.keywords[0];
                const sim = d.sim;

                const fillOpacity = that.nodesGroup.select(`#node-encoder-${node_id}`).attr('fill-opacity');
                if (fillOpacity != 1) return; // skip the node if it is not visible

                // 2. add text for the nodes
                // get the node center
                let node = nodesData.filter(node => node.id === node_id)[0];
                const nodeSelection = that.nodesGroup.select(`#group${node.id}`);
                // radius of the node
                let radius = parseFloat(nodeSelection.select('.node-background-circle').attr('r'));
                // get the centroid of the node
                const anchor = {x: node.x+radius+1, y: node.y};
                
                const label = d3.select(this).append("text")
                    .attr("class", "node-overlay-label")
                    .attr("x", anchor.x)
                    .attr("y", anchor.y)
                    .attr("font-size", fontSize)
                    .text(labelText)
                    .attr("text-anchor", "start")
                    .attr("alignment-baseline", "middle")
                    .attr("font-family", "Arial")
                    .attr("font-weight", "500")
                    .attr("fill", colorScale(sim))
                    .style("stroke", "white") // Add white border
                    .style("stroke-width", "2px") // Adjust border thickness
                    .style("paint-order", "stroke"); // Ensure stroke is rendered before fill

                const bbox = label.node().getBBox();
                const maxOverlap = Math.max(
                    0,
                    ...placedBBoxes.map(box => that.iou(bbox, box))
                );
                if (maxOverlap > 0) {
                    label.remove(); // Too much overlap
                } else {
                    placedBBoxes.push(bbox); // Keep it
                }
            });
    }

    hideNodesLabelOverlay() {
        // remove annotation data
        this.nodesAnnotationData['nodesLabelData'] = '';
        this.nodesAnnotationData['nodesData'] = '';
        if(this.nodesLabelOverlay) {
            this.nodesLabelOverlay.remove();
            this.nodesLabelOverlay = null;
        }
    }




    showNodeKeywords(componentsData, nodesData, scaleFactor=1) {
        // draw bubble set overlay for the nodes
        // componentsData: A list of dict: [{component_id: [],  "nodeIds": [], "keywords": [using the original summary], "sim": num}, ..]
        if(this.componentsOverlay) this.componentsOverlay.remove();
        if(this.componentsLabelsOverlay) this.componentsLabelsOverlay.remove();
        // update the annotation data
        this.annotationData['componentsData'] = componentsData;
        this.annotationData['nodesData'] = nodesData;
        
        // Create two separate groups: background (behind) and labels (on top)
        this.componentsOverlay = this.graphSvg_g.insert("g", ":first-child");
        this.componentsLabelsOverlay = this.graphSvg_g.append("g"); // Labels will be on top
        let that = this;
        // a d3 color map for importance: domain:0-1, range: grey[100]-balck
        const colorScale = d3.scaleLinear()
            .domain([0.1, 1])
            .range([grey[100], 'black']);
        let fontSize = scaleFactor>1.2 ? 12*1.2/scaleFactor : 12; // set a minimum scale factor

        // sort the componentsData  by "sim" in descending order
        componentsData = componentsData.sort((a, b) => b.sim - a.sim);
        const placedBBoxes = []; // bboxes of the each keyword

        this.componentsOverlay.selectAll(".component-overlay")
            .data(componentsData)
            .enter()
            .append("g")
            .attr("class", "component-overlay")
            .each(function(d) {
                const componentId = d.component_id;
                const nodeIds = d.nodeIds;
                const labelText = d.keywords.slice(0, 2).join("-");
                const sim = d.sim;

                // 1. add the bubble set for the component
                let nodes = nodesData.filter(node => nodeIds.includes(node.id));
                const bubbleSets = new BubbleSets.BubbleSets();
                nodes.forEach(node => {
                    // get the radius of the node
                    let radius = parseFloat(that.nodesGroup.select(`#group${node.id}`)
                            .select('.node-background-circle').attr('r'));
                    bubbleSets.pushMember(BubbleSets.circle(node.x, node.y, radius));
                });
                const pointPath = bubbleSets.compute();
                const cleanPath = pointPath.sample(8).simplify(0).bSplines().simplify(0);
                d3.select(this).append("path")
                    .attr("class", "component-overlay-bubble")
                    .attr("d", cleanPath.toString())
                    .attr("fill", grey[200])
                    .attr("fill-opacity", 0.5)
                    .attr("stroke", "black")
                    .attr("stroke-width", 0);

                // 2. add text for the component
                // get the center: cleanPath {points;[{x, y}, ...]} no centroid method
                const clusterCenter = pointPath.points.reduce((acc, item) => {   
                    acc.x += item.x;    
                    acc.y += item.y;
                    return acc;
                }, {x: 0, y: 0}); 
                clusterCenter.x /= pointPath.points.length;
                clusterCenter.y /= pointPath.points.length;
                const centroid = nodes.reduce((closestNode, node) => {
                    const distanceToClusterCenter = Math.sqrt(
                        Math.pow(node.x - clusterCenter.x, 2) + Math.pow(node.y - clusterCenter.y, 2)
                    );
                    if (distanceToClusterCenter < closestNode.distance) {
                        return { node, distance: distanceToClusterCenter };
                    }
                    return closestNode;
                }, { node: null, distance: Infinity }).node; 
                
                const label = that.componentsLabelsOverlay.append("text")
                    .attr("class", "component-overlay-label")
                    .attr("x", centroid.x)
                    .attr("y", centroid.y)
                    .attr("font-size", fontSize)
                    .text(labelText)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "middle")
                    .attr("font-family", "Arial")
                    .attr("font-weight", "500")
                    .attr("fill", colorScale(sim))
                    .style("stroke", "white") // Add white border
                    .style("stroke-width", "2px") // Adjust border thickness
                    .style("paint-order", "stroke"); // Ensure stroke is rendered before fill

                const bbox = label.node().getBBox();
                const maxOverlap = Math.max(
                    0,
                    ...placedBBoxes.map(box => that.iou(bbox, box))
                );
                if (maxOverlap > 0) {
                    label.remove(); // Too much overlap
                } else {
                    placedBBoxes.push(bbox); // Keep it
                }
            });
    }





    iou(boxA, boxB) {
        const x1 = Math.max(boxA.x, boxB.x);
        const y1 = Math.max(boxA.y, boxB.y);
        const x2 = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
        const y2 = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);
      
        const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const unionArea = boxA.width * boxA.height + boxB.width * boxB.height - interArea;
      
        return interArea / unionArea;
    }
      

    // highlight the two end nodes of a perturbation path
    highlightPerturbNodesByIds(nodeIdList=[]) {
        this.nodesGroup
            .selectAll(".single-node-group")
            .selectAll(".node-background-circle")
            .filter(d=>nodeIdList.includes(d.id))
            .style("stroke", "black") // Highlight color for selected nodes
            .style("stroke-width", "5"); // Adjust stroke width for highlighting
    }

    dehighlightPerturbNodes() {
        this.nodesGroup
            .selectAll(".single-node-group")
            .selectAll(".node-background-circle")
            .style("stroke", "white") // Highlight color for selected nodes
            .style("stroke-width", "1.5"); // Adjust stroke width for highlighting
    }

    async attachPerturbationLine(perturbationData, setSelectedPerturbPoints) {
        // node_edge_mapping: list node-id: [] or edge-id (nodeid--nodeid): []
        // perturbationData  = {"related_nodes": nodes_related_path, "perturb_mapping": node_edge_mapping, "node_to_perturb" "related_components": list(graph_component_ids)}
        if (this.perturbLine) {
            this.perturbLine.remove();
            this.perturbLine = null;
        }
        let related_node_ids= perturbationData['related_nodes'];
        let node_edge_mapping = perturbationData['perturb_mapping'];
        let related_component_ids = perturbationData['related_components'];
        let node_to_perturb = perturbationData['node_to_perturb'];
        let selectedMapperNodeId = '';  // interactions on the selected node

        // Keep all graph nodes/edges fully visible while a trajectory is attached.
        this.nodesGroup.selectAll(".single-node-group")
            .each(function(d) {
            d3.select(this).style("opacity", 1);
            const nodeEncoder = d3.select(this).select(`#node-encoder-${d.id}`);
            nodeEncoder.attr("fill-opacity", 1);
            nodeEncoder.selectAll("*").attr("fill-opacity", 1);
            if (related_node_ids.includes(d.id)) {
                d3.select(this)
                .on("click", function (event, d) {
                    if (selectedMapperNodeId===d.id) {
                        // Second click: Deselect
                        selectedMapperNodeId='';
                        setSelectedPerturbPoints([]);
                    } else {
                        // First click: Select and reset others
                        selectedMapperNodeId=d.id;
                        setSelectedPerturbPoints(node_to_perturb[selectedMapperNodeId]);
                    }
                })
                .raise();
            }
        });
        this.edgesGroup.selectAll(".single-edge")
            .each(function(d) {
            d3.select(this).style("opacity", 1).attr("stroke-opacity", 1);
            d3.select(this).selectAll("*").style("opacity", 1).attr("stroke-opacity", 1);
            if (related_node_ids.includes(d.source.id) && related_node_ids.includes(d.target.id)) {
                d3.select(this).raise();
            }
        });

        // return the force layout on the selected components
        // await this.runForceOnComponent(related_component_ids);
       
        // disable all drags
        // this.nodesGroup.selectAll(".single-node-group")
        //     .on(".start", null).on(".drag", null).on(".end", null);
       
        let perturbSequenceLocList = [];
        Object.entries(node_edge_mapping).forEach(([key, values]) => {
            if (key.includes("--")) {
                const [node1_id, node2_id] = key.split("--"); // Extract nodes for the edge 
                let edge_id_1 = `link${node1_id}_${node2_id}`;
                let edge_id_2 = `link${node2_id}_${node1_id}`;
                let edgeSelection = this.graphSvg_g.select(`#${edge_id_1}`);
                if (edgeSelection.empty()) {    // if the edge is not found, try the reverse order
                    edgeSelection = this.graphSvg_g.select(`#${edge_id_2}`);
                }
                if (edgeSelection.empty()) {    // if the edge is not found, return
                    return;
                }
                let edge = edgeSelection.datum();
                const orderedValues = [...values].sort((a, b) => a - b);
                let locations = this.positionDatapointsOnEdge(edge, orderedValues, node2_id, node1_id);
                perturbSequenceLocList = perturbSequenceLocList.concat(locations);
            } else {
                let nodeSelection = this.graphSvg_g.select(`#group${key}`);
                if (nodeSelection.empty()) {    // if the node is not found, return
                    return;
                }
                let node = nodeSelection.datum();
                const orderedValues = [...values].sort((a, b) => a - b);
                let locations = this.positionDatapointsInNode(node, orderedValues, 5); // Adjust radius as needed
                perturbSequenceLocList = perturbSequenceLocList.concat(locations);
            }
        });
        // sort perturbSequenceLocList by id increasing
        perturbSequenceLocList.sort((a, b) => a.id - b.id);
               
        // Draw the perturbation sequence (nodes and edges)
        this.perturbLine = this.graphSvg_g.append("g");
        let datapointLinks = [];
        for (let i = 0; i < perturbSequenceLocList.length - 1; i++) {
            datapointLinks.push({
                source: perturbSequenceLocList[i],
                target: perturbSequenceLocList[i + 1]
            });
        }            
        this.perturbLine.selectAll(".datapoint-link")
            .data(datapointLinks)
            .enter().append("path") // Use <path> instead of <line>
            .attr("class", "datapoint-link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.x) // x-coordinate for source and target
                .y(d => d.y) // y-coordinate for source and target
            )
            .style("fill", "none") // Ensure the path is not filled
            .style("stroke", "black")
            .style("stroke-width", 0.5); 
        let selectedId = '';
        this.perturbLine.selectAll(".datapoint")
            .data(perturbSequenceLocList)
            .enter().append("circle")
            .attr("class", "datapoint")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 1)
            .attr("fill", (d, i) => (i === 0 || i === perturbSequenceLocList.length - 1) ? "black" : "grey")
            .attr("stroke", "white")
            .style("stroke-width", "0.1px")
            .on("click", function (event, d) {
                if (selectedId===d.id) {
                    // Second click: Deselect
                    selectedId='';
                    this.setSelectedPerturbPoints([]);
                } else {
                    // First click: Select and reset others
                    selectedId=d.id;
                    setSelectedPerturbPoints([d.id]);
                }
            });
    }

    deattachPerturbationLine(simulation) {
        if (this.perturbLine)  this.perturbLine.remove();
       
        // Highlight related nodes and edges
        this.nodesGroup.selectAll(".single-node-group")
            .style("opacity", 1).on("click", null)
            .each(d => {
                d.fx = null;
                d.fy = null;
            });
        this.edgesGroup.selectAll(".single-edge").style("opacity", 1);
        // simulation.alpha(1).restart(); // Reset alpha and restart
        
        // this.nodesGroup.selectAll(".single-node-group").call(d3.drag()
        //     .on("start", (event)=>dragstarted(event, simulation))
        //     .on("drag", (event)=>dragged(event, simulation))
        //     .on("end", (event)=>dragended(event, simulation)));
    } 

    // hilight the pertrubation points
    highlightPerturbPoints(point_id_list){
        if (!this.perturbLine) return; // Ensure group exists
        this.perturbLine.selectAll("circle")
            .attr("stroke", d => {
                return point_id_list.includes(d.id) ? "red" : "white"})
            .style("stroke-width", d => point_id_list.includes(d.id) ? "2px" : "0.1px");
    } 



    // helper functions
    // attach points onto an edge
    positionDatapointsOnEdge(edge, datapoints, srcNodeId, tgtNodeId) {
        let source = edge.source.id === srcNodeId ? edge.source : edge.target;
        let target = edge.source.id === tgtNodeId ? edge.source : edge.target;
        // Calculate the distance and angle between the source and target
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        let sourceRadius = 7;
        let targetRadius = 7;
        // Adjust the start and end points based on the radii of the source and target nodes
        const x1 = source.x + sourceRadius * Math.cos(angle);
        const y1 = source.y + sourceRadius * Math.sin(angle);
        const x2 = target.x - targetRadius * Math.cos(angle);
        const y2 = target.y - targetRadius * Math.sin(angle);
        return datapoints.map((dp, i) => {
          const ratio = (i + 1) / (datapoints.length + 1); // Distribute along the edge
          return {
            id: dp,
            x: x1 + (x2 - x1) * ratio + (Math.random() - 0.5) * 0, // Add slight jitter original * 5
            y: y1 + (y2 - y1) * ratio + (Math.random() - 0.5) * 0
          };
        });
    }
    // attach points onto a node
    positionDatapointsInNode(node, datapoints, radius) {
        const angleStep = (2 * Math.PI) / datapoints.length;
        const startAngle = -Math.PI / 2; // Start at the upper-right of the mapper node.
        return datapoints.map((dp, i) => {
          const angle = startAngle + i * angleStep;
          return {
            id: dp,
            x: node.x + radius * Math.cos(angle),
            y: node.y + radius * Math.sin(angle)
          };
        });
    } 

    // ** Function to re-run force only on specific components **
    // this method is helpful when we attach a line chart to the component 
    runForceOnComponent(componentIDs) {
        return new Promise((resolve) => {
            // this.simulation.stop(); 
            let ticked = ()=> {
                this.edgesGroup.selectAll(".single-edge")
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
                this.nodesGroup.selectAll(".single-node-group")
                    .attr("transform",(d) => `translate(${d.x}, ${d.y})`);
            }

            // Fix positions of all nodes **not in the selected component**
            this.nodesGroup.selectAll(".single-node-group")
                .each(d => {
                if (!componentIDs.includes(d.comp_id)) {
                    d.fx = d.x;
                    d.fy = d.y;
                } else {
                    d.fx = null;
                    d.fy = null;
                }
            });

            // Run a new simulation **only on selected component**
            const componentNodes = this.nodes.filter(d => componentIDs.includes(d.comp_id));
            const componentLinks = this.links.filter(d =>
                componentNodes.some(n => n.id === d.source.id) &&
                componentNodes.some(n => n.id === d.target.id)
            );
            let iterationCount = 0;
            const maxIterations = 70;
            const localSimulation = d3.forceSimulation(componentNodes)
                .force("link", d3.forceLink(componentLinks)
                                    .id(d => d.id)
                                    .distance(50))
                .force("charge", d3.forceManyBody().strength(-10)) 
                .force("center", d3.forceCenter(0, 0).strength(1))
                .force("x", d3.forceX().strength(0.01)) // 0.22
                .force("y", d3.forceY().strength(0.01)) //0.22
                .on("tick",  () => {
                    iterationCount++;
                    if (iterationCount >= maxIterations) {
                        localSimulation.stop();
                        resolve(); 
                    }
                    ticked();
                });

        });
    }
    
}