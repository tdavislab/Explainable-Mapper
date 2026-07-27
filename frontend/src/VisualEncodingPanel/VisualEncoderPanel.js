import * as React from 'react';
import { useEffect, useState } from 'react';
import '../index.css';
import Legend from './Legend';
import './VisualEncoderPanel.css'
import axios from 'axios';
import DropdownSelect from '../UtilComponents/DropdownSelect';
import { mapperGraph } from '../App';
import { useAppStore } from '../store/useAppStore';


export default function VisualEncoderPanel() {  
  const nodeSizeAttr = useAppStore((state) => state.nodeSizeAttr);
  const edgeWidthAttr = useAppStore((state) => state.edgeWidthAttr);
  const setNodeSizeAttr = useAppStore((state) => state.setNodeSizeAttr);
  const setEdgeWidthAttr = useAppStore((state) => state.setEdgeWidthAttr);
  const layer = useAppStore((state) => state.layer);
  
  const [legendDataReady, setLegendDataReady] = useState(false);
  const [overlayName, setOverlayName] = useState('none');

  useEffect(()=>{
    // Legend info is already fetched in the main App component
    // and passed down through context, so we just need to set ready state
    setLegendDataReady(true);
  }, []);

  // Clear annotations when layer changes
  useEffect(() => {
    if (overlayName !== 'none') {
      // Re-fetch annotations for the new layer
      handleOverlayChange(overlayName);
    }
  }, [layer]); 


  const handleOverlayChange = (selectedOverlay) => {
    setOverlayName(selectedOverlay);
    if (selectedOverlay === 'none') {
      mapperGraph.hideComponentOverlay();
      mapperGraph.hideNodesLabelOverlay();
    } else if (selectedOverlay === 'component') {
      mapperGraph.hideNodesLabelOverlay();
      // Add a small delay to ensure hiding completes before showing new annotations
      setTimeout(() => {
        axios.post('/api/get_components_keywords')
                  .then(function (response) {
                      mapperGraph.showComponentOverlay(response.data);
                  })
                  .catch(function (error) {
                      console.log('Error fetching components:', error);
                  });
      }, 10);
    }
    else if (selectedOverlay === 'node') {
      mapperGraph.hideComponentOverlay();
      // Add a small delay to ensure hiding completes before showing new annotations
      setTimeout(() => {
        axios.post('/api/get_nodes_keywords')
                  .then(function (response) {
                      mapperGraph.showNodesLabelOverlay(response.data);
                  })
                  .catch(function (error) {
                      console.log('Error fetching node keywords:', error);
                  });
      }, 10);
    }
  }


  return (
    legendDataReady&&(
    <div className='visual-enconding-container'>      
        {/* captions */}
        <Legend></Legend>
        <VisualEncode nodeSize={nodeSizeAttr} 
          setNodeSize={setNodeSizeAttr} 
          overlapCount={edgeWidthAttr}
          setOverlapCount={setEdgeWidthAttr}
          overlayName={overlayName}
          handleOverlayChange={handleOverlayChange}
          ></VisualEncode>
        {/* edge node encoding */}
    </div>)
  );
}

const VisualEncode = ({nodeSize, setNodeSize, overlapCount, setOverlapCount, overlayName, handleOverlayChange}) => {
  return (
    <>
      <DropdownSelect
        label="Node Size:"
        value={nodeSize}
        onChange={(e) => setNodeSize(e.target.value)}
        options={[
          { value: 'instance-count', label: 'Instance count' },
          { value: 'none', label: 'None' },
        ]}
      />
      <DropdownSelect
        label="Edge Width:"
        value={overlapCount}
        onChange={(e) => setOverlapCount(e.target.value)}
        options={[
          { value: 'jaccard-sim', label: 'Jaccard Similarity' },
          { value: 'none', label: 'None' },
        ]}
      />
      <DropdownSelect
        label="Annotation:"
        value={overlayName}
        onChange={(e)=>handleOverlayChange(e.target.value)}
        options={[
          { value: 'node', label: 'Node' },
          { value: 'component', label: 'Component' },
          { value: 'none', label: 'None' },
        ]}
      />
    </>
  );
}

// const Annotation