import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import { Button } from '@mui/material';
import axios  from 'axios';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

// toggle 
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {
  toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import { grey, blueGrey } from '@mui/material/colors';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import StyledToggleButtonGroup from '../UtilComponents/StyledToggleButtonGroup';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const blueGreyTheme = createTheme({
  palette: {
    primary: {
      main: blueGrey[300], // Replace with your desired color (e.g., orange)
    },
    secondary: {
      main: blueGrey[200], // Optional: Customize the secondary color
    },
  },
});


const options = {
  responsive: true,
  scales: {
    x: {
      title: {
        display: true,
        text: 'Id',  // Set your x-axis title here
      },
    },
    y: {
      title: {
        display: true,
        text: 'Distance',  // Set your y-axis title here
      },
      beginAtZero: true,
    },
  }
};


const ParaSlider = ({label, step, min, max, value, setValue, 
                      addEpsHelper, handleEpsGraph}) => { 
  const handleChange = (_, newValue) => {
    if (typeof newValue === 'number') {
      setValue(newValue);
    }
  };

  return (
    <Box>
      <Typography id="non-linear-slider" variant='subtitle2' color={grey[800]}>
        {label}: {value}      
        {addEpsHelper? <>
          <IconButton size='small' aria-label="delete" onClick={handleEpsGraph}>
            <AutoGraphIcon sx={{fontSize:"20px", color: blueGrey[500]}}/>
          </IconButton>
        </>:<></>}
      </Typography>
      <ThemeProvider theme={blueGreyTheme}>
      <Slider
        value={value}
        min={min}
        step={step}
        max={max}
        onChange={handleChange}
        valueLabelDisplay="auto"
        size='small'
      />
      </ThemeProvider>
    </Box>
  );
}

export default function MapperParas(){
    //  classical mapper paramters of eps
    const setEpsValue = useAppStore((state) => state.setEpsValue);
    const epsValue = useAppStore((state) => state.epsValue);
    // ball mapper parameters
    const ballEpsValue = useAppStore((state) => state.ballEpsValue);
    const setBallEpsValue = useAppStore((state) => state.setBallEpsValue);
    const setMapperType = useAppStore((state) => state.setMapperType);
    const mapperType = useAppStore((state) => state.mapperType);
    const setMapperUpd = useAppStore((state) => state.setMapperUpd);
    const mapperUpd = useAppStore((state) => state.mapperUpd);
    const dataSwitchSignal = useAppStore((state) => state.dataSwitchSignal);
    
    const [minPtsValue, setMinPtsValue] = useState(5);
    const [coverValue, setCoverValue] = useState(50);
    const [overlapValue, setOverlapValue] = useState(0.3);
    
    // the elbow chart
    const [showChart, setShowChart] = useState(false);
    const [chartData, setChartData] = useState(null);

    // Fetch mapper parameters from backend when dataset changes
    useEffect(() => {
        axios.post('/api/mapper_parameters', {})
            .then(function(response) {
                const params = response.data;
                setMinPtsValue(params.minPts_val || 3);
                setCoverValue(params.cover_num || 50);
                setOverlapValue(params.overlap_pct || 0.5);
            })
            .catch(function(error) {
                console.error('Error fetching mapper parameters:', error);
                // Keep default values on error
            });
    }, [dataSwitchSignal]); // Update when dataset switches

    const handleMapperType = (event, newMapperType) => {
      setMapperType(newMapperType);
    };
    
    const handleEpsGraph = async () => {
      console.log('click the graph and', minPtsValue);
      const response = await axios.post('/api/getminPtsLineChart', 
        {"minPtsValue": minPtsValue});
        setChartData({ ...response.data });
        setShowChart(true);
    };

    // compute the mapper in the backend
    const computeMapper = ()=>{ 
      let paras = mapperType==='classicalMapper'? {
        "mapperType": "classicalMapper",
        "epsValue": epsValue, 
        "minPtsValue": minPtsValue, 
        "coverValue": coverValue,
        "overlapValue": overlapValue
      }:{
        "mapperType": "ballMapper",
        "epsValue": epsValue,  
      }

      axios.post('/api/runMapper', paras)
      .then(function(response){
        setMapperUpd(!mapperUpd); // notify the mapper container to update the mapper
      })
      .catch(function (error) {
          console.log(error);
      });

    }

    return (
      <>
      <div>
      <Paper
        elevation={0}
        sx={(theme) => ({
          display: 'flex',
          // borderBottom: `1px solid ${theme.palette.divider}`,
          marginBottom: '10px',
          flexWrap: 'wrap'
        })}
      >
        <StyledToggleButtonGroup
          size="small"
          value={mapperType}
          exclusive
          onChange={handleMapperType}
        >
          <ToggleButton value="classicalMapper">
            Classical Mapper
          </ToggleButton>
          <ToggleButton value="ballMapper">
           Ball Mapper
          </ToggleButton>
        </StyledToggleButtonGroup>
      </Paper>
    </div>

    {mapperType==='classicalMapper'? 
    // classical mapper
    <>
    <Typography variant='body2' color={grey[900]} gutterBottom>
    Clustering: DBSCAN
    </Typography>
    <ParaSlider label={'minPts'} min={0} max={10} value={minPtsValue} setValue={setMinPtsValue} step={1} addEpsHelper={false}></ParaSlider>
    <ParaSlider
      label={'Epsilon'}
      min={0}
      max={30}
      value={Number(epsValue).toFixed(3)}
      setValue={setEpsValue}
      step={0.001}
      addEpsHelper={true}
      handleEpsGraph={handleEpsGraph}
      valueLabelFormat={v => Number(v).toFixed(3)}
    />
    {showChart && chartData? <Line data={chartData} options={options}/>:<></>}
    <Typography variant='body2' color={grey[900]} gutterBottom>
    Mapper parameter
    </Typography>
    <ParaSlider label={'Cover Number'} min={0} max={200} value={coverValue} setValue={setCoverValue} step={1} addEpsHelper={false}></ParaSlider>
    <ParaSlider label={'Cover Overlap'} min={0} max={1} value={overlapValue} setValue={setOverlapValue} step={0.01} addEpsHelper={false}></ParaSlider> 
    </> :
    // ball mapper
    <>
    <ParaSlider label={'Epsilon'} min={0} max={30} value={ballEpsValue} setValue={setBallEpsValue} step={0.01}></ParaSlider> 
    
    </>}

    <ThemeProvider theme={blueGreyTheme}>
    <Button variant="contained" disableElevation onClick={computeMapper} size='small'>
      Generate Mapper
    </Button>
    </ThemeProvider>
    </> 
    );
  }
