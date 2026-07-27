import * as d3 from 'd3';

// ----------------- Dragging Functions for force simulation -----------------
// Reheat the simulation when drag starts, and fix the subject position.
export function dragstarted(event, simulation) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

// Update the subject (dragged node) position during drag.
export function dragged(event, simulation) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

// Restore the target alpha so the simulation cools after dragging ends.
// Unfix the subject position now that it’s no longer being dragged.
export function dragended(event, simulation) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
} 


// ----------------- dragging functions for anchored layout -----------------
export function dragstartedAnchor(event, pointCoord) {
    const [x, y] = pointCoord(event);
    d3.select(this).attr("transform", `translate(${x},${y})`);
}

export function draggedAnchor(event, d, edgesGroup, pointCoord) {
    const [x, y] = pointCoord(event);
    d3.select(this).attr("transform", `translate(${x},${y})`);
    edgesGroup.each(function (linkD) {
        if (linkD.source.id === d.id) {
            d3.select(this).attr("x1", x).attr("y1", y);
        }
        if (linkD.target.id === d.id) {
            d3.select(this).attr("x2", x).attr("y2", y);
        }
    });
} 

export function dragendedAnchor(xyScaleX, xyScaleY, edgesGroup) {
    d3.select(this).transition().duration(500)
        .attr("transform", d=>`translate(${xyScaleX(d.x)}, ${xyScaleY(d.y)})`); 
    edgesGroup.transition().duration(500)
        .attr("x1", d => xyScaleX(d.source.x))
        .attr("y1", d => xyScaleY(d.source.y))
        .attr("x2", d => xyScaleX(d.target.x))
        .attr("y2", d => xyScaleY(d.target.y));
}