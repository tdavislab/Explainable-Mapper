import * as React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '@mui/material/styles';
import MuiAccordion from '@mui/material/Accordion';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import '../index.css';
import './SideBar.css'
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { blueGrey, grey } from '@mui/material/colors';
import { Button } from '@mui/material';
import { mapperGraph } from '../App';
import { useAppStore } from '../store/useAppStore';
import MapperParas from './MapperParas';
import SelectedDistributionPlot from './SelectedDistributionPlot';
import ComparisonDistributionPlot from './ComparisonDistributionPlot';
import KeywordsExplanation from './KeywordsExplanation';
import BasicTable from './Table';
import TrajectoryExploration from './TrajectoryExploration';

const Accordion = styled(MuiAccordion)(({ theme }) => ({
  borderTop: `1px solid rgb(18, 18, 18)`,
  "&::before": { 
    display: "none",
    backgroundColor: theme.palette.divider,
    height: "1px",
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: "0 0 5px 0",
  overflowY: "auto",
}));


const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0)', 
  margin: '0px',
  minHeight: 30,
  maxHeight: 30,
  '&.MuiButtonBase-root': {  
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiAccordionSummary-content': {
    display: 'flex',
    alignItems: 'center',
    '&.Mui-expanded': {
      minHeight: 30,
      maxHeight: 30,
    },
  },
}));

const blueGreyTheme = createTheme({
  palette: {
    primary: {
      main: blueGrey[700],
    },
    secondary: {
      main: grey[700],
    },
  },
});


export default function SideBar() {
  return (
    <>
      <Accordion disableGutters elevation={0} sx={{ borderTop: '0px' }}> 
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          id="panel-mapperPara"
          sx={{ outerHeight: '0px' }}
        >
         <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Mapper Parameters</Typography>          
        </AccordionSummary>
        <AccordionDetails disableGutters>
        <MapperParas></MapperParas>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters elevation={0} defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          id="panel3-selected-data"
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Selection Explanation</Typography>  
        </AccordionSummary>
        <AccordionDetails disableGutters>
          <SelectionDetails></SelectionDetails>
        </AccordionDetails>
      </Accordion>
    </>
  );
}


const SelectionDetails = () => {
  const { selectedInstances, comparisonStatus, setComparisonStatus } = useAppStore();

  const handleComparisonClick = () => {
    let isComparison = comparisonStatus['isCompare']; 
    let newComparisonStatus = {"isCompare": !isComparison, "compareInstances":[]};
    mapperGraph.updateComparisonMode(newComparisonStatus);
    setComparisonStatus(newComparisonStatus);
  };

  const showCompareButton = selectedInstances['startId'] === 'mapper-node' || selectedInstances['startId'] === 'mapper-component';
  const showExplanation = selectedInstances['startId'] && selectedInstances['startId'].startsWith('mapper-');

  return selectedInstances['instances'].length === 0 ? null : (
    <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'middle',  marginBottom: '5px', width: '100%' }}>
      <ThemeProvider theme={blueGreyTheme}>
        {showCompareButton && (
          <Button
            variant="outlined"
            color={comparisonStatus['isCompare'] ? "error" : "primary"}
            size="small"
            onClick={handleComparisonClick}
            startIcon={comparisonStatus['isCompare'] ? null : <AddIcon />}
            sx={{ fontSize: '0.7rem', padding: '2px 6px' }}
          >
            {comparisonStatus['isCompare'] ? "Cancel" : "Compare"}
          </Button>
        )}
      </ThemeProvider>
      </div>
    <div className='selection-details-container'>
      {comparisonStatus['isCompare'] && comparisonStatus['compareInstances'].length > 0 ? (
        <ComparisonDistributionPlot 
          selectedInstances={selectedInstances}
          comparisonStatus={comparisonStatus}
        />
      ) : (
        <SelectedDistributionPlot />
      )}
      {showExplanation && <KeywordsExplanation />}
      <BasicTable />

      {(selectedInstances['startId'] === 'mapper-node')&&(comparisonStatus['isCompare'])&&comparisonStatus['compareInstances'].length > 0
      ? <TrajectoryExploration 
            selectedInstances={selectedInstances}
            comparisonStatus={comparisonStatus}
             />  : null}
    </div>
    </>
  );
}
