/**
 * The lengend selection panel
 * - dropdown selction view: which attributes to color the node?
 * - the attribute distribution (categorical or continous): selected VS overall
 */
import './VisualEncoderPanel.css'
import React, { useState, useEffect, useRef } from 'react';
import { Typography } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import axios from 'axios';
import Autocomplete from '@mui/material/Autocomplete';
import { grey } from '@mui/material/colors';
import * as d3 from "d3";
import { InputLabel, FormControl, Select, MenuItem, TextField, Tooltip } from '@mui/material';
import { mapperGraph } from '../App';


export default function Legend(){
    const setSelectedInstances = useAppStore((state) => state.setSelectedInstances);
    const setViewMode = useAppStore((state) => state.setViewMode);
    const currentLgdAttr = useAppStore((state) => state.currentLgdAttr);
    const setCurrentLgdAttr = useAppStore((state) => state.setCurrentLgdAttr);
    const datasetName = useAppStore((state) => state.datasetName);
    const layer = useAppStore((state) => state.layer);
    const loading = useAppStore((state) => state.loading);
    const [allTokens, setAllTokens] = useState([{ "label": ''}]);
    const [selectedToken, setSelectedToken] = useState("start"); // null or a token

    const handleCurrentLgdAttr = (event) => {
        setCurrentLgdAttr(event.target.value);
    }; 

    // get allTokens used for the token query [{label: 'token1'}, ...]
    useEffect(()=>{
        // Only fetch when not loading (i.e., after mapper graph has been updated)
        if (!loading) {
            // Add a small delay to ensure backend has fully processed the mapper graph update
            const timer = setTimeout(() => {
                axios.post('/api/get_all_words')
                .then(function(response){
                    setAllTokens(response['data']);
                    // Reset selected token when layer changes since available tokens might be different
                    setSelectedToken("start");
                });
            }, 100); // 100ms delay
            
            return () => clearTimeout(timer); // Cleanup timer on unmount or dependency change
        }
    }, [layer, loading]); // Re-fetch when layer changes and loading completes

    // select a token
    useEffect(()=>{
        if(selectedToken==='start') return;
        let word = selectedToken===null? selectedToken:selectedToken['label']
        setViewMode('null');
        axios.post('/api/select_a_word', {'word': word})
        .then(function(response){
            setSelectedInstances(response['data']);
        })
        .catch(function(error) {
            // If the selected token is not available in current layer, reset it
            console.log('Selected token not available in current layer, resetting...');
            setSelectedToken("start");
        });
    }, [selectedToken]);
    
    return (
        <div className='legend' style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px'}}>
            <div className='word-query-div' style={{ width: '40%', alignSelf: 'flex-start' }}>
                <Autocomplete
                    disablePortal
                    options={allTokens}
                    size='small'
                    value={selectedToken==='start'? null : selectedToken}
                    onChange={(_, newToken) => {
                        setSelectedToken(newToken);
                    }}
                    getOptionLabel={(option)=> option?.label ?? ''}
                    sx={{
                        '& .MuiInputBase-root': { height: '28px' },
                        '& .MuiOutlinedInput-input': { fontSize: '12px', padding: '0 8px' }
                    }}
                    renderOption={(props, option) => (
                        <li {...props}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{option.label}</span>
                                {option.count && (
                                    <span style={{ color: '#666', fontSize: '11px' }}>
                                        ({option.count})
                                    </span>
                                )}
                            </div>
                        </li>
                    )}
                    renderInput={(params) => (
                        <TextField 
                            {...params}
                            placeholder="Filter by lemma"
                            sx={{ 
                                fontSize: '10px',
                                '& .MuiOutlinedInput-root': {
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: 'black',
                                        borderWidth: '1.5px'
                                    }
                                }
                            }}
                        />
                    )}
                />
            </div>

            <div className='legend-category-dropdown'>
                <InputLabel sx={{ fontSize: '13px' }}>Coloring:</InputLabel>
                <FormControl 
                    variant="standard"
                    sx={{ m: 1, 
                        minWidth: 100
                    }}
                    size="small">
                <Select
                    labelId="demo-select-small-label"
                    id="demo-select-small" 
                    sx={{
                        fontSize: "13px",
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
                    value={currentLgdAttr}
                    label="color-attribute"
                    onChange={handleCurrentLgdAttr}
                >
                    <MenuItem value={'Label'}>
                        {datasetName === 'gmb_data' ? 'Part-of-speech tags' : 
                         datasetName === 'topobert_data' ? 'Supersense Role' : 'Label'}
                    </MenuItem>
                    <MenuItem value={'Average-L2-norm'}>Average L2-norm</MenuItem>
                </Select>
                </FormControl>
            </div>
            {currentLgdAttr==='Label' && <DiscreteAttrValsPanel></DiscreteAttrValsPanel>}
            {currentLgdAttr==='Average-L2-norm' && <ColorMapPanel></ColorMapPanel>}
        </div> 
      )
}


// show discrete attribute values
function DiscreteAttrValsPanel(){
    const {legendInfo, setLegendInfo, selectedInstances, setSelectedInstances, datasetName, posTagInfo} = useAppStore();
    const [scaleMap, setScaleMap] = useState(null);
    const [hoveredIndex, setHoveredIndex] = useState(null);  
    const [clickSelectionName, SetClickSelectionName] = useState('initilizeFlag'); //records the selected category name. initilizeFlag will set to “null”

    // everytime selectedInstances update, send it back to backend to update the legend info
    useEffect(()=>{
        axios.post('/api/update_legend_info', {
            'selectedInstances': selectedInstances
        })
            .then(function(response){
            let newLegendInfo = response['data'];
            setLegendInfo(newLegendInfo);
            });
    }, [selectedInstances]);

    // clickSelectionName: 
    useEffect(()=>{
        if(clickSelectionName==="initilizeFlag"){return;}
        axios.post("/api/update_selectedinstances", {
            "clickSelectionName": clickSelectionName
        })
        .then(function(response){
            let new_selectedInstances = response['data'];
            setSelectedInstances(new_selectedInstances);
        });
    }, [clickSelectionName]);

    useEffect(()=>{
        if (!scaleMap && legendInfo && legendInfo.length > 0) {
            let max = d3.max(legendInfo, d => d.count);
            if (max !== undefined && max !== null) {
                let newScale = d3.scaleLinear().domain([0, max]).range([0, 50]);
                setScaleMap(() => newScale);
            }
        }
        let ismanualSelection = selectedInstances['startId']==='manual';
        let legendInfoString = JSON.stringify(legendInfo);
        let sortedLegendInfo = [...legendInfo].sort((a, b) => {
            let countA = (a.selectedNum!=0 && !ismanualSelection)? a.selectedNum*1000000: a.count; // order: if no selected nodes (or manual selection on the legend), sort them according to total num
            let countB = (b.selectedNum!=0 && !ismanualSelection)? b.selectedNum*1000000: b.count;
            return countB - countA; 
        });
        if(JSON.stringify(sortedLegendInfo)!==legendInfoString){
            setLegendInfo(sortedLegendInfo);
        }
    }, [legendInfo]);

    const handleMouseOver = (index) => {
        setHoveredIndex(index); // Set the index of the hovered item
    };

    const handleMouseOut = () => {
        setHoveredIndex(null); // Clear the hovered index
    };

    const handleClick = (name)=>{ // click on a category value
        SetClickSelectionName(clickSelectionName===name? "null":name);
    };

    // Make sure scaleMap and legendInfo are available before rendering
    if (!scaleMap || !legendInfo || legendInfo.length === 0) {
        return null; // Wait until the scaleMap and legendInfo are ready
    }

    return (
        <div className='discrete-attrs-container'>
        {
            legendInfo
            .map((legendItem, index) => (
                <Tooltip 
                    key={`tooltip-${legendItem['name']}`}
                    title={
                        datasetName==='gmb_data' ? (
                            <div style={{display:'flex', flexDirection:'column'}}>
                                <Typography variant='caption'>{posTagInfo?.[legendItem['name']] || 'POS tag'}</Typography>
                                <Typography variant='caption'>Count: {legendItem['count']}</Typography>
                            </div>
                        ) : (
                            legendItem.selectedNum===0? legendItem.count:`${legendItem.selectedNum}/${legendItem.count}`
                        )
                    }
                >
                    <div 
                        style={{backgroundColor: hoveredIndex === index || legendItem.selectedNum!==0? grey[200]: 'white'}}
                        onMouseOver={() => handleMouseOver(index)}
                        onMouseOut={handleMouseOut}
                        onClick={()=>handleClick(legendItem['name'])}
                        className='discrete-attr-container'
                    >
                        <div className='discrete-attr-value'>
                            <div className='color-box' style={{backgroundColor: legendItem['color']}}></div>
                            <Typography variant='body2' color={grey[800]} style={{fontSize:'12px'}}>{legendItem['name']}</Typography>
                        </div>
                    </div>  
                </Tooltip>
            ))
        }
        </div>
    )
      
}


function ColorMapPanel(){
    const svgRef = useRef(); // Reference for the SVG container

    useEffect(() => {
        const width = 400; 
        const height = 15;

        // Select the SVG element using the ref and set its dimensions
        const svg = d3.select(svgRef.current)
                    .attr("width", width)
                    .attr("height", height + 30); // Add space for the axis labels

        svg.selectAll("*").remove();

        // Add a scale for the colormap bar
        const scale = d3.scaleLinear()
                        .domain([0, 1]) // Values from 0 to 1
                        .range([0, width]); // Map to the width of the bar

        const gradient = svg.append("defs")
                            .append("linearGradient")
                            .attr("id", "colormap-gradient")
                            .attr("x1", "0%")
                            .attr("y1", "0%")
                            .attr("x2", "100%")
                            .attr("y2", "0%");

        const numStops = 100; // Number of stops for smooth gradient
        for (let i = 0; i <= numStops; i++) {
            const t = i / numStops;
            gradient.append("stop")
                    .attr("offset", `${t * 100}%`)
                    .attr("stop-color", d3.interpolateViridis(t));
        }
        // Add the colormap bar
        svg.append("rect")
            .attr("x", 0)
            .attr("y", 10)
            .attr("width", width)
            .attr("height", height)
            .style("fill", "url(#colormap-gradient)");

        // Add an axis to show the 0-1 range
        const axis = d3.axisBottom(scale)
                    .ticks(5) // Number of ticks
                    .tickFormat(d3.format(".1f")); // Format numbers to 1 decimal place

        // Add the axis to the SVG
        svg.append("g")
        .attr("transform", `translate(0, ${height + 10})`) // Position it below the bar
        .call(axis);
    }, []); // Empty dependency array to run this effect only once

  return <svg ref={svgRef}></svg>; // The SVG container
}
