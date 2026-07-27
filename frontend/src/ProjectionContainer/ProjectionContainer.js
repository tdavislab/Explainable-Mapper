import '../index.css'
import React, { createContext, useEffect, useState, useRef} from 'react';
import IconButton from '@mui/material/IconButton';
import {PointsIcon, PathIcon, LoopIcon, LassoIcon} from '../svgicons/ManualIcons';
import CropOutlinedIcon from '@mui/icons-material/CropOutlined';
import HubIcon from '@mui/icons-material/Hub';
import Tooltip from '@mui/material/Tooltip';
import AdsClickOutlinedIcon from '@mui/icons-material/AdsClickOutlined';
import { blueGrey, blue, grey} from '@mui/material/colors';
import { projectionPlot } from '../App';
import { useAppStore } from '../store/useAppStore';
import './ProjectionContainer.css'
import axios from 'axios'
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import * as d3 from "d3";


export const MapperProjectionContext = createContext();


export default function ProjectionContainer(){
    return (
        <div className='projection-container'>
            <ProjectionToolBar></ProjectionToolBar>
            <ProjectionView></ProjectionView>
        </div>
    );
}

function ProjectionToolBar(){
    const {viewMode, setViewMode, 
        setSelectedInstances, 
        DRmethod, setDRmethod} = useAppStore(); 

    const handleClick = (selectedMode) => {
        if(viewMode === selectedMode){
            setViewMode('null');
        } else {
            setViewMode(selectedMode);
        }
        let newSelection = {"instances": [], "startId": "reset"};
        setSelectedInstances(newSelection); // reset everything
    };

    const handleDRChange = (event) => {
        setDRmethod(event.target.value);
    };

    const highlightColor = grey[900];

    return (
        <div className='projection-tool-bar'>
            {/* dimenson reduction method */}
            <InputLabel sx={{ fontSize: '13px' }}>Projection:</InputLabel>
            <FormControl 
                variant="standard"
                style={{marginRight: "auto"}}
                sx={{ m: 1, minWidth: 50, margin: "2px 0 0 2px" }}
                size="small">
                <Select
                    labelId="demo-select-small-label"
                    id="demo-select-small" 
                    sx={{
                        fontSize: "13px",
                        '& .MuiSelect-select': {padding: "2px 3px", borderBottom: "0px solid red"},
                        "&:before": {borderWidth: "0px"},
                        "&:after": {borderWidth: "0px"}
                    }}
                    value={DRmethod}
                    label="DM"
                    onChange={handleDRChange}
                >
                    <MenuItem value={'PCA'}>PCA</MenuItem>
                    <MenuItem value={'UMAP'}>UMAP</MenuItem>
                    {/* <MenuItem value={'TSNE'}>TSNE</MenuItem>
                    <MenuItem value={'MDS'}>MDS</MenuItem> */}
                </Select>
            </FormControl>
            {/* three types of selection */}
            <Tooltip title="Click">
                <IconButton aria-label="click" size='small' onClick={() => handleClick(`projection-points`)} sx={{ padding: '2px' }}>
                    <AdsClickOutlinedIcon fontSize='inherit' 
                        sx={{
                            fontSize: '16px',
                            fill: viewMode === `projection-points` ? highlightColor : "grey"
                        }} 
                    />
                </IconButton>
            </Tooltip>
            <Tooltip title="Lasso">
                <IconButton aria-label="delete" size='small' onClick={() => handleClick(`projection-lasso`)} sx={{ padding: '2px' }}>
                    <LassoIcon fontSize='inherit' 
                        sx={{
                            fontSize: '16px',
                            fill: viewMode === `projection-lasso` ? highlightColor : "grey"
                        }} 
                    />
                </IconButton>
            </Tooltip>
            <Tooltip title="Brush">
                <IconButton aria-label="delete" size='small' onClick={() => handleClick(`projection-brush`)} sx={{ padding: '2px' }}>
                    <CropOutlinedIcon fontSize='inherit' 
                        sx={{
                            fontSize: '16px',
                            fill: viewMode === `projection-brush` ? highlightColor : "grey"
                        }} 
                    />
                </IconButton>
            </Tooltip>
        </div>
    );
}

function ProjectionView(){
    const {selectedInstances, setSelectedInstances, 
        viewMode, dataSwitchSignal,
        legendInfo, currentLgdAttr, 
        setLoading, projectionUpd,
        meanL2Range, perturbPoints,
        DRmethod,
        selectedPerturbPoints, setSelectedPerturbPoints} = useAppStore();  // {"instances": [], "startId": ""}

    const projectionDOM = useRef(); // the reference of this div
    const initialized = useRef(false); // distinguish if the projection object has been initialized
    const [isProjecting, setIsProjecting] = useState(false);
    const [projectionError, setProjectionError] = useState('');

    useEffect(()=>{
        initialized.current = false
    }, [dataSwitchSignal])

    useEffect(()=>{
        let cancelled = false;
        const useGlobalLoading = !initialized.current;
        setProjectionError('');
        setIsProjecting(true);
        if (useGlobalLoading) {
            setLoading(true);
        }

        axios.post('/api/projection_data', {
            "DM": DRmethod,
        }, {
            timeout: 120000,
        })
        .then(function (response) {
            if (cancelled) return;
            let projectData = response.data;
            if (typeof projectData === 'string') {
                projectData = JSON.parse(projectData);
            }
            if (!Array.isArray(projectData)) {
                throw new Error(projectData?.error || 'Invalid projection response');
            }

            if(!initialized.current){
                projectionPlot.initialize(projectionDOM.current, projectData, legendInfo, setSelectedInstances, 
                    currentLgdAttr, meanL2Range, setSelectedPerturbPoints); 
                initialized.current = true;
            } else {
                projectionPlot.updateProjection(projectData);
            }
            // Always update colors after data loads to ensure latest legendInfo is used
            projectionPlot.updateCategoryColor(legendInfo);
        })
        .catch(function (error) {
            if (cancelled) return;
            console.error(error);
            const message = error.response?.data?.error || error.message || 'Projection failed';
            setProjectionError(message);
        })
        .finally(() => {
            if (cancelled) return;
            setIsProjecting(false);
            if (useGlobalLoading) {
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [DRmethod, projectionUpd]);

    useEffect(()=>{
        if (!initialized.current) return; // ensure the projection is initialized
        if (selectedInstances['startId'] === "") return; 
        if (selectedInstances['startId']=='perturb_for_r_project'){  // only work for perturbation 
            projectionPlot.highlight_instances(selectedInstances);
            return;
        }
        projectionPlot.highlight_instances(selectedInstances);
    }, [selectedInstances]);  

    // Update colors when legendInfo changes
    useEffect(() => {
        if (!initialized.current) return;
        projectionPlot.updateCategoryColor(legendInfo);
    }, [legendInfo]);

    useEffect(()=>{
        if(!initialized.current) return; 
        projectionPlot.setMode(viewMode);
    }, [viewMode]);  

    // drawPerturbPoints
    useEffect(()=>{
        if (!initialized.current) return; // Ensure projection is ready before highlighting
        projectionPlot.drawPerturbPoints(perturbPoints);
    }, [perturbPoints]); 

    // highlight perturb points
    useEffect(()=>{
        if (!initialized.current) return; // Ensure projection is ready before highlighting
        projectionPlot.highlightPerturbPoints(selectedPerturbPoints);
    }, [selectedPerturbPoints]); 


    // useEffect(()=>{
    //     if(firstRender.current){
    //         firstRender.current=false;
    //         return;
    //     }
    //     axios.post('/api/projection_data', {
    //         "DM": DRmethod,
    //     })
    //       .then(function (response) {
    //         projectRef.current = new Projection(projectionDOM.current,  response.data, legendInfo, setSelectedInstances, 
    //              currentLgdAttr, meanL2Range, setSelectedPerturbPoints); 
    //         setIsProjectionReady(true);
    //         if(prevDRmethod.current!==DRmethod && layout==='AnchorCenter'){
    //             prevDRmethod.current = DRmethod;
    //             setMapperUpdSignal((prev)=>!prev);
    //         }
    //       })
    //       .catch(function (error) {
    //         console.log(error);
    //       });
    // }, [projectionUpdSignal]);

    // useEffect(()=>{
    //     if (!isProjectionReady) return; // Ensure mapper is ready before highlighting
    //     if (selectedInstances['startId'] === "") return; 
    //     if (selectedInstances['startId']=='perturb_for_r_project'){  // only work for perturbation 
    //         projectRef.current.highlight_instances(selectedInstances);
    //         return;
    //     }
    //     console.log(selectedInstances);

    //     if (projectRef.current) {
    //         projectRef.current.highlight_instances(selectedInstances);
    //       } else {
    //         console.error("mapperObj or highlight_correspondances method is not available");
    //       }
    // }, [selectedInstances, isProjectionReady]); 



    // the meanL2Range update and currentLgdAttr is L2, then update mapper
    // useEffect(()=>{
    //     if(!initialized.current) return; 
    //     // if(currentLgdAttr!=='Average-L2-norm') return;
    //     projectionPlot.redrawPoints(currentLgdAttr, meanL2Range);
    // }, [meanL2Range, currentLgdAttr]);

    return (
        <div className='projection-view' ref={projectionDOM}>
            {isProjecting && (
                <div className='projection-computing-overlay'>
                    Computing {DRmethod}…
                </div>
            )}
            {projectionError && !isProjecting && (
                <div className='projection-error-banner'>
                    {projectionError}
                </div>
            )}
        </div>
    );
}


