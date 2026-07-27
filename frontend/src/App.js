import React, { useEffect } from 'react';
import MapperGraph from './MapperGraph/MapperGraph';
import ProjectionPlot from './projection';
import ProjectionContainer from './ProjectionContainer/ProjectionContainer';
import SideBar from './SideBar/SideBar';
import MapperContainer from './MapperContainer/MapperContainer';
import LoadingOverlay from './LoadingOverlay/LoadingOverlay';
import VisualEncoderPanel from './VisualEncodingPanel/VisualEncoderPanel';
import Title from './components/Title';
import { useAppStore } from './store/useAppStore';

// Initialize global objects
export const mapperGraph = new MapperGraph();
export const projectionPlot = new ProjectionPlot();

export default function App() {
  const loadingAttr = useAppStore((state) => state.loadingAttr);
  const fetchInitialData = useAppStore((state) => state.fetchInitialData);
  const fetchDataOnSwitch = useAppStore((state) => state.fetchDataOnSwitch);
  const timestamp = useAppStore((state) => state.timestamp);
  const layer = useAppStore((state) => state.layer);
  const currentLgdAttr = useAppStore((state) => state.currentLgdAttr);

  // Fetch initial data on component mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch data when timestamp or layer changes
  useEffect(() => {
    if (!loadingAttr) {
      fetchDataOnSwitch();
    }
  }, [timestamp, layer]);

  // Update visualizations when legend attribute changes
  useEffect(() => {
    projectionPlot.updatePointsByLegend(currentLgdAttr);
    mapperGraph.updateNodesByLegend(currentLgdAttr);
  }, [currentLgdAttr]);

  if (loadingAttr) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay />
      <Title />

      <div className='left-container'>
        <ProjectionContainer />
        <VisualEncoderPanel />
      </div>

      <div className='middle-container'>
        <MapperContainer />
      </div>

      <div className='right-container'>
        <SideBar />
      </div>
    </>
  );
} 