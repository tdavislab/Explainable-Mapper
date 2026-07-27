import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';

async function loadDatasetContext({ timestamp, layer, setDatasetName, setPosTagInfo, setLegendInfo, setMeanL2Range }) {
  const datasetInfoResponse = await axios.post('/api/dataset_info', {});
  const datasetName = datasetInfoResponse.data?.DATASET_NAME || 'unknown';
  setDatasetName(datasetName);

  if (datasetName === 'gmb_data') {
    const posInfoResponse = await axios.post('/api/pos_tags_info', {});
    setPosTagInfo(posInfoResponse.data || {});
  } else {
    setPosTagInfo({});
  }

  const legendResponse = await axios.post('/api/legend_info', {});
  setLegendInfo(legendResponse.data);

  const dataUpdateResponse = await axios.post('/api/update_data', {
    name: timestamp,
    layer: layer
  });
  setMeanL2Range(dataUpdateResponse.data);
}

// Create the Zustand store
export const useAppStore = create(
  devtools(
    (set, get) => ({
      // ===== DATASET STATE =====
      timestamp: 413,
      layer: 12,
      layout: 'ForceDirected',
      DRmethod: 'PCA',
      datasetName: 'unknown',
      posTagInfo: {},

      // ===== LEGEND STATE =====
      legendInfo: [],
      currentLgdAttr: 'Label',
      meanL2Range: { "min_L2": 0, "max_L2": 1 },

      // ===== SELECTION STATE =====
      selectedInstances: { "instances": [], "startId": "" },
      viewMode: 'null',
      haloInstances: [],
      comparisonStatus: { "isCompare": false, "compareInstances": [] },

      // ===== PERTURBATION STATE =====
      perturbPoints: [],
      selectedPerturbPoints: [],
      perturbSentences: [],
      perturbSentencesEdge: {},
      perturbSentencesPath: [],
      perturbSentencesComparison: {},
      perturbationFlags: [],
      perturbationFlagsEdge: {},
      perturbationFlagsPath: [],
      perturbationFlagsComparison: {},
      showPerturbation: false,

      // ===== UPDATE SIGNALS =====
      dataSwitchSignal: false,
      mapperUpd: true,
      projectionUpd: true,

      // ===== VISUAL ENCODING STATE =====
      nodeSizeAttr: 'instance-count',
      edgeWidthAttr: 'none',

      // ===== LOADING STATE =====
      loading: true,
      loadingAttr: true,

      // ===== MAPPER STATE =====
      mapperType: 'classicalMapper',
      epsValue: 0.40,
      ballEpsValue: 0.40,

      // ===== ACTIONS =====
      setTimestamp: (timestamp) => set({ timestamp }),
      setLayer: (layer) => set({ layer }),
      setLayout: (layout) => set({ layout }),
      setDRmethod: (DRmethod) => set({ DRmethod }),
      setDatasetName: (datasetName) => set({ datasetName }),
      setPosTagInfo: (posTagInfo) => set({ posTagInfo }),
      resetDatasetState: () => set({ 
        layout: 'ForceDirected', 
        DRmethod: 'PCA' 
      }),

      setLegendInfo: (legendInfo) => set({ legendInfo }),
      setCurrentLgdAttr: (currentLgdAttr) => set({ currentLgdAttr }),
      setMeanL2Range: (meanL2Range) => set({ meanL2Range }),

      setSelectedInstances: (selectedInstances) => set({ selectedInstances }),
      setViewMode: (viewMode) => set({ viewMode }),
      setHaloInstances: (haloInstances) => set({ haloInstances }),
      setComparisonStatus: (comparisonStatus) => set({ comparisonStatus }),
      resetSelection: () => set({
        selectedInstances: { "instances": [], "startId": "" },
        viewMode: 'null',
        haloInstances: []
      }),
      toggleComparisonMode: () => set((state) => ({
        comparisonStatus: {
          "isCompare": !state.comparisonStatus.isCompare,
          "compareInstances": []
        }
      })),

      setPerturbPoints: (perturbPoints) => set({ perturbPoints }),
      setSelectedPerturbPoints: (selectedPerturbPoints) => set({ selectedPerturbPoints }),
      setPerturbSentences: (perturbSentences) => set({ perturbSentences }),
      setPerturbSentencesEdge: (perturbSentencesEdge) => set({ perturbSentencesEdge }),
      setPerturbSentencesPath: (perturbSentencesPath) => set({ perturbSentencesPath }),
      setPerturbSentencesComparison: (perturbSentencesComparison) => set({ perturbSentencesComparison }),
      setPerturbationFlags: (perturbationFlags) => set({ perturbationFlags }),
      setPerturbationFlagsEdge: (perturbationFlagsEdge) => set({ perturbationFlagsEdge }),
      setPerturbationFlagsPath: (perturbationFlagsPath) => set({ perturbationFlagsPath }),
      setPerturbationFlagsComparison: (perturbationFlagsComparison) => set({ perturbationFlagsComparison }),
      setShowPerturbation: (showPerturbation) => set({ showPerturbation }),

      setDataSwitchSignal: (dataSwitchSignal) => set({ dataSwitchSignal }),
      setMapperUpd: (mapperUpd) => set({ mapperUpd }),
      setProjectionUpd: (projectionUpd) => set({ projectionUpd }),
      triggerMapperUpdate: () => set((state) => ({ mapperUpd: !state.mapperUpd })),
      triggerProjectionUpdate: () => set((state) => ({ projectionUpd: !state.projectionUpd })),
      triggerBothUpdates: () => set((state) => ({ 
        mapperUpd: !state.mapperUpd, 
        projectionUpd: !state.projectionUpd 
      })),

      setNodeSizeAttr: (nodeSizeAttr) => set({ nodeSizeAttr }),
      setEdgeWidthAttr: (edgeWidthAttr) => set({ edgeWidthAttr }),

      setLoading: (loading) => set({ loading }),
      setLoadingAttr: (loadingAttr) => set({ loadingAttr }), 

      setMapperType: (mapperType) => set({ mapperType }),
      setEpsValue: (epsValue) => set({ epsValue }),
      setBallEpsValue: (ballEpsValue) => set({ ballEpsValue }),
      
      fetchInitialData: async () => {
        const { timestamp, layer, setLegendInfo, setMeanL2Range, setLoadingAttr, setDatasetName, setPosTagInfo } = get();
        setLoadingAttr(true);
        try {
          await loadDatasetContext({
            timestamp,
            layer,
            setDatasetName,
            setPosTagInfo,
            setLegendInfo,
            setMeanL2Range
          });
          setLoadingAttr(false);
        } catch (error) {
          console.error('Error fetching initial data:', error);
          setLoadingAttr(false);
        }
      },

      fetchDataOnSwitch: async () => {
        const { 
          timestamp, 
          layer, 
          setLegendInfo, 
          setMeanL2Range, 
          setLoading, 
          setDataSwitchSignal,
          resetSelection,
          resetDatasetState,
          triggerBothUpdates,
          setDatasetName,
          setPosTagInfo
        } = get();

        setLoading(true);
        setDataSwitchSignal(!get().dataSwitchSignal);
        
        try {
          resetSelection();
          resetDatasetState();
          await loadDatasetContext({
            timestamp,
            layer,
            setDatasetName,
            setPosTagInfo,
            setLegendInfo,
            setMeanL2Range
          });
          triggerBothUpdates();
          setLoading(false);
        } catch (error) {
          console.error('Error fetching data on switch:', error);
          setLoading(false);
        }
      },

      resetAllStates: () => {
        const { resetSelection, resetDatasetState, triggerBothUpdates } = get();
        resetSelection();
        resetDatasetState();
        triggerBothUpdates();
      }
    }),
    {
      name: 'app-store',
    }
  )
);
