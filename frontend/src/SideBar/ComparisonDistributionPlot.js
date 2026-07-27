import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import DropdownSelect from '../UtilComponents/DropdownSelect';
import { useAppStore } from '../store/useAppStore';
import { Typography } from '@mui/material';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

const barOptions = {
    indexAxis: 'y',
    elements: {
        bar: {
            borderWidth: 0,
            barThickness: 6,
            maxBarThickness: 6
        }
    },
    responsive: true,
    maintainAspectRatio: false,
    layout: {
        padding: {
            left: 5,
            right: 5,
            top: 5,
            bottom: 5
        }
    },
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        x: {
            grid: {
                color: 'rgba(0, 0, 0, 0)'
            }
        },
        y: {
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
                display: true,
                autoSkip: false,
                maxRotation: 0,
                minRotation: 0,
                font: {
                    size: 10
                },
                padding: 2,
                callback: function(value, index, values) {
                    return this.getLabelForValue(value);
                }
            }
        }
    }
};

export default function ComparisonDistributionPlot({ selectedInstances, comparisonStatus }) {
    const datasetName = useAppStore((state) => state.datasetName);
    const [focusDistributionData, setFocusDistributionData] = useState(null);
    const [comparisonDistributionData, setComparisonDistributionData] = useState(null);
    const [distributionAttr, setDistributionAttr] = useState('top-tokens');

    // Calculate dynamic height based on number of items
    const getChartHeight = (data) => {
        if (!data || !data.labels) return 150;
        const numItems = data.labels.length;
        const calculatedHeight = Math.max(150, Math.min(300, numItems * 18 + 30));
        return calculatedHeight;
    };

    // Fetch focus distribution data
    useEffect(() => {
        if (!selectedInstances || selectedInstances.instances.length === 0) {
            setFocusDistributionData(null);
            return;
        }

        axios.post('/api/selected_distribution', {
            "distributionAttr": distributionAttr,
            "selectedInstances": selectedInstances
        })
        .then(function (response) {
            setFocusDistributionData(response.data);
        })
        .catch(function (error) {
            console.error('Error fetching focus distribution:', error);
            setFocusDistributionData(null);
        });
    }, [selectedInstances, distributionAttr]);

    // Fetch comparison distribution data
    useEffect(() => {
        if (!comparisonStatus || !comparisonStatus.isCompare || comparisonStatus.compareInstances.length === 0) {
            setComparisonDistributionData(null);
            return;
        }

        axios.post('/api/comparison_distribution', {
            "distributionAttr": distributionAttr,
            "selectedNodeIdLst": comparisonStatus.compareInstances
        })
        .then(function (response) {
            setComparisonDistributionData(response.data);
        })
        .catch(function (error) {
            console.error('Error fetching comparison distribution:', error);
            setComparisonDistributionData(null);
        });
    }, [comparisonStatus, distributionAttr]);

    // Don't render if not in comparison mode
    if (!comparisonStatus || !comparisonStatus.isCompare || comparisonStatus.compareInstances.length === 0) {
        return null;
    }

    const focusHeight = getChartHeight(focusDistributionData);
    const comparisonHeight = getChartHeight(comparisonDistributionData);
    const maxHeight = Math.max(focusHeight, comparisonHeight);

    return (
        <div className='comparison-distribution-plot-container selection-details-div'>
            <div style={{ marginBottom: '10px' }}>
                <DropdownSelect
                    label={''}
                    options={[
                        { value: 'top-tokens', label: 'Distribution of Top Words' },
                        { value: 'top-labels', label: datasetName === 'gmb_data' ? 'Distribution of Top POS tags' : 'Distribution of Top Labels' },
                    ]}
                    value={distributionAttr}
                    onChange={(e) => setDistributionAttr(e.target.value)}
                />
            </div>
            
            <div className='dual-distribution-plots' style={{ height: `${maxHeight}px` }}>
                {/* Focus Distribution */}
                <div className='focus-distribution-plot' style={{ height: '100%' }}>
                    <Typography variant="subtitle2" style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>
                        Focus
                    </Typography>
                    {focusDistributionData && focusDistributionData.labels && focusDistributionData.data ? (
                        <Bar data={{
                            labels: focusDistributionData.labels,
                            datasets: [{
                                data: focusDistributionData.data,
                                backgroundColor: 'grey',
                                borderColor: 'grey',
                                borderWidth: 0,
                                barThickness: 6,
                            }]
                        }} options={barOptions} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography variant="body2" color="textSecondary">
                                No data
                            </Typography>
                        </div>
                    )}
                </div>

                {/* Comparison Distribution */}
                <div className='comparison-distribution-plot' style={{ height: '100%' }}>
                    <Typography variant="subtitle2" style={{ fontSize: '12px', marginBottom: '5px', textAlign: 'center' }}>
                        Comparison
                    </Typography>
                    {comparisonDistributionData && comparisonDistributionData.labels && comparisonDistributionData.data ? (
                        <Bar data={{
                            labels: comparisonDistributionData.labels,
                            datasets: [{
                                data: comparisonDistributionData.data,
                                backgroundColor: 'grey',
                                borderColor: 'grey',
                                borderWidth: 0,
                                barThickness: 6,
                            }]
                        }} options={barOptions} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography variant="body2" color="textSecondary">
                                No data
                            </Typography>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
