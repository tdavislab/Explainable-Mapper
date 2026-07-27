import * as d3 from 'd3';
import axios from 'axios';
import { updateArray } from "../utils";
import { red, grey } from '@mui/material/colors';


// handle the interaction of the graph: zoom, select nodes, select components, select path, and highlight the corresponding nodes
export class InteractionHandler {
    constructor(svg, 
        graphSvg_g, nodesGroup, edgesGroup, 
        setSelectedInstances, setHaloInstances,
        setComparisonStatus, overlayManager
    ) {
        this.svg = svg;
        this.graphSvg_g = graphSvg_g;
        this.nodesGroup = nodesGroup;
        this.edgesGroup = edgesGroup;
        this.setSelectedInstances = setSelectedInstances;  // useState({"instances": [], "startId": ""}); set "startId"=> mapper-edge, mapper
        this.setHaloInstances = setHaloInstances; // useState([]); set the instances selected in a selected path or component
        this.setComparisonStatus = setComparisonStatus;
        this.transform = {'k':1, 'x': 0, 'y': 0};
        this.selected_nodes = [];
        this.lastExternalSelection = null; // last non-mapper selection (legend/projection/etc.)
        this.haloNode = null; // the node that is selected in a selected component or path
        this.comparisonStatus = {"isCompare": false, "compareInstances":[]};
        this.overlayManager = overlayManager; // OverlayManager obeject
    }

    clearHighlight(){
        this.nodesGroup.selectAll('.node-background-circle').classed('halo-effect', false);
        this.haloNode = null;
        this.selected_nodes = [];
        this.setHaloInstances([]);
        // clear the comparison nodes
        this.render_nodes();
        this.comparisonStatus = {"isCompare": false, "compareInstances":[]};
    }

    updateComparisonMode(newComparisonStatus){
        this.comparisonStatus = newComparisonStatus;
        let newIsCompare = this.comparisonStatus.isCompare;
        if(!newIsCompare){ // reset the comparison mode when it is off
            this.render_nodes();
        }
    }

    /**
    * when another view updated the selected instances, we highlight correspindances or reset
    * selectedInstances: {"instances": [], "startId": ""}
    * nodes: all nodes in the graph
    */  
    highlightCorrespondances(selectedInstances, nodes) {
        if(selectedInstances['startId'] && selectedInstances['startId'].includes('mapper')) { return; } // only update when the startId is not from this view
        this.lastExternalSelection = selectedInstances;
        this.svg.selectAll('.first-select-node').classed('first-select-node', false);
        this.svg.selectAll('.ready-path-nodes').classed('ready-path-nodes', false);
        this.selected_nodes = [];
        let vertice_lst = selectedInstances['instances'];
        let correspondances = {};
        nodes.forEach(function(node) {
            let commonElements = vertice_lst.filter(item => node['vertices'].includes(item));
            if (commonElements.length>0){
                correspondances[node['id']] = commonElements.length;
            }
        });
        // correspondances: [[nodeId, #V_ids], [nodeId, #V_ids], ...]
        let empty = Object.keys(correspondances).length===0; 
        this.nodesGroup.selectAll('.single-node-group').each(function(data) {
            // console.log(data);
            let id = data.id;
            let containThisId = id in correspondances;
            if(containThisId) d3.select(this).raise();
            let overlapPercentage = correspondances[id]/vertice_lst.length;
            d3.select(this)
                .select(`#node-encoder-${id}`)
                .selectAll('path')
                .attr('fill-opacity', (empty)||containThisId? 0.7+0.7*overlapPercentage: 0.3); 
            d3.select(this)
                .select(`#node-label-${id}`)
                .text((empty)||!containThisId? "":`${correspondances[id]}/${data['vertices'].length}`); 
        });
    }
    
    // the default mode when no mapper elements are selected
    setZoom(flag){
        if(!flag) return;
        this.nodesGroup.selectAll('.single-node-group').on('click', null).on('mouseover', null); 
        this.selected_nodes = [];
        this.render_nodes();

        let zoomTimeout = null;
        this.zoom = d3.zoom().scaleExtent([0.2, 5])
            .on('zoom', (e)=>{
                this.graphSvg_g.attr('transform', e.transform);
                // this.graphSvg_g.select('.graph-link-group').attr('transform', e.transform);
                // this.graphSvg_g.select('.graph-node-group').attr('transform', e.transform); 
                // this.graphSvg_g.selectAll('.component-overlay-bubble').attr('transform', e.transform);
                this.overlayManager.zoomStarted();

                this.transform = e.transform;
                if (this.renderer) {
                    this.renderer.transform = e.transform;
                }
                // Debounced zoom-end simulation
                if (zoomTimeout) clearTimeout(zoomTimeout);
                zoomTimeout = setTimeout(() => {
                    this.overlayManager.zoomUpdated(e.transform.k); 
                }, 200); 
            });
        this.svg.call(this.zoom);
    }

    setPoints(flag){ // select nodes mode
        if(!flag) return;
        this.nodesGroup.selectAll('.single-node-group')
            .on('mouseover', null)
            .on('mouseout', null)
            .on('click', (_, d)=>{
                this.click_node(d);
            });  
    }

    setComponents(flag){ // select components, only once 
        if(!flag) return;
        this.nodesGroup.selectAll('.single-node-group')
            .on('mouseover', null)
            .on('mouseout', null)
            .on('click', (_, d) => {
            this.click_components(d);
        });
    }


    setPath(flag, useCircle=false){
        if(!flag) return;
        let api = useCircle? '/api/click_select_circle':'/api/click_select_path'
        let that = this;
        this.edgesGroup.selectAll('.single-edge').on('click', null).on('mouseover', null); 
        this.nodesGroup.selectAll('.single-node-group')
        .on('click', function(_, d){ 
            const id=d.id;
            let selected_num = that.selected_nodes.length;
            if(selected_num===0||selected_num>=2){  // the first click one time a circle
                // if there is already a path and click on node in the path, enable the halo effect
                that.setHaloInstances([]);
                if(selected_num>=2&&that.selected_nodes.includes(id)){
                    that.haloNode = (that.haloNode === id) ? null : id;
                    that.nodesGroup.selectAll('.node-background-circle')
                        .classed('halo-effect', d => {
                            let isHalo = d.id === that.haloNode;
                            if(isHalo) that.setHaloInstances(d.vertices);
                            return isHalo;
                        });
                    return;
                }
                // else, clear the previous path selection and halo effect
                that.clearHighlight();
                that.selected_nodes=[];
                that.render_nodes();
                d3.select(this).select(`#nodeCircle-${id}`).classed('first-select-node', true);
                that.selected_nodes.push(id);
            }
            else if(selected_num===1){   // the seond click
                axios.post(api, {
                    "node1": that.selected_nodes[0],
                    "node2": id,
                  })
                  .then(function (response) {
                    that.clearHighlight();
                    let path = response.data.data;
                    if(path.length===0) return;
                    if(path.length===1) path = [path[0], path[0]];
                    that.selected_nodes = path;
                    that.svg.selectAll('.first-select-node').classed('first-select-node', false);
                    that.svg.selectAll('.ready-path-nodes').classed('ready-path-nodes', false);
                    let selected_instances = that.render_nodes();
                    const selectedInstances = {'instances': selected_instances, 'startId': 'mapper-path', 'path-nodes': path};
                    that.setSelectedInstances(selectedInstances);
                  })
                  .catch(function (error) {
                    console.log(error);
                  });
            }
        })
        .on('mouseover', function(_, d){
            const id=d.id;
            let selected_num = that.selected_nodes.length;
            if(selected_num===1){ // test if there is a path
                d3.select(this).select(`#nodeCircle-${id}`).classed('first-select-node', true);
                axios.post(api, {
                    "node1": that.selected_nodes[0],
                    "node2": id,
                  })
                  .then(function (response) {
                    let path = response.data.data;
                    if(path.length===0) return;
                    that.svg.selectAll('.first-select-node').classed('first-select-node', false);
                    for (let i = 0; i < path.length; i++) {
                        that.svg.select(`#nodeCircle-${path[i]}`).classed('ready-path-nodes', true);
                    }
                  })
                  .catch(function (error) {
                    console.log(error);
                  });
            }
        })
        .on('mouseout', function(_, d){
            const id=d.id;
            let selected_num = that.selected_nodes.length;
            if(selected_num===1&&!that.selected_nodes.includes(id)){
                // d3.select(this).select(`#nodeCircle-${id}`).classed('first-select-node', false);
                that.svg.selectAll('.first-select-node').classed('first-select-node', false);
                that.svg.selectAll('.ready-path-nodes').classed('ready-path-nodes', false);
                that.svg.select(`#nodeCircle-${that.selected_nodes[0]}`).classed('first-select-node', true);
            }
        })
    }


    setEdges(flag){ // select an edge, only once, highlight two connected nodes and the edge
        let that = this;
        if(!flag) {
            this.edgesGroup.selectAll('.single-edge').on('click', null).classed('selected-edge', false);
            that.nodesGroup.selectAll('.single-node-group')
                        .selectAll('.node-background-circle')
                        .classed('selected-edge-nodes', false);
            return;
        }
        this.nodesGroup.selectAll('.single-node-group') // disable the node selection
            .on('click', null)
            .on('mouseover', null);
        this.edgesGroup.selectAll('.single-edge')
            .on('click', function(_, d){
                console.log('click edge', d);
                const edge = d3.select(this);
                const isSelected = edge.classed('selected-edge'); //             .attr("stroke", grey[400])
                // Restore if already selected
                if (isSelected) {
                    edge.classed('selected-edge', false); 
                    that.selected_nodes = [];
                    that.render_nodes();
                    that.nodesGroup.selectAll('.single-node-group')
                        .selectAll('.node-background-circle')
                        .classed('selected-edge-nodes', false); 
                    const selectedInstances = {'instances': [], 'startId': 'reset'};
                    that.setSelectedInstances(selectedInstances);
                } else {
                    // Highlight the edge and the two connected nodes
                    that.edgesGroup.selectAll('.single-edge').classed('selected-edge', false);
                    edge.classed('selected-edge', true);
                    // Highlight the two connected nodes
                    const end_nodes = [d.source.id, d.target.id]; 
                    that.selected_nodes = end_nodes;
                    that.render_nodes();
                    that.nodesGroup.selectAll('.single-node-group')
                        .selectAll('.node-background-circle')
                        .classed('selected-edge-nodes', function(nodeData) {
                            return end_nodes.includes(nodeData.id);
                        }); 
                    // get the intersection of vertices ids in the two nodes
                    const vertices1 = that.svg.select(`#group${end_nodes[0]}`).datum().vertices;
                    const vertices2 = that.svg.select(`#group${end_nodes[1]}`).datum().vertices;
                    const commonElements = vertices1.filter(item => vertices2.includes(item));
                    const selectedInstances = {'instances': commonElements, 'startId': 'mapper-edge', 'nodePair': end_nodes};
                    that.setSelectedInstances(selectedInstances);
                }
            });
    }


    setLoop(flag){
        if(flag){this.setPath(true, true);}
    }

    // click a node, set this node as focus, then highlight the reference node
    click_node(nodeData){
        let node_id = nodeData.id; 
        let isCompare = this.comparisonStatus.isCompare;
        let compareInstances = this.comparisonStatus.compareInstances;
        // click the same node again, no change
        if(this.selected_nodes[0]===node_id&&this.selected_nodes.length===1) return;
        // click the first node, or click another node under no comparison mode
        // comparison mode is allowed only when one node is already selected
        if(!isCompare){ // not comparison mode, only one node is selected
            this.selected_nodes = [node_id]   // every time only one node is selected
            let selected_instances = this.render_nodes();
            const selectedInstances = {'instances': selected_instances, 'startId': 'mapper-node', 'nodeId': node_id};
            this.setSelectedInstances(selectedInstances);
            return;
        }
        else{
            if(compareInstances.length===1){return} // already selected one comparison node, do nothing
            // click the second node, make it to be dashed
            this.render_comparison_nodes([node_id]);
            let newComparisonStatus = {'isCompare': isCompare, 'compareInstances': [node_id]};
            this.comparisonStatus = newComparisonStatus;
            this.setComparisonStatus(newComparisonStatus);
        }
    } 

    // select or deselect the component, for now, only allow one selection
    click_components(nodeData){
        let that = this;
        const node_id = nodeData.id; 
        if(this.selected_nodes.includes(node_id)){ // select a node in the selected component
            that.haloNode = (that.haloNode === node_id) ? null : node_id;
            that.setHaloInstances([]);
            that.nodesGroup.selectAll('.node-background-circle')
                .classed('halo-effect', d => {
                    let isHalo = d.id === that.haloNode;
                    if(isHalo) that.setHaloInstances(d.vertices);
                    return isHalo;
                });
        }
        else{// select a new component 
            let isCompare = this.comparisonStatus.isCompare;
            let compareInstances = this.comparisonStatus.compareInstances;
            axios.post('/api/click_select_component', {
                "name": node_id,
              })
              .then(function (response) {
                if(isCompare){
                    console.log('compareInstances in a selected component', compareInstances);
                    // I assume that one component has been selected, add this one to the comparison
                    if(compareInstances.length>0){return} // already selected one comparison component, do nothing
                    let selected_nodes = response.data.component;
                    that.render_comparison_nodes(selected_nodes);
                    let newComparisonStatus = {'isCompare': isCompare, 'compareInstances': selected_nodes};
                    that.comparisonStatus = newComparisonStatus;
                    that.setComparisonStatus(newComparisonStatus);
                }
                else{
                    that.clearHighlight();
                    that.selected_nodes = response.data.component;
                    let selected_instances = that.render_nodes();
                    const selectedInstances = {'instances': selected_instances, 'startId': 'mapper-component', 'nodeIdList': that.selected_nodes};
                    that.setSelectedInstances(selectedInstances);
                }
              })
              .catch(function (error) {
                console.log(error);
              });
        }
    }

    // render nodes where you directly select in this view
    // return the selected instances
    render_nodes(){ 
        let that = this;
        let empty = this.selected_nodes.length===0;
        this.svg.selectAll('.first-select-node').classed('first-select-node', false);
        this.svg.selectAll('.ready-path-nodes').classed('ready-path-nodes', false);
        this.nodesGroup.selectAll('.single-node-group').each(function(data) {
            let id = data.id;
            if(that.selected_nodes.includes(id)){d3.select(this).raise();}
            const nodeEncoder = d3.select(this).select(`#node-encoder-${id}`);
            if(!nodeEncoder.empty()) {
                // For pie charts, set opacity on path elements; for circles, set on the element itself
                const paths = nodeEncoder.selectAll('path');
                if(!paths.empty()) {
                    // Pie chart: set opacity on path elements
                    paths.attr('fill-opacity', (empty)||that.selected_nodes.includes(id)? 1: 0.3);
                } else {
                    // Color circle: set opacity on the circle element
                    nodeEncoder.attr('fill-opacity', (empty)||that.selected_nodes.includes(id)? 1: 0.3);
                }
            }
            d3.select(this)
                .select(`#node-label-${id}`)
                .text((empty)||!that.selected_nodes.includes(id)? "":data['vertices'].length); 
            d3.select(this)
                .select('.node-background-circle')
                .style('stroke', (empty)||!that.selected_nodes.includes(id)? "white": "black")
                .style('stroke-dasharray', null);
        });

        // return instances, the setSelectedInstances; // {"instances": [], "startId": ""}
        let instances = [];
        this.selected_nodes.forEach((d)=>{
            let vertices = this.svg.select(`#group${d}`).datum().vertices;
            instances = instances.concat(vertices);
        });
        instances =Array.from(new Set(instances)); 
        return instances;
    }

    render_comparison_nodes(selected_nodes){
        // only render the comparison nodes after the main nodes are alredy selected
        let that = this;
        this.svg.selectAll('.first-select-node').classed('first-select-node', false);
        this.svg.selectAll('.ready-path-nodes').classed('ready-path-nodes', false);
        this.nodesGroup.selectAll('.single-node-group').each(function(data) {
            let id = data.id;
            if(selected_nodes.includes(id)){d3.select(this).raise();}
            if(selected_nodes.includes(id)){
                d3.select(this)
                    .select(`#node-encoder-${id}`)
                    // .selectAll('path')
                    .attr('fill-opacity', 1); 
                d3.select(this)
                    .select(`#node-label-${id}`)
                    .text(data['vertices'].length); 
                d3.select(this)
                    .select('.node-background-circle')
                    .style('stroke', "black")
                    .style('stroke-dasharray', "4,2");
            }
        });
    }
}