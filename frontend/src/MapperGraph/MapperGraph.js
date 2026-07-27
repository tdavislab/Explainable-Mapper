import * as d3 from "d3";
import { GraphRenderer } from './GraphRenderer';
import { InteractionHandler } from './InteractionHandler';
import { OverlayManager } from './OverlayManager';

export default class MapperGraph {
    constructor() {
        this.isInitialized = false;
        this.renderer = null;
        this.interactionHandler = null;
        this.overlayManager = null;
    }

    initialize(div, 
        mapperData, 
        setSelectedInstances,
        selectedPerturbPoints,
        setComparisonStatus,
        setHaloInstances, // instances selected in a selected path or component
        categoryColor, 
        legendAttr,
        nodeSizeAttr,
        edgeWidthAttr) { 
        // 0.initilize everytime the mapper data is updated 
        this.isInitialized = false;
        d3.select(div).selectAll('*').remove();

        // 1. data setup
        this.selectedPerturbPoints = selectedPerturbPoints;
        this.setSelectedInstances = setSelectedInstances;
        this.setComparisonStatus = setComparisonStatus;  //{"isCompare": false, "compareInstances":[]}
        this.setHaloInstances = setHaloInstances;
        this.legendAttr = legendAttr;
        this.mapperData = mapperData;
        this.nodes = this.mapperData.nodes;
        this.links = this.mapperData.links;
        this.links.forEach((link, _)=>{
            link.target = link.target.toString();
            link.source = link.source.toString();
        });

        // 2. svg, group setup, and visual encoding
        this.width = parseInt(d3.select(div).style('width'));
        this.height = parseInt(d3.select(div).style('height'));
        this.svg = d3.select(div)
            .append('svg')
            .attr("viewBox", [-this.width/2, -this.height/2, this.width, this.height])
            .attr("style", "max-width: 100%; height: auto;")
            .attr('width', this.width)
            .attr('height', this.height);
        this.graphSvg_g = this.svg.append("g");
        this.edgesGroup = this.graphSvg_g.append("g")
            .attr("class","graph-link-group");
        this.nodesGroup = this.graphSvg_g.append("g")
            .attr("class","graph-node-group");  
            
        const visualEncoderConfig = {
            "nodeSizeAttr": nodeSizeAttr,
            "edgeWidthAttr": edgeWidthAttr,
            "legendAttr": legendAttr,
            "categoryColor": categoryColor
        };

                this.overlayManager = new OverlayManager(this.graphSvg_g, this.nodesGroup, this.edgesGroup, this.nodes, this.links, this.selectedPerturbPoints);
        
        // Create callback functions for drag events
        const onDragStart = () => {
            // Hide component overlays when drag starts (like zoom behavior)
            if (this.overlayManager && this.overlayManager.componentsOverlay) {
                this.overlayManager.componentsOverlay.style("opacity", 0);
            }
            if (this.overlayManager && this.overlayManager.componentsLabelsOverlay) {
                this.overlayManager.componentsLabelsOverlay.style("opacity", 0);
            }
            // Hide node label overlays when drag starts
            if (this.overlayManager && this.overlayManager.nodesLabelOverlay) {
                this.overlayManager.nodesLabelOverlay.style("opacity", 0);
            }
        };
        
        const onDragEnd = () => {
            // Show component overlays again and regenerate them
            if (this.overlayManager && this.overlayManager.annotationData['componentsData'] !== '') {
                if (this.overlayManager.componentsOverlay) {
                    this.overlayManager.componentsOverlay.style("opacity", 1);
                }
                if (this.overlayManager.componentsLabelsOverlay) {
                    this.overlayManager.componentsLabelsOverlay.style("opacity", 1);
                }
                this.overlayManager.showComponentOverlay(
                    this.overlayManager.annotationData['componentsData'], 
                    this.nodes, 
                    this.interactionHandler.transform.k
                );
            }
            
            // Show node label overlays again and regenerate them
            // Only regenerate if the overlay actually exists (wasn't intentionally hidden)
            if (this.overlayManager && this.overlayManager.nodesAnnotationData['nodesLabelData'] !== '' && this.overlayManager.nodesLabelOverlay) {
                this.overlayManager.nodesLabelOverlay.style("opacity", 1);
                this.overlayManager.showNodesLabelOverlay(
                    this.overlayManager.nodesAnnotationData['nodesLabelData'],
                    this.nodes,
                    this.interactionHandler.transform.k
                );
            }
        };
        
        this.renderer = new GraphRenderer(this.nodesGroup, this.edgesGroup, this.nodes, this.links, visualEncoderConfig, onDragEnd, onDragStart);
        this.interactionHandler = new InteractionHandler(this.svg, this.graphSvg_g, 
            this.nodesGroup, this.edgesGroup, this.setSelectedInstances, 
            this.setHaloInstances, this.setComparisonStatus, this.overlayManager);  
        // synchronize transforms: InteractionHandler will keep renderer.transform updated
        this.interactionHandler.renderer = this.renderer;
        // Set up callback to restore selection state after nodes are regenerated
        this.renderer.onNodesRegenerated = () => {
            if(!this.interactionHandler) return;
            if(this.interactionHandler.selected_nodes.length > 0) {
                this.interactionHandler.render_nodes();
            } else if(this.interactionHandler.lastExternalSelection) {
                // Restore legend/projection dimming after pies are rebuilt
                this.interactionHandler.highlightCorrespondances(
                    this.interactionHandler.lastExternalSelection,
                    this.nodes
                );
            }
        };
    }

    // Delegate tasks to the respective classes
    drawMapper(layout) {
        if (layout === 'ForceDirected') {
            this.renderer.drawForceDirected();
        } else if (layout === 'AnchorCenter') {
            this.renderer.drawAnchored(this.width, this.height);
        }
        this.isInitialized = true;
        this.setMode('null');
    }

    setMode(viewMode) {
        if(!this.isInitialized) return;
        // Changing interaction mode should not cancel an active comparison.
        this.interactionHandler.clearHighlight();
        this.interactionHandler.setZoom(viewMode === 'null');
        this.interactionHandler.setPoints(viewMode === 'mapper-points');
        this.interactionHandler.setComponents(viewMode === 'mapper-components');
        this.interactionHandler.setPath(viewMode === 'mapper-path');
        this.interactionHandler.setEdges(viewMode === 'mapper-edge');
    }

    updateNodesByLegend(legendAttr) {
        if(!this.isInitialized) return;
        this.renderer.updateNodesByLegend(legendAttr);
    } 

    updateCategoryColor(categoryColor) {
        if(!this.isInitialized) return;
        this.renderer.updateCategoryColor(categoryColor);
    }

    updateVisualEncoding(nodeSizeAttr, edgeWidthAttr) {
        if(!this.isInitialized) return;
        this.renderer.updateVisualEncoding(nodeSizeAttr, edgeWidthAttr);    
    }

    highlightCorrespondances(correspondances) {
        if(!this.isInitialized) return;
        this.interactionHandler.highlightCorrespondances(correspondances, this.nodes);
    }

    showComponentOverlay(componentsData) {
        if(!this.isInitialized) return;
        this.overlayManager.showComponentOverlay(componentsData, this.nodes, this.interactionHandler.transform.k);
    }

    hideComponentOverlay() {    
        if(!this.isInitialized) return;
        this.overlayManager.hideComponentOverlay();
    }

    showNodesLabelOverlay(nodesLabelData) {
        if(!this.isInitialized) return;
        this.overlayManager.showNodesLabelOverlay(nodesLabelData, this.nodes, this.interactionHandler.transform.k);
    }
    hideNodesLabelOverlay() {
        if(!this.isInitialized) return;
        this.overlayManager.hideNodesLabelOverlay();
    }

    attachPerturbationLine(mapper_data, setSelectedPerturbPoints) {
        if(!this.isInitialized) return;
        this.overlayManager.attachPerturbationLine(mapper_data, setSelectedPerturbPoints);
    }

    deattachPerturbationLine() {
        if(!this.isInitialized) return;
        this.overlayManager.deattachPerturbationLine(this.renderer.simulation);
    }

    highlightPerturbNodesByIds(perturbIds) {
        if(!this.isInitialized) return;
        this.overlayManager.highlightPerturbNodesByIds(perturbIds);
    }

    dehighlightPerturbNodes() {
        if(!this.isInitialized) return;
        this.overlayManager.dehighlightPerturbNodes();
    }
    // highlight perturb points when the perturb points are selected in the projection view
    highlightPerturbPoints(perturbPoints) {        
        if(!this.isInitialized) return;
        this.overlayManager.highlightPerturbPoints(perturbPoints);
    }

    updateComparisonMode(newComparisonStatus) { // 
        if(!this.isInitialized) return;
        this.interactionHandler.updateComparisonMode(newComparisonStatus);
    }
}