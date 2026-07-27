import React from 'react';
import { useEffect, useRef, useState } from "react";
import Paper from '@mui/material/Paper';
import axios from "axios";
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import {PathIcon} from '../svgicons/ManualIcons';
import HubIcon from '@mui/icons-material/Hub'; 
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import Tooltip from '@mui/material/Tooltip';
import { mapperGraph } from "../App";
import { useAppStore } from "../store/useAppStore";
import { grey} from '@mui/material/colors';
import InputLabel from '@mui/material/InputLabel';
import './MapperContainer.css';
import { Typography } from '@mui/material';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircleTwoToneIcon from '@mui/icons-material/CircleTwoTone';

export default function MapperContainer(){
    return (
        <>
        <Paper elevation={2}>
            <MapperView></MapperView>
        </Paper>
        <Paper elevation={0}>
            <MapperToolBar></MapperToolBar>
        </Paper>
        </>
    );
}

// mapper view
function MapperView(){ 
    const firstRender = useRef(true);
    const mapperDOM = useRef();
    const {selectedInstances, setSelectedInstances, selectedPerturbPoints, 
        viewMode, legendInfo, mapperUpd, dataSwitchSignal,
        haloInstances, setHaloInstances,
        currentLgdAttr, layout,
        comparisonStatus, setComparisonStatus,
        nodeSizeAttr, edgeWidthAttr, setLoading} = useAppStore();  // {"instances": [], "startId": ""}
    const [isMapperReady, setIsMapperReady] = useState(false); 
    const initialized = useRef(false); // distinguish if the mapper object has been initialized
    const setEpsValue = useAppStore((state) => state.setEpsValue);
    const setBallEpsValue = useAppStore((state) => state.setBallEpsValue);
    const mapperType = useAppStore((state) => state.mapperType);

    useEffect(()=>{
        initialized.current = false
    }, [dataSwitchSignal])

    // when visual encoding of nodes and edges are changed, update the mapper
    useEffect(()=>{
        mapperGraph.updateVisualEncoding(nodeSizeAttr, edgeWidthAttr);
    }, [nodeSizeAttr, edgeWidthAttr]);

    useEffect(()=>{
        setLoading(true);
        axios.post('/api/mapper_data', {
            "layout": layout
        })
          .then(function (response) {
                        const graphData = response.data['graph_data'];
            const epsVal = response.data['eps_val'];
            // update the mappe graph
            mapperGraph.initialize(mapperDOM.current, graphData, 
                setSelectedInstances, selectedPerturbPoints,
                setComparisonStatus,
                setHaloInstances,
                legendInfo, currentLgdAttr,
                nodeSizeAttr, edgeWidthAttr);
            mapperGraph.drawMapper(layout);
            initialized.current = true;
            // Always update colors after initialization to ensure latest legendInfo is used
            mapperGraph.updateCategoryColor(legendInfo);
            // update the eps value
            if(mapperType == 'classicalMapper'){
                setEpsValue(epsVal);
            }
            else{
                setBallEpsValue(epsVal);
            }
            setLoading(false);
            // if(!initialized.current){ // the first time to initialize the mapper
            //     mapperGraph.initialize(mapperDOM.current, response.data, setSelectedInstances, 
            //     legendInfo, currentLgdAttr, nodeSizeAttr, edgeWidthAttr);
            //     initialized.current = true;
            // }
            // else{
            //   mapperGraph.initialize(mapperDOM.current, response.data, setSelectedInstances, 
            //     legendInfo, layout, currentLgdAttr);
            // }
          })
          .catch(function (error) {
            console.error(error);
            setLoading(false);
          });   // TODO: mapper updates a lot 
    }, [layout, mapperUpd]); // mapperParasUpd: mapper parameter change, layout: layout change 

    useEffect(()=>{
        if (!initialized.current) return; // ensure the mapper is initialized
        if(selectedInstances['startId']=='perturb_for_r_project'){return;}
        // Don't call highlightCorrespondances if selection is from mapper view itself
        // This prevents overriding the opacity set by render_nodes() in InteractionHandler
        if(selectedInstances['startId'] && selectedInstances['startId'].includes('mapper')){return;}
        mapperGraph.highlightCorrespondances(selectedInstances);
    }, [selectedInstances]);

    // Update colors when legendInfo changes (skips redraw if only counts changed).
    // Re-apply external selection in case pies were regenerated (e.g. color remap).
    useEffect(() => {
        if (!initialized.current) return;
        mapperGraph.updateCategoryColor(legendInfo);
        if(
            selectedInstances['startId'] &&
            selectedInstances['startId'] !== 'perturb_for_r_project' &&
            !selectedInstances['startId'].includes('mapper')
        ){
            mapperGraph.highlightCorrespondances(selectedInstances);
        }
    }, [legendInfo]);

    useEffect(()=>{
        if(!initialized.current){return;}
        mapperGraph.setMode(viewMode);
    }, [viewMode]);

    // highlight perturb points
    useEffect(()=>{
        if (!initialized.current) return; // Ensure projection is ready before highlighting
        mapperGraph.highlightPerturbPoints(selectedPerturbPoints);
    }, [selectedPerturbPoints]); 

    return <div className='mapper-container' ref={mapperDOM}></div>
}

// mapper editing bar
function MapperToolBar(){
    const {viewMode, setViewMode, setSelectedInstances} = useAppStore(); 
    const [isComponentOverlay, setIsComponentOverlay] = useState(false); // State for the switch
    const [isNodeKeywordsOverlay, setIsNodeKeywordsOverlay] = useState(false); // State for the switch
    const highlightColor = grey[900]; 
    
    const handleClick = (selectedMode) => {
        if(viewMode==selectedMode){setViewMode('null');}
        else{setViewMode(selectedMode);}
        setSelectedInstances({"instances": [], "startId": "reset"});
    };

    const handleSwitchChange = (event) => {
        setIsComponentOverlay(event.target.checked); // Update the state based on the switch
    };
    const handleSwitchChange2 = (event) => {
        setIsNodeKeywordsOverlay(event.target.checked); // Update the state based on the switch
    };

    useEffect(()=>{ 
        if(!mapperGraph.isInitialized) return; // Ensure the mapper is initialized
        if(isComponentOverlay){
            axios.post('/api/get_components_keywords')
                .then(function (response) {
                    mapperGraph.showComponentOverlay(response.data);
                })
                .catch(function (error) {
                    console.error('Error fetching components:', error);
                });
        }
        else{
            mapperGraph.hideComponentOverlay();
        }
    }, [isComponentOverlay]); 

    useEffect(()=>{
        if(!mapperGraph.isInitialized) return; // Ensure the mapper is initialized
        if(isNodeKeywordsOverlay){
            axios.post('/api/get_nodes_keywords')
                .then(function (response) {
                    mapperGraph.showNodesLabelOverlay(response.data);
                })
                .catch(function (error) {
                    console.error('Error fetching node keywords:', error);
                });
        }
        else{
            mapperGraph.hideNodesLabelOverlay();
        }
    }
    , [isNodeKeywordsOverlay]);



    return (
    <>
        <div className='mapper-tool-bar'>
            <LayoutSelect></LayoutSelect>
            <>
        <Typography variant="body1">Selection Mode: &nbsp; </Typography>
         <ToggleButtonGroup
            value={viewMode}
            size='small'
            exclusive
            onChange={(event, newValue) => {
                if (newValue !== null) {
                    handleClick(newValue);
                }
            }}
            sx={{height: "30px",}}
        >
             <Tooltip title="Select a Piont">
            <ToggleButton size='small' value="mapper-points"
                onClick={()=>handleClick(`mapper-points`)}>
                <CircleTwoToneIcon 
                    sx={{
                        fontSize: "13px"
                    }} />
                &nbsp; Node
            </ToggleButton>
            </Tooltip> 

            <Tooltip title="Select an Edge">
            <ToggleButton size='small' value="mapper-edge"
                onClick={()=>handleClick(`mapper-edge`)}>
                <HorizontalRuleIcon 
                     sx={{
                        fontSize: '13px'
                    }} />
                &nbsp; Edge
            </ToggleButton>
            </Tooltip> 

            <Tooltip title="Select a Path">
            <ToggleButton size='small' value={"mapper-path"}
                onClick={()=>handleClick(`mapper-path`)}>
                <PathIcon 
                    sx={{ 
                        fill: viewMode==`mapper-path`? highlightColor:"grey",
                        stroke: viewMode==`mapper-path`? highlightColor:"grey",
                        fontSize: "13px"
                    }} />
                &nbsp; Path
            </ToggleButton>
            </Tooltip>

            <Tooltip title="Select a Component">
            <ToggleButton size='small' value={"mapper-components"}
                onClick={()=>handleClick(`mapper-components`)}>
                <HubIcon 
                    sx={{
                        fontSize: '13px'
                    }} />
                &nbsp; Component
            </ToggleButton>
            </Tooltip>

        </ToggleButtonGroup>
        </>

           
            {/* <Tooltip title="Select Loops">
            <IconButton aria-label="delete" size='small' onClick={()=>handleClick(`mapper-loop`)}>
                <LoopIcon 
                    sx={{
                        fill: viewMode==`mapper-loop`? highlightColor:"grey", 
                        stroke: viewMode==`mapper-loop`? highlightColor:"grey",  
                        fontSize: "15px"
                        }} />
            </IconButton>
            </Tooltip> */}
        </div>

        {/* <div className='mapper-tool-bar'>
            <FormControlLabel
                control={
                    <Switch
                        checked={isComponentOverlay}
                        onChange={handleSwitchChange}
                        // color="primary"
                    />
            }
                label="Component Overlay"
                labelPlacement="end"
            />
            <FormControlLabel
                control={
                    <Switch
                        checked={isNodeKeywordsOverlay}
                        onChange={handleSwitchChange2}
                        // color="primary"
                    />
            }
                label="Node Keywords"
                labelPlacement="end"
            />
        </div> */}

    </>
    )
}

// mapper graph layout selection
function LayoutSelect() {
    const {layout, setLayout} = useAppStore();
    
    const handleChange = (event) => {
      setLayout(event.target.value); 
    };
  
    return (
      <>
      <InputLabel> <Typography variant="body1" sx={{color: 'black'}}>Layout:</Typography></InputLabel>
      <FormControl 
          variant="standard"
          style={{marginRight: "auto"}}
          sx={{ m: 1, 
              minWidth: 50,
              margin: "0 0 0 2px",
          }}
          size="small">
        <Select
          labelId="demo-select-small-label"
          id="demo-select-small" 
          sx={{
              fontSize: "16px",
              '& .MuiSelect-select': {padding: "2px 3px", 
                  borderBottom: "0px solid red"
              },
              "&:before": {
                  borderWidth: "0px"
              },
              "&:after": {
                  borderWidth: "0px"
              }
  
          }}
          value={layout}
          label="layout"
          onChange={handleChange}
        >
          <MenuItem value={'ForceDirected'}>Force Directed</MenuItem>
          <MenuItem value={'AnchorCenter'}>Anchored Layout</MenuItem>
          {/* <MenuItem value={'AnchorReproject'}>Anchored Layout (reprojection)</MenuItem> */}
        </Select>
      </FormControl>
      </>
    );
  }

  