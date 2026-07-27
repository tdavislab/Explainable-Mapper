import React from "react";
import { useAppStore } from "../store/useAppStore";
import "./LoadingOverlay.css";

const LoadingOverlay = () => {
  const { loading } = useAppStore();
  
  if (!loading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading data...</div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
