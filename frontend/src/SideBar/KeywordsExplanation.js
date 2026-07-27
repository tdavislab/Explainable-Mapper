/*the panel for disaplying the keywords and explanation */
import { grey,blueGrey } from "@mui/material/colors";
import Chip from '@mui/material/Chip';
import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';
import Button from '@mui/material/Button';
import { createTheme, Fab, ThemeProvider, CircularProgress } from "@mui/material";

import axios from 'axios';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Textarea from '@mui/joy/Textarea';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAppStore } from '../store/useAppStore';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const CONSISTENCY_METRICS = [
  {
    value: 'cosine_similarity',
    label: 'Cosine Similarity',
    tooltip: 'Cosine similarity between sentence-transformer embeddings of the original explanation and the perturbed explanation'
  },
  {
    value: 'bertscore',
    label: 'BERTScore',
    tooltip: 'BERTScore F1 between the original explanation and the perturbed explanation'
  }
];

export default function KeywordsExplanation(){
  const [originalSummary, setOriginalSummary] = useState(''); // original explanation
  const [perturbationSummary, setPerturbationSummary] = useState(''); // perturbed explanation
  const [LLMAsJudgeSummary, setLLMAsJudgeSummary] = useState(''); // LLM as a judge summary
  const [isRefreshing, setIsRefreshing] = useState(false) // whether the explanation is being refreshed
  const [activeKeywords, setActiveKeywords] = useState([]); 
  const [activeExplanation, setActiveExplanation] = useState('');
  const [lastKeywords, setLastKeywords] = useState([]);
  const [lastExplanation, setLastExplanation] = useState('');
  const [consistency, setConsistency] = useState(0);
  const [consistencyMetric, setConsistencyMetric] = useState('cosine_similarity');
  const [isLoading, setIsLoading] = useState(false); // loading state
  const {selectedInstances, 
          comparisonStatus, // {isCompare: false, compareInstances: []}
          setPerturbSentences, setPerturbationFlags,
          setPerturbSentencesEdge, setPerturbationFlagsEdge,
          setPerturbSentencesPath, setPerturbationFlagsPath,
          setPerturbSentencesComparison, setPerturbationFlagsComparison,
          layer
        } = useAppStore();
  const [isPerturbed, setIsPerturbed] = useState(false);  // how the perturbed explanation or original explanation
  const selectedConsistencyMetric = CONSISTENCY_METRICS.find(metric => metric.value === consistencyMetric) || CONSISTENCY_METRICS[0];
  
  // When selection changes, clear current explanation, do NOT auto-fetch
  useEffect(()=>{
    if(selectedInstances['instances'].length === 0){
      return;
    }
    setIsLoading(false);
    setOriginalSummary('');
    setPerturbationSummary('');
    setActiveKeywords([]);
    setActiveExplanation('');
    setLLMAsJudgeSummary('');
    // Clear perturbation data when selection changes
    setPerturbSentences([]);
    setPerturbationFlags([]);
    setPerturbSentencesEdge({});
    setPerturbationFlagsEdge({});
    setPerturbSentencesPath([]);
    setPerturbationFlagsPath([]);
    setPerturbSentencesComparison({});
    setPerturbationFlagsComparison({});
  }, [selectedInstances, setPerturbSentences, setPerturbationFlags, 
      setPerturbSentencesEdge, setPerturbationFlagsEdge,
      setPerturbSentencesPath, setPerturbationFlagsPath,
      setPerturbSentencesComparison, setPerturbationFlagsComparison]);

  // Do not auto-fetch on comparison changes; button will trigger fetch
  useEffect(() => {
    // When comparison node(s) become available, clear current explanation
    // so the overlay reappears with the comparison fetch button
    if (comparisonStatus.isCompare && comparisonStatus.compareInstances.length > 0) {
      setIsLoading(false);
      setOriginalSummary('');
      setPerturbationSummary('');
      setActiveKeywords([]);
      setActiveExplanation('');
      setLLMAsJudgeSummary('');
      setIsPerturbed(false);
    }
  }, [comparisonStatus]);

  // Clear explanations when layer changes
  useEffect(() => {
    setIsLoading(false);
    setOriginalSummary('');
    setPerturbationSummary('');
    setActiveKeywords([]);
    setActiveExplanation('');
    setLLMAsJudgeSummary('');
    setIsPerturbed(false);
    // Clear perturbation data when layer changes
    setPerturbSentences([]);
    setPerturbationFlags([]);
    setPerturbSentencesEdge({});
    setPerturbationFlagsEdge({});
    setPerturbSentencesPath([]);
    setPerturbationFlagsPath([]);
    setPerturbSentencesComparison({});
    setPerturbationFlagsComparison({});
  }, [layer, setPerturbSentences, setPerturbationFlags, 
      setPerturbSentencesEdge, setPerturbationFlagsEdge,
      setPerturbSentencesPath, setPerturbationFlagsPath,
      setPerturbSentencesComparison, setPerturbationFlagsComparison]);

  useEffect(() => {
    if (originalSummary === '' || perturbationSummary === '') {
      return;
    }
    let isCancelled = false;
    const recomputeConsistency = async () => {
      try {
        const response = await axios.post('/api/consistency_score', {
          "original_summary": originalSummary,
          "perturbation_summary": perturbationSummary,
          "consistency_metric": consistencyMetric
        });
        if (!isCancelled) {
          setConsistency(response.data['similarity_score']);
        }
      } catch (error) {
        console.error('Error recomputing consistency score:', error);
      }
    };
    setConsistency(0);
    recomputeConsistency();
    return () => {
      isCancelled = true;
    };
  }, [consistencyMetric, originalSummary, perturbationSummary]);

  useEffect(()=>{
    if(originalSummary === '' || perturbationSummary === ''){
      return;
    }
    if(isPerturbed){
      setActiveKeywords(perturbationSummary['keywords']);
      setActiveExplanation(perturbationSummary['summary']);
      setLastKeywords(perturbationSummary['keywords']);
      setLastExplanation(perturbationSummary['summary']);
    }else{
      setActiveKeywords(originalSummary['keywords']);
      setActiveExplanation(originalSummary['summary']);
      setLastKeywords(originalSummary['keywords']);
      setLastExplanation(originalSummary['summary']);
    }
  }
  , [isPerturbed]);

  const handleRefresh = async () => {
    if (selectedInstances['instances'].length === 0) {
      return;
    }
    
    setIsRefreshing(true);
    try {
      if (comparisonStatus.isCompare && comparisonStatus.compareInstances.length > 0) {
        await handleFetchComparison();
      } else {
        // Use refresh endpoint to generate fresh explanations
        await handleFetchFreshExplanation();
      }
    } catch (error) {
      console.log('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }

  const handleFetchFreshExplanation = async () => {
    if(selectedInstances['instances'].length === 0){
      return;
    }
    setIsLoading(true);
    try{
      const response = await axios.post('/api/refresh_explanation', {
        "selectedInstancesObj": selectedInstances,
        "consistency_metric": consistencyMetric
      });
      let data = response.data;
      let original_summary = data['original_summary'];
      let perturbation_summary = data['perturbation_summary'];
      let similarity_score = data['similarity_score']; 
      if (data['LLM_as_judge_summary']){
        setLLMAsJudgeSummary(data['LLM_as_judge_summary']);
      }
      // Store perturbation sentences globally if available
      if (data['perturb_sentences']) {
        if (selectedInstances['startId'] === 'mapper-edge') {
          setPerturbSentencesEdge(data['perturb_sentences']);
          setPerturbationFlagsEdge(data['perturbation_flags']);
        } else if (selectedInstances['startId'] === 'mapper-path') {
          setPerturbSentencesPath(data['perturb_sentences']);
          setPerturbationFlagsPath(data['perturbation_flags']);
        } else {
          // node or component
          setPerturbSentences(data['perturb_sentences']);
          setPerturbationFlags(data['perturbation_flags']);
        }
      }
      // Store perturbation flags globally if available
      if (data['perturbation_flags']) {
        // Already handled above based on startId
      }
      setIsPerturbed(false);
      setConsistency(similarity_score);
      setActiveKeywords(original_summary['keywords']);
      setActiveExplanation(original_summary['summary']);
      setOriginalSummary(original_summary);
      setPerturbationSummary(perturbation_summary);
      setLastKeywords(original_summary['keywords']);
      setLastExplanation(original_summary['summary']);
    } catch (error) {
      console.error('Error fetching fresh explanation:', error);
    } finally {
      setIsLoading(false);
    }
  }


  const blueGreyTheme = createTheme({
    palette: {
      primary: {
        main: blueGrey[500],
      }, 
      secondary: {
        main: '#ef5350',
      } 
    }
  });

  // when users click the "Show explanation" button, fetch the explanation
  const handleFetchExplanation = async () => {
    if(selectedInstances['instances'].length === 0){
      return;
    }
    setIsLoading(true);
    try{
      const response = await axios.post('/api/explanation', {
        "selectedInstancesObj": selectedInstances,
        "consistency_metric": consistencyMetric
      });
      let data = response.data;
      let original_summary = data['original_summary'];
      let perturbation_summary = data['perturbation_summary'];
      let similarity_score = data['similarity_score']; 
      if (data['LLM_as_judge_summary']){
        setLLMAsJudgeSummary(data['LLM_as_judge_summary']);
      }
      // Store perturbation sentences globally if available
      if (data['perturb_sentences']) {
        if (selectedInstances['startId'] === 'mapper-edge') {
          setPerturbSentencesEdge(data['perturb_sentences']);
          setPerturbationFlagsEdge(data['perturbation_flags']);
        } else if (selectedInstances['startId'] === 'mapper-path') {
          setPerturbSentencesPath(data['perturb_sentences']);
          setPerturbationFlagsPath(data['perturbation_flags']);
        } else {
          // node or component
          setPerturbSentences(data['perturb_sentences']);
          setPerturbationFlags(data['perturbation_flags']);
        }
      }
      // Store perturbation flags globally if available
      if (data['perturbation_flags']) {
        // Already handled above based on startId
      }
      setIsPerturbed(false);
      setConsistency(similarity_score);
      setActiveKeywords(original_summary['keywords']);
      setActiveExplanation(original_summary['summary']);
      setLastKeywords(original_summary['keywords']);
      setLastExplanation(original_summary['summary']); 
      setOriginalSummary(original_summary);
      setPerturbationSummary(perturbation_summary);
    }catch(error){
      console.log(error);
    }finally{
      setIsLoading(false);
    }
  };

  // when users click the "Show comparison explanation" button, fetch the comparison explanation
  const handleFetchComparison = async () => {
    if(comparisonStatus.isCompare===false || comparisonStatus.compareInstances.length === 0){
      return;
    }
    setIsLoading(true);
    try{
      const response = await axios.post('/api/comparison_explanation', { 
        "selectedInstances": selectedInstances.instances,
        "comparisonNodeIdLst": comparisonStatus.compareInstances,
        "consistency_metric": consistencyMetric
      });
      let data = response.data;
      let original_summary = data['original_summary'];
      let perturbation_summary = data['perturbation_summary'];
      let similarity_score = data['similarity_score']; 
      setIsPerturbed(false);
      setConsistency(similarity_score);
      setActiveKeywords(original_summary['keywords']);
      setActiveExplanation(original_summary['summary']);
      setLastKeywords(original_summary['keywords']);
      setLastExplanation(original_summary['summary']);
      setOriginalSummary(original_summary);
      setPerturbationSummary(perturbation_summary);
      // Store comparison perturbation data
      if (data['perturb_sentences']) {
        setPerturbSentencesComparison(data['perturb_sentences']);
        setPerturbationFlagsComparison(data['perturbation_flags']);
      }
    }catch(error){
      console.log(error);
    }finally{
      setIsLoading(false);
    }
  };

  const showOverlay = !isLoading && selectedInstances['instances'].length>0 && activeExplanation==='' && activeKeywords.length===0;

return (
  <div className="selection-details-div" style={{ position: 'relative' }}>
    <Typography variant="subtitle2" className='selection-details-subtitle' style={{ display: 'flex', alignItems: 'center' }}>
      LLM Explanation &nbsp;

      <ThemeProvider theme={blueGreyTheme}>
        <Tooltip title="Refresh explanation">
          <IconButton 
            size='small' 
            color="primary" 
            onClick={handleRefresh} 
            disabled={isLoading || isRefreshing || selectedInstances['instances'].length === 0}
          >
            <RefreshIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </ThemeProvider>
    </Typography>
    
    {showOverlay && (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        background: 'rgba(255,255,255,0.9)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '10px'
      }}>
        {comparisonStatus.isCompare && comparisonStatus.compareInstances.length>0 ? (
          <Button variant="contained" size="small" color="primary" onClick={handleFetchComparison} disabled={isLoading}>
            Show comparison explanation
          </Button>
        ) : (
          <Button variant="contained" size="small" color="primary" onClick={handleFetchExplanation} disabled={isLoading || selectedInstances['instances'].length===0}>
            Show explanation
          </Button>
        )}
      </div>
    )}

    {isLoading ? (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" style={{ marginLeft: '10px' }}>
          Loading explanation...
        </Typography>
      </div>
    ) : (
      <>
        <ThemeProvider theme={blueGreyTheme}>
          <div className="explain-keywords-div">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {activeKeywords
                .map((keyword, idx) => {
                  return (<Chip key={`kw_${idx}`}
                    size='small'
                    sx={{ borderRadius: '5px' }}
                    color="default"
                    label={keyword} />);
                })
              }
            </div>
          </div>
        </ThemeProvider>

        <Textarea
          color="neutral"
          disabled={true}
          size="sm"
          className="explain-text-div"
          variant="plain"
          value={activeExplanation}
          style={{
            width: '100%',
            color: 'rgba(0, 0, 0, 0.87)', // Darker text for disabled mode
            maxHeight: '200px',
          }}
        />
        {LLMAsJudgeSummary !== '' && (
          <div
            style={{
              width: '100%',
              maxHeight: '200px',
              overflowY: 'auto',
              color: 'rgba(0, 0, 0, 0.87)',
              fontSize: '12px',
              fontFamily: 'monospace',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '5px',
              padding: '5px',
              marginTop: '5px',
              whiteSpace: 'pre-wrap',
              boxSizing: 'border-box'
            }}
          >LLM as a judge summary:
            {LLMAsJudgeSummary}
          </div>
        )}
         <div className="row-div" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', padding: '0px 5px' }}>
          <Typography variant="caption" style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center'}}>
            Consistency (
            <select
              value={consistencyMetric}
              onChange={(event) => setConsistencyMetric(event.target.value)}
              disabled={isLoading || isRefreshing}
              style={{
                fontSize: '12px',
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: '0 2px',
                cursor: 'pointer'
              }}
            >
              {CONSISTENCY_METRICS.map(metric => (
                <option key={metric.value} value={metric.value}>{metric.label}</option>
              ))}
            </select>
            ): {consistency.toFixed(2)}
            <Tooltip title={selectedConsistencyMetric.tooltip}>
              <InfoOutlinedIcon sx={{fontSize:'16px', marginLeft: '3px', cursor: 'help'}} color="action" />
            </Tooltip>
            {consistency < 0.8 && (
              <Tooltip title="Low consistency, please check the instances">
                <WarningRoundedIcon sx={{fontSize:'20px'}} color="warning" style={{ marginLeft: '5px' }} />
              </Tooltip>
            )}
          </Typography> 

          <Typography 
            variant="caption" 
            style={{ fontWeight: 'normal', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setIsPerturbed(!isPerturbed)}
          >
            {isPerturbed ? 'Original Explanation' : 'Perturbed Explanation'}
          </Typography>
          
        </div>


      </>
    )}
  </div>
)

}