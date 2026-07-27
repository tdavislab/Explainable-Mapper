import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';

import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import { useState, useEffect, useRef } from 'react';
import axios from "axios"; 
import { useAppStore } from '../store/useAppStore';
import { splitStringAtWordIndex, splitPerturbationSentence } from '../utils';
import ToggleButton from '@mui/material/ToggleButton';
import StyledToggleButtonGroup from '../UtilComponents/StyledToggleButtonGroup';
import { Typography } from '@mui/material';

export default function BasicTable() {
  const [tableData, setTableData] = useState({titles: [], rows: []});
  const [tableTitles, setTableTitles] = useState([]);
  const [tableRows, setTableRows] = useState([]); //  ['idx', 'word', 'label', 'sentence']
  const {selectedInstances, legendInfo, 
        haloInstances, 
        comparisonStatus, setComparisonStatus,
        perturbSentences, showPerturbation, setShowPerturbation, setPerturbSentences,
        perturbationFlags, setPerturbationFlags,
        perturbSentencesEdge, perturbationFlagsEdge,
        perturbSentencesPath, perturbationFlagsPath,
        perturbSentencesComparison, perturbationFlagsComparison,
        setPerturbSentencesEdge, setPerturbationFlagsEdge,
        setPerturbSentencesPath, setPerturbationFlagsPath,
        setPerturbSentencesComparison, setPerturbationFlagsComparison} = useAppStore(); // {"isCompare": false, "compareInstances": []}
  const datasetName = useAppStore((state) => state.datasetName);
  const [legendColorMap, setLegendColorMap] = useState({});
  
 

  // Toggle state
  const [toggleValue, setToggleValue] = useState('sharedNodes');

  // comparison states
  const [comparisonToggleValue, setComparisonToggleValue] = useState('focus');
  const [comparisonTableRows, setComparisonTableRowa] = useState([]); 

  const handleToggleChange = (event, newValue) => {
    if (newValue !== null) {
      setToggleValue(newValue);
      let rows = newValue === 'node1only' ? tableData.source_rows :
                 newValue === 'sharedNodes' ? tableData.rows :
                 tableData.target_rows;
      setTableRows(rows);
    }
  };

  const handleComparisonToggleChange = (event, newValue) => {
    if (newValue !== null) {
      setComparisonToggleValue(newValue);
      let rows = newValue === 'focus' ? tableData.rows : comparisonTableRows;
      setTableRows(rows);
    }
  }

  const handlePerturbationToggle = (event) => {
    setShowPerturbation(event.target.checked);
  };

  // Helper function to get perturbation data based on selection type and toggle state
  const getPerturbationData = (rowIndex) => {
    const originalRowIdx = rowIndex;
    
    if (selectedInstances['startId'] === 'mapper-edge') {
      // Edge: use toggleValue to determine which set to use
      const edgeType = toggleValue === 'node1only' ? 'source' : 
                      toggleValue === 'node2only' ? 'target' : 'shared';
      return {
        sentence: perturbSentencesEdge[edgeType]?.[originalRowIdx],
        hasPerturbation: perturbationFlagsEdge[edgeType]?.[originalRowIdx]
      };
    } else if (selectedInstances['startId'] === 'mapper-path') {
      // Path: backend now returns flat arrays aligned to table order
      return {
        sentence: perturbSentencesPath?.[originalRowIdx],
        hasPerturbation: perturbationFlagsPath?.[originalRowIdx]
      };
    } else if (comparisonStatus.isCompare) {
      // Comparison: use comparisonToggleValue to determine which set to use
      const comparisonType = comparisonToggleValue === 'focus' ? 'focus' : 'comparison';
      return {
        sentence: perturbSentencesComparison[comparisonType]?.[originalRowIdx],
        hasPerturbation: perturbationFlagsComparison[comparisonType]?.[originalRowIdx]
      };
    } else {
      // Node or Component: simple case
      return {
        sentence: perturbSentences?.[originalRowIdx],
        hasPerturbation: perturbationFlags?.[originalRowIdx]
      };
    }
  };


  useEffect(()=>{
    if(tableRows.length === 0){
      return;
    }
    // change the order of the rows based on the haloInstances, move the haloInstances to the top
    if(haloInstances.length === 0){
      return;
    }
    let haloInstanceRows = tableRows.filter(row => haloInstances.includes(parseInt(row[0]))); 
    let nonHaloInstanceRows = tableRows.filter(row => !haloInstances.includes(parseInt(row[0])));
    let newTableRows = haloInstanceRows.concat(nonHaloInstanceRows);
    setTableRows(newTableRows);
    
    // Reorder perturbation data arrays to match the reordered table rows
    if (selectedInstances['startId'] === 'mapper-edge') {
      // For edges, reorder each perturbation array
      const reorderArray = (originalArray) => {
        if (!originalArray || originalArray.length === 0) return originalArray;
        const haloIndices = tableRows.map((row, idx) => haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const nonHaloIndices = tableRows.map((row, idx) => !haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const reorderedIndices = haloIndices.concat(nonHaloIndices);
        return reorderedIndices.map(idx => originalArray[idx]);
      };
      
      Object.keys(perturbSentencesEdge).forEach(key => {
        if (perturbSentencesEdge[key]) {
          perturbSentencesEdge[key] = reorderArray(perturbSentencesEdge[key]);
        }
        if (perturbationFlagsEdge[key]) {
          perturbationFlagsEdge[key] = reorderArray(perturbationFlagsEdge[key]);
        }
      });
    } else if (selectedInstances['startId'] === 'mapper-path') {
      // For paths, reorder the flat arrays
      if (perturbSentencesPath && perturbSentencesPath.length > 0) {
        const haloIndices = tableRows.map((row, idx) => haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const nonHaloIndices = tableRows.map((row, idx) => !haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const reorderedIndices = haloIndices.concat(nonHaloIndices);
        setPerturbSentencesPath(reorderedIndices.map(idx => perturbSentencesPath[idx]));
        setPerturbationFlagsPath(reorderedIndices.map(idx => perturbationFlagsPath[idx]));
      }
    } else if (comparisonStatus.isCompare) {
      // For comparisons, reorder each perturbation array
      const reorderArray = (originalArray) => {
        if (!originalArray || originalArray.length === 0) return originalArray;
        const haloIndices = tableRows.map((row, idx) => haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const nonHaloIndices = tableRows.map((row, idx) => !haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const reorderedIndices = haloIndices.concat(nonHaloIndices);
        return reorderedIndices.map(idx => originalArray[idx]);
      };
      
      Object.keys(perturbSentencesComparison).forEach(key => {
        if (perturbSentencesComparison[key]) {
          perturbSentencesComparison[key] = reorderArray(perturbSentencesComparison[key]);
        }
        if (perturbationFlagsComparison[key]) {
          perturbationFlagsComparison[key] = reorderArray(perturbationFlagsComparison[key]);
        }
      });
    } else {
      // For nodes/components, reorder the simple arrays
      if (perturbSentences && perturbSentences.length > 0) {
        const haloIndices = tableRows.map((row, idx) => haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const nonHaloIndices = tableRows.map((row, idx) => !haloInstances.includes(parseInt(row[0])) ? idx : -1).filter(idx => idx !== -1);
        const reorderedIndices = haloIndices.concat(nonHaloIndices);
        setPerturbSentences(reorderedIndices.map(idx => perturbSentences[idx]));
        setPerturbationFlags(reorderedIndices.map(idx => perturbationFlags[idx]));
      }
    }
  }, [haloInstances]);    


  useEffect(()=>{
    if(comparisonStatus.isCompare === false){
      return;
    }
    console.log('comparisonStatus:', comparisonStatus);
    axios.post('/api/comparison_table_details', {
      "comparisonInstances": comparisonStatus.compareInstances
    })
    .then(function (response) {
      let data = response.data;
      setComparisonTableRowa(data.rows);
      // setTableRows(data.rows);
      setComparisonToggleValue('focus');
    })
    .catch(function (error) {
      console.log(error);
    }); 
  }, [comparisonStatus]);


  useEffect(()=>{
    if(selectedInstances['instances'].length === 0){
      setTableData({titles: [], rows: []});
      return;
    }
    axios.post('/api/selected_table_details', {
      "selectedInstancesObj": selectedInstances
    })
    .then(function (response) {
      let data = response.data;
      // for "mapper-edge": {'titles': titles, 'rows': rows, 'source_rows': source_rows, 'target_rows': target_rows}
      // for others: {'titles': titles, 'rows': rows}
      setTableData(data);
      setTableTitles(data.titles);
      setTableRows(data.rows);
      setToggleValue('sharedNodes');
    })
    .catch(function (error) {
      console.log(error);
    });

  }, [selectedInstances]);

  // Clear perturbation state when selection changes
  useEffect(() => {
    setPerturbSentences([]);
    setPerturbationFlags([]);
    setPerturbSentencesEdge({});
    setPerturbationFlagsEdge({});
    setPerturbSentencesPath([]);
    setPerturbationFlagsPath([]);
    setPerturbSentencesComparison({});
    setPerturbationFlagsComparison({});
    setShowPerturbation(false);
  }, [selectedInstances, setPerturbSentences, setPerturbationFlags, 
      setPerturbSentencesEdge, setPerturbationFlagsEdge,
      setPerturbSentencesPath, setPerturbationFlagsPath,
      setPerturbSentencesComparison, setPerturbationFlagsComparison,
      setShowPerturbation]);

  // derive the legend color map: name -> color
  useEffect(() => {
    // Transform legendInfo into a dictionary with name as key and color as value
    const colorMap = legendInfo.reduce((acc, item) => {
    acc[item.name] = item.color;
    return acc;
  }, {});
    setLegendColorMap(colorMap);
  }, [legendInfo]); 




  if (selectedInstances['instances'].length === 0) {
    return <></>;
  }

  const displayTitles = (tableTitles || []).map((title) => {
    if (title === 'label' && datasetName === 'gmb_data') {
      return 'POS';
    }
    return title;
  });

  return (
    <div className="selection-details-div">
      <Typography variant="subtitle2" className='selection-details-subtitle'>Selected Instances</Typography>
      <Paper sx={{ 
        width: '100%', 
        overflow: 'hidden', 
        border: '0px solid #e0e0e0', 
        borderRadius: '5px', 
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }} elevation={1}>
        {selectedInstances['startId'] === 'mapper-edge' && (
          <StyledToggleButtonGroup
            size="small"
            value={toggleValue}
            exclusive
            onChange={handleToggleChange}
            sx={{
              display: 'flex',
              justifyContent: 'left', // Center horizontally
              alignItems: 'center', // Center vertically
            }}
            >
            <ToggleButton value="node1only">
              Node 1 Only
            </ToggleButton>
            <ToggleButton value="sharedNodes">
              Shared Nodes
            </ToggleButton>
            <ToggleButton value="node2only">
              Node 2 Only
            </ToggleButton>
          </StyledToggleButtonGroup>
        )}
        {/** Comparison Toggle */}
        {comparisonStatus.isCompare && comparisonStatus.compareInstances.length > 0 && (
          <StyledToggleButtonGroup
            size="small"
            value={comparisonToggleValue}
            exclusive
            onChange={handleComparisonToggleChange}
            sx={{
              display: 'flex',
              justifyContent: 'left', // Center horizontally
              alignItems: 'center', // Center vertically
            }}
          >
            <ToggleButton value="focus">
              Focus
            </ToggleButton>
            <ToggleButton value="comparison">
              Comparison
            </ToggleButton>
          </StyledToggleButtonGroup>
        )}

        <TableContainer sx={{ 
          overflow: 'auto',
          maxHeight: 'calc(100vh - 450px)', // Scroll when many rows; otherwise shrink to content
        }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                { 
                  (displayTitles || []).map((title, idx) => (
                    (idx === 0 || idx === 1) ? null : <TableCell 
                      sx={{ padding: '5px', fontWeight: 600 }} 
                      align={idx === 4 ? 'center' : 'left'}   
                      key={idx}>{title}</TableCell>
                  ))
                }
              </TableRow>
            </TableHead>
            <TableBody>
              {(tableRows || [])
                .map((row, rowIdx) => {
                  const perturbationData = getPerturbationData(rowIdx);
                  const perturbationSentence = showPerturbation ? perturbationData.sentence : null;
                  const hasPerturbation = perturbationData.hasPerturbation;
                  
                  return (
                    <React.Fragment key={rowIdx}>
                      <TableRow
                        sx={{ 
                          '&:last-child td, &:last-child th': { border: 0 },
                          borderLeft: `2px ${legendColorMap[row[3]]} solid`,
                          boxSizing: 'border-box',
                          backgroundColor: haloInstances.includes(parseInt(row[0])) ? '#f0f0f0' : 'inherit'
                        }}
                      >
                        { 
                          (row || []).map((col, idx) => {
                            if (idx === 0 || idx === 1) { return null; }
                            if (idx === 4) {
                              let wordId = parseInt(row[1]) - 1;
                              let label = row[3];
                              let sentence = row[4];
                              let { beforeT, tWord, afterT } = splitStringAtWordIndex(sentence, wordId); 
                              return (
                                <TableCell 
                                  key={`${rowIdx}-${idx}`}
                                  sx={{ padding: '0px 5px' }} align="left"
                                >
                                  <span>{beforeT}</span>&nbsp;
                                  <span style={{
                                    fontWeight: 800, 
                                    border: `2px solid ${legendColorMap[label]}`,
                                    borderRadius: '3px',
                                    padding: '1px 3px'
                                  }}>{tWord}</span>&nbsp;
                                  <span>{afterT}</span>
                                </TableCell>
                              );
                            } else if (idx === 3) {
                              return <TableCell 
                                key={`${rowIdx}-${idx}`}
                                sx={{ padding: '0px 5px' }} align="left">{col}
                              </TableCell>
                            } else {
                              return <TableCell 
                                key={`${rowIdx}-${idx}`}
                                sx={{ padding: '0px 5px' }} 
                                align="left">{col}</TableCell>
                            }
                          })
                        }
                      </TableRow>
                      {perturbationSentence && (
                        <TableRow
                          sx={{ 
                            backgroundColor: '#f8f9fa',
                            borderLeft: `2px #6c757d solid`,
                            '&:last-child td, &:last-child th': { border: 0 },
                          }}
                        >
                          <TableCell 
                            colSpan={displayTitles.length - 2} // Span all columns except idx and word_id
                            sx={{ 
                              padding: '8px 5px',
                              fontStyle: 'italic',
                              color: '#6c757d',
                              fontSize: '0.9em'
                            }} 
                            align="left"
                          >
                            {(() => {
                              if (!hasPerturbation) {
                                return (
                                  <span style={{ color: '#999', fontStyle: 'italic' }}>
                                    <strong>No perturbation available</strong> - using original sentence
                                  </span>
                                );
                              } else {
                                const { beforeT, tWord, afterT } = splitPerturbationSentence(perturbationSentence);
                                const label = row[3]; // Use the same label as the original row
                                return (
                                  <>
                                    <strong>Perturbation:</strong> 
                                    <span>{beforeT}</span>
                                    {tWord && (
                                      <>
                                        &nbsp;
                                        <span style={{
                                          fontWeight: 800, 
                                          border: `2px solid ${legendColorMap[label]}`,
                                          borderRadius: '3px',
                                          padding: '1px 3px'
                                        }}>{tWord}</span>
                                        &nbsp;
                                      </>
                                    )}
                                    <span>{afterT}</span>
                                  </>
                                );
                              }
                            })()}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px' }}>
          {(() => {
            // Check if perturbation data exists for current selection type
            if (selectedInstances['startId'] === 'mapper-edge') {
              return perturbSentencesEdge && Object.keys(perturbSentencesEdge).length > 0;
            } else if (selectedInstances['startId'] === 'mapper-path') {
              return perturbSentencesPath && perturbSentencesPath.length > 0;
            } else if (comparisonStatus.isCompare) {
              return perturbSentencesComparison && Object.keys(perturbSentencesComparison).length > 0;
            } else {
              return perturbSentences && perturbSentences.length > 0;
            }
          })() && (
            <FormControlLabel 
              control={
                <Checkbox 
                  sx={{ transform: 'scale(0.8)', padding: 0 }}
                  checked={showPerturbation}
                  onChange={handlePerturbationToggle}
                />
              }
              label="Show Perturbation"
              sx={{
                '.MuiFormControlLabel-label': { fontSize: '13px' },
                margin: 0,
              }}
            />
          )}
          <Typography variant="body2" color="textSecondary" style={{ fontSize: '12px' }}>
            {tableRows.length} items
          </Typography>
        </div>
      </Paper>
    </div>
  );
}