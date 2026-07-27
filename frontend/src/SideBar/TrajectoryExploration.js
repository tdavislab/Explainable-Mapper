import { Typography, Select, MenuItem, FormControl, InputLabel, Button, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import axios from "axios";
import { splitStringAtWordIndex } from "../utils";
import { TableContainer } from "@mui/material";
import Textarea from '@mui/joy/Textarea';
import {mapperGraph} from '../App';
import PerturbationTable from "./InteractiveTable";
import { useAppStore } from '../store/useAppStore';

const normalizeTrajectorySentence = (s) => {
    if (Array.isArray(s)) return { sentence: s, pos: -1, focusword: '' };
    if (s && Array.isArray(s.sentence)) return s;
    if (s && Array.isArray(s.toks)) return { sentence: s.toks, pos: s.pos ?? -1, focusword: s.focusword ?? '', edit_spans: s.edit_spans || [] };
    if (typeof s === 'string') return { sentence: s.split(' '), pos: -1, focusword: '' };
    return { sentence: [], pos: -1, focusword: '' };
};

export default function TrajectoryExploration({selectedInstances, comparisonStatus}) {
    const [sourceNodeSentences, setSourceNodeSentences] = useState([]);
    const [targetNodeSentences, setTargetNodeSentences] = useState([]);
    const [sourceSentenceId, setSourceSentenceId] = useState(0);
    const [targetSentenceId, setTargetSentenceId] = useState(0);
    const [perturbationTrajectory, setPerturbationTrajectory] = useState({sentences: [], summary: ''}); 
    const [hasGeneratedTrajectory, setHasGeneratedTrajectory] = useState(false);
    const [isGeneratingTrajectory, setIsGeneratingTrajectory] = useState(false);
    const [trajectoryError, setTrajectoryError] = useState('');
    const [isHighlightingChanges, setIsHighlightingChanges] = useState(false);
    const [highlightError, setHighlightError] = useState('');
    const [isAttached, setIsAttached] = useState(false);
    const [isAttaching, setIsAttaching] = useState(false);
    const [attachError, setAttachError] = useState('');
    const setPerturbPoints = useAppStore((state) => state.setPerturbPoints);
    const setSelectedPerturbPoints = useAppStore((state) => state.setSelectedPerturbPoints);
    const selectedPerturbPoints = useAppStore((state) => state.selectedPerturbPoints);

    const handleSourceChange = (event) => {
        setSourceSentenceId(event.target.value);
    };

    const handleTargetChange = (event) => {
        setTargetSentenceId(event.target.value);
    };

    const sentenceObjToMarkedString = (sentenceObj) => {
        const words = Array.isArray(sentenceObj.sentence)
            ? [...sentenceObj.sentence]
            : (typeof sentenceObj.sentence === 'string' ? sentenceObj.sentence.split(' ') : []);
        const pos = Number.isInteger(sentenceObj.pos) ? sentenceObj.pos : -1;
        const focusword = sentenceObj.focusword || words[pos] || '';
        if (pos >= 0 && pos < words.length && focusword) {
            words[pos] = `[${focusword}]`;
        }
        return words.join(' ');
    };

    const clearEditSpans = (sentences) => sentences.map((sentence) => ({
        ...sentence,
        edit_spans: [],
    }));

    const handleHighlightChanges = async () => {
        setIsHighlightingChanges(true);
        setHighlightError('');
        try {
            const currentSentences = perturbationTrajectory.sentences.map(sentenceObjToMarkedString);
            const response = await axios.post('/api/trajectory_edit_spans', {
                sentences: currentSentences,
            });
            const spansBySentenceIndex = new Map(
                (response.data.results || []).map((result) => [result.sentence_index, result.edited_spans || []])
            );
            setPerturbationTrajectory((prev) => ({
                ...prev,
                sentences: prev.sentences.map((sentence, index) => ({
                    ...sentence,
                    edit_spans: spansBySentenceIndex.get(index) || [],
                })),
            }));
        } catch (error) {
            setHighlightError(error.response?.data?.error || 'Failed to highlight changes.');
        } finally {
            setIsHighlightingChanges(false);
        }
    };

    const handleGenerateTrajectory = async () => {
        if (
            isGeneratingTrajectory ||
            sourceNodeSentences.length === 0 ||
            targetNodeSentences.length === 0
        ) {
            return;
        }

        setIsGeneratingTrajectory(true);
        setTrajectoryError('');
        setIsAttached(false);
        setAttachError('');
        try {
            const response = await axios.post('/api/perturbation_trajectory', {
                sourceSentenceId: sourceNodeSentences[sourceSentenceId][0],
                targetSentenceId: targetNodeSentences[targetSentenceId][0],
            });
            const data = response.data || { sentences: [], summary: '' };
            const normalized = (data.sentences || []).map(normalizeTrajectorySentence);
            setPerturbationTrajectory({ sentences: normalized, summary: data.summary || '' });
            setHasGeneratedTrajectory(true);
            setHighlightError('');
            setSelectedPerturbPoints([]);
            setPerturbPoints([]);
            mapperGraph.dehighlightPerturbNodes();
            mapperGraph.deattachPerturbationLine(setSelectedPerturbPoints);
        } catch (error) {
            setTrajectoryError(error.response?.data?.error || 'Failed to generate trajectory.');
        } finally {
            setIsGeneratingTrajectory(false);
        }
    };

    useEffect(() => {
        if (selectedInstances.instances.length === 0) {
            return;
        }
        // compute the ordered soource sentences from backend
        axios.post('/api/sorted_instances', {
            "selectedInstances": selectedInstances.instances,
            "useNodeId": false
        })
        .then(function (response) {
            setSourceNodeSentences(response.data.rows);
        });
    }
    , [selectedInstances]);

    useEffect(() => {
        if (comparisonStatus.compareInstances.length === 0) {
            return;
        }
        // compute the ordered target sentences
        axios.post('/api/sorted_instances', {
            "selectedInstances": comparisonStatus.compareInstances,
            "useNodeId": true
        })
        .then(function (response) {
            setTargetNodeSentences(response.data.rows);
        });
    }
    , [comparisonStatus]);

    const handleAttachClick = async () => {
        if (isAttaching || perturbationTrajectory.sentences.length === 0) {
            return;
        }

        if (isAttached) {
            mapperGraph.dehighlightPerturbNodes();
            mapperGraph.deattachPerturbationLine(setSelectedPerturbPoints);
            setSelectedPerturbPoints([]);
            setPerturbPoints([]);
            setIsAttached(false);
            setAttachError('');
            return;
        }

        setIsAttaching(true);
        setAttachError('');
        try {
            const response = await axios.post('/api/attach_perturb_project_mapper', {
                sentenceObjs: perturbationTrajectory.sentences,
                sourceNodeId: selectedInstances.nodeId,
                targetNodeId: comparisonStatus.compareInstances[0],
            });
            setPerturbPoints(response.data.project);
            mapperGraph.attachPerturbationLine(response.data.mapper, setSelectedPerturbPoints);
            setIsAttached(true);
        } catch (error) {
            setAttachError(error.response?.data?.error || 'Failed to attach trajectory.');
        } finally {
            setIsAttaching(false);
        }
    };

    const canGenerate =
        sourceNodeSentences.length > 0 &&
        targetNodeSentences.length > 0 &&
        !isGeneratingTrajectory;

    return (
        <div className="selection-details-div">
            <Typography variant="subtitle2" className="selection-details-subtitle">
                Trajectory Exploration
            </Typography>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    paddingTop: "10px",
                    gap: "15px",
                    flexDirection: "column",
                }}
            >
                <FormControl size="small" disabled={isGeneratingTrajectory}>
                    <InputLabel
                        id="source-sentence-label"
                        sx={{ backgroundColor: "white", padding: "0px 2px" }}
                    >
                        Source sentence
                    </InputLabel>
                    <Select
                        labelId="source-sentence-label"
                        value={sourceSentenceId}
                        onChange={handleSourceChange}
                    >
                        {sourceNodeSentences.map((row, idx) => {
                            let wordId = parseInt(row[1]) - 1;
                            let sentence = row[4];
                            let { beforeT, tWord, afterT } = splitStringAtWordIndex(sentence, wordId); // Assuming row[5] is wordId
                            return (
                                <MenuItem key={idx} value={idx}>
                                    <span>{beforeT}</span>&nbsp;
                                    <span style={{ fontWeight: 800}}>{tWord}</span>&nbsp;
                                    <span>{afterT}</span>
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>

                <FormControl size="small" disabled={isGeneratingTrajectory}>
                    <InputLabel
                        id="target-sentence-label"
                        sx={{ backgroundColor: "white", padding: "0px 2px" }}
                    >
                        Target sentence
                    </InputLabel>
                    <Select
                        labelId="target-sentence-label"
                        value={targetSentenceId}
                        onChange={handleTargetChange}
                    >
                        {targetNodeSentences.map((row, idx) => {
                            let wordId = parseInt(row[1]) - 1;
                            let sentence = row[4];
                            let { beforeT, tWord, afterT } = splitStringAtWordIndex(sentence, wordId); // Assuming row[5] is wordId
                            return (
                                <MenuItem key={idx} value={idx}>
                                    <span>{beforeT}</span>&nbsp;
                                    <span style={{ fontWeight: 800 }}>{tWord}</span>&nbsp;
                                    <span>{afterT}</span>
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>

                <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateTrajectory}
                    disabled={!canGenerate}
                    startIcon={isGeneratingTrajectory ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ width: "300px", marginTop: "-10px" }}
                >
                    {isGeneratingTrajectory
                        ? "Generating trajectory..."
                        : hasGeneratedTrajectory
                            ? "Regenerate"
                            : "Create Perturbation Trajectory"}
                </Button>
                {trajectoryError && (
                    <Typography variant="caption" color="error">
                        {trajectoryError}
                    </Typography>
                )}
            </div>

            {isGeneratingTrajectory && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" style={{ marginLeft: '10px' }}>
                        Computing perturbation trajectory...
                    </Typography>
                </div>
            )}
            
            {/* Display the perturbation table and explanation */}
            {!isGeneratingTrajectory && perturbationTrajectory.sentences.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <TableContainer>
                <PerturbationTable
                    sentences={perturbationTrajectory.sentences}
                    setSentences={(newSentences) =>
                    setPerturbationTrajectory(prev => ({ ...prev, sentences: clearEditSpans(newSentences) }))
                    }
                    selectedPerturbPoints={selectedPerturbPoints}
                    setSelectedPerturbPoints={setSelectedPerturbPoints}
                />
                </TableContainer>

                <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleHighlightChanges}
                        disabled={isHighlightingChanges || isAttaching || perturbationTrajectory.sentences.length < 2}
                        startIcon={isHighlightingChanges ? <CircularProgress size={14} color="inherit" /> : null}
                        sx={{ width: "220px" }}
                    >
                        {isHighlightingChanges ? "Highlighting..." : "Highlight Changes"}
                    </Button>
                    {isHighlightingChanges && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" style={{ marginLeft: '8px' }}>
                                Detecting edits with LLM...
                            </Typography>
                        </div>
                    )}
                    {highlightError && (
                        <Typography variant="caption" color="error">
                            {highlightError}
                        </Typography>
                    )}
                </div>

                <Textarea
                    color="neutral"
                    disabled={true}
                    size="sm"
                    variant={"outlined"}
                    value={perturbationTrajectory.summary}
                    style={{
                        width: '100%',
                        color: 'rgba(0, 0, 0, 0.87)', // Darker text for disabled mode
                        maxHeight: '200px',
                    }}
                />

                    {/* Attach and Save Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '15px' }}>
                    <Button
                        size="small"
                        variant="contained"
                        color={isAttached ? "secondary" : "primary"}
                        title={isAttached ? "Deattach from the projection and mapper" : "Attach to the projection and mapper"}
                        onClick={handleAttachClick}
                        disabled={isAttaching || isHighlightingChanges}
                        startIcon={isAttaching ? <CircularProgress size={14} color="inherit" /> : null}
                    >
                        {isAttaching ? "Attaching..." : isAttached ? "Deattach" : "Attach"}
                    </Button>
                    {attachError && (
                        <Typography variant="caption" color="error">
                            {attachError}
                        </Typography>
                    )}
                </div>

            </div>
            )}
        </div>
    );
}
