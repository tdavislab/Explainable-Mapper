import React, { useEffect, useState } from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAppStore } from '../store/useAppStore';
import axios from 'axios';

const DEFAULT_LAYER = 12;
const DATASET_KEY = 'topobert_data_bertbase';
const DATASET_LABEL = 'Finetuned-BERT-Base';

const DATASET_DESCRIPTION = (
  <div style={{ maxWidth: 320 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      Finetuned-BERT-Base
    </Typography>
    <Typography variant="caption" component="p" sx={{ display: 'block', mb: 0.75 }}>
      BERT-base fine-tuned for preposition supersense role (ss-role) classification,
      using the TopoBERT / STREUSLE setting.
    </Typography>
    <Typography variant="caption" component="p" sx={{ display: 'block', mb: 0.75 }}>
      Embeddings come from the fine-tuned checkpoint across model layers (1–12),
      so you can explore how semantic role structure evolves through the network.
    </Typography>
    <Typography variant="caption" component="p" sx={{ display: 'block' }}>
      Legend categories are supersense-role labels (e.g., Theme, Goal, Location).
    </Typography>
  </div>
);

const selectStyles = {
  '& .MuiSelect-select': { 
    padding: "2px 3px", 
    borderBottom: "0px solid red" 
  },
  "&:before": { borderWidth: "0px" },
  "&:after": { borderWidth: "0px" }
};

const formControlStyles = {
  minWidth: 50, 
  margin: "0 10px 0 2px"
};

function clampLayer(preferredLayer, totalLayers) {
  const maxLayer = Math.max(1, Number(totalLayers) || DEFAULT_LAYER);
  const layer = Number(preferredLayer) || DEFAULT_LAYER;
  return Math.min(Math.max(1, layer), maxLayer);
}

export default function Title() {
  const layer = useAppStore((state) => state.layer);
  const setLayer = useAppStore((state) => state.setLayer);
  const fetchDataOnSwitch = useAppStore((state) => state.fetchDataOnSwitch);
  const [totalLayers, setTotalLayers] = useState(DEFAULT_LAYER);
  const [datasetKey, setDatasetKey] = useState(DATASET_KEY);

  const handleLayerChange = async (event) => {
    const newLayer = event.target.value;
    setLayer(newLayer);
    // App.js reacts to layer changes via fetchDataOnSwitch -> /api/update_data.
  };

  useEffect(() => {
    const ensureDataset = async () => {
      try {
        const res = await axios.get('/api/datasets');
        const current = res.data.current || res.data.default;
        // Keep only Finetuned-BERT-Base visible; switch backend if needed.
        if (current !== DATASET_KEY) {
          await axios.post('/api/update_dataset', { dataset_key: DATASET_KEY });
          const { data } = await axios.get('/api/get_total_layers');
          const nextTotalLayers = data.total_layers;
          setTotalLayers(nextTotalLayers);
          const nextLayer = clampLayer(DEFAULT_LAYER, nextTotalLayers);
          const layerChanged = nextLayer !== layer;
          setLayer(nextLayer);
          if (!layerChanged) {
            await fetchDataOnSwitch();
          }
        } else {
          const layersRes = await axios.get('/api/get_total_layers');
          setTotalLayers(layersRes.data.total_layers);
        }
        setDatasetKey(DATASET_KEY);
      } catch (error) {
        console.error('Failed to initialize dataset:', error);
      }
    };
    ensureDataset();
  }, []);

  return (
    <div id="title">
      <InputLabel id="dataset-select-label">Dataset:</InputLabel>
      <FormControl
        variant="standard"
        sx={{ ...formControlStyles, margin: "0 10px 0 2px", minWidth: 170 }}
        size="small"
      >
        <Select
          labelId="dataset-select-label"
          id="dataset-select"
          sx={selectStyles}
          value={datasetKey}
          disabled
        >
          <MenuItem value={DATASET_KEY}>{DATASET_LABEL}</MenuItem>
        </Select>
      </FormControl>
      <Tooltip title={DATASET_DESCRIPTION} arrow placement="bottom-start">
        <InfoOutlinedIcon
          sx={{
            fontSize: 16,
            color: 'text.secondary',
            cursor: 'help',
            mr: 1,
            verticalAlign: 'middle'
          }}
        />
      </Tooltip>

      <InputLabel id="layer-select-label">Layer:</InputLabel>
      <FormControl
        variant="standard"
        sx={{ ...formControlStyles, margin: "0 0 0 2px" }}
        size="small"
      >
        <Select
          labelId="layer-select-label"
          id="layer-select"
          sx={selectStyles}
          value={layer}
          onChange={handleLayerChange}
        >
          {Array.from({ length: totalLayers }, (_, i) => i + 1).map((num) => (
            <MenuItem key={num} value={num}>{num}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}
