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
import { max } from 'd3';

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
            barThickness: 6, // Thinner bars for more compact look
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
                autoSkip: false, // Don't skip any labels
                maxRotation: 0, // Keep labels horizontal
                minRotation: 0,
                font: {
                    size: 10 // Smaller font for more compact look
                },
                padding: 2, // Reduce padding between ticks
                callback: function(value, index, values) {
                    // Ensure all labels are shown
                    return this.getLabelForValue(value);
                }
            }
        }
    }
}

export default function SelectedDistributionPlot() {
    const { selectedInstances, legendInfo } = useAppStore();
    const datasetName = useAppStore((state) => state.datasetName);
    const [distributionData, setDistributionData] = useState(null);
    const [selectedAttribute, setSelectedAttribute] = useState('Label');
    const [availableAttributes, setAvailableAttributes] = useState(['Label']);
    
    const [distributionAttr, setDistributionAttr] = useState('top-tokens'); // Default value
    
    // Calculate dynamic height based on number of items
    const getChartHeight = () => {
        if (!distributionData || !distributionData.labels) return 150;
        const numItems = distributionData.labels.length;
        // Each item needs about 18px height for compact spacing
        const calculatedHeight = Math.max(150, Math.min(300, numItems * 18 + 30));
        return calculatedHeight;
    };

    // Fetch selected distribution data based on selected instances and distribution attribute
    useEffect(() => {        
        if (selectedInstances.length === 0) {
            return;
        }
        axios.post('/api/selected_distribution', {
            "distributionAttr": distributionAttr, 
            "selectedInstances": selectedInstances
        })
            .then(function (response) {
                setDistributionData(response.data);
            });
    }
    , [selectedInstances, distributionAttr]);

    return (
        <div className='distribution-plot-container selection-details-div'>
            <div>
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
            {distributionData && distributionData.labels && distributionData.data ? (
                <div className='single-distribution-plot' style={{ height: `${getChartHeight()}px` }}>
                    <Bar data={{
                        labels: distributionData.labels,
                        datasets: [{
                            data: distributionData.data,
                            backgroundColor: 'grey',
                            borderColor: 'grey',
                            borderWidth: 0,
                            barThickness: 6,
                        }]
                    }} options={barOptions} />
                </div>
            ) : (
                <div className='single-distribution-plot' style={{ height: '150px' }}>
                    <Bar data={{
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: 'grey',
                            borderColor: 'grey',
                            borderWidth: 0,
                            barThickness: 6,
                        }]
                    }} options={barOptions} />
                </div>
            )}
        </div>
    );
}
