// PerturbationTable.jsx
import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableHead, TableBody, TableRow, TableCell, CircularProgress, Typography } from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import IconButton from '@mui/material/IconButton';
import axios from 'axios';

const columnHelper = createColumnHelper();

export default function PerturbationTable({
  sentences,
  setSentences,
  selectedPerturbPoints,
  setSelectedPerturbPoints,
}) {
  const [insertingRowIndex, setInsertingRowIndex] = useState(null);
  const [insertError, setInsertError] = useState('');

  const handleDelete = (index) => {
    if (insertingRowIndex !== null) return;
    const newData = [...sentences];
    newData.splice(index, 1);
    setSentences(newData);
  };

  const handleInsert = async (row) => {
    if (insertingRowIndex !== null) return;

    const getSentence = (index) => {
        const row_content = sentences[index] || {};
        let words = Array.isArray(row_content.sentence) ? row_content.sentence : (typeof row_content.sentence === 'string' ? row_content.sentence.split(' ') : []);
        const pos = Number.isInteger(row_content.pos) ? row_content.pos : -1;
        const focusword = row_content.focusword || '';
        if (pos >= 0 && pos < words.length && focusword) {
            words = words.slice(0, pos).concat(`[${focusword}]`).concat(words.slice(pos + 1));
        }
        return words.join(" ");
    }
    let src_sentence = getSentence(row.index);
    let tgt_sentence = getSentence(row.index + 1);

    setInsertingRowIndex(row.index);
    setInsertError('');
    try {
        const response = await axios.post('/api/insert_perturbation_trajectory', {
            "sourceSentence": src_sentence,
            "targetSentence": tgt_sentence
        });
        let new_sentences = response.data['sentences'];
        const newData = [...sentences];
        newData.splice(row.index + 1, 0, ...new_sentences);
        setSelectedPerturbPoints(
            new_sentences.map((_, i) => row.index + 1 + i)
        );
        setSentences(newData);
    } catch (error) {
        setInsertError(error.response?.data?.error || 'Failed to insert intermediate sentences.');
    } finally {
        setInsertingRowIndex(null);
    }
  };

const columns = [
    columnHelper.accessor('focusword', {
        header: 'Focus Word',
        cell: (info) => info.getValue(),
    }),
    {
        id: 'sentence',
        header: 'Sentence',
        cell: ({ row }) => {
            const { sentence, pos, edit_spans } = row.original;
            const words = Array.isArray(sentence) ? sentence : (typeof sentence === 'string' ? sentence.split(' ') : []);
            const isEditedToken = (idx) => (edit_spans || []).some((span) => {
                const start = Number(span.start_token);
                const end = Number(span.end_token);
                return idx >= start && idx <= end;
            });
            return words.map((word, idx) => (
                <React.Fragment key={idx}>
                    {idx === pos ? (
                        <strong
                            style={{
                                fontWeight: 800,
                                backgroundColor: isEditedToken(idx) ? '#fff59d' : 'transparent',
                                borderRadius: '3px',
                                padding: isEditedToken(idx) ? '0 2px' : 0,
                            }}
                        >
                            {word}
                        </strong>
                    ) : (
                        <span
                            style={{
                                backgroundColor: isEditedToken(idx) ? '#fff59d' : 'transparent',
                                borderRadius: '3px',
                                padding: isEditedToken(idx) ? '0 2px' : 0,
                            }}
                        >
                            {word}
                        </span>
                    )}
                    {idx < words.length - 1 ? ' ' : ''}
                </React.Fragment>
            ));
        },
    },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
            const isFirstRow = row.index === 0;
            const isLastRow = row.index === table.getRowModel().rows.length - 1;
            const isInsertingThisRow = insertingRowIndex === row.index;
            const isBusy = insertingRowIndex !== null;
            return isLastRow ? null : (
                <>
                    {isFirstRow ? (
                        <IconButton
                            size='small'
                            aria-hidden="true"
                            style={{ visibility: 'hidden' }}
                            disabled
                        >
                            <DeleteOutlinedIcon fontSize='10px' />
                        </IconButton>
                    ) : (
                        <IconButton
                            size='small'
                            onClick={() => handleDelete(row.index)}
                            aria-label="delete"
                            style={{ color: 'red' }}
                            disabled={isBusy}
                        >
                            <DeleteOutlinedIcon fontSize='10px' />
                        </IconButton>
                    )}
                    <IconButton
                        size='small'
                        onClick={() => handleInsert(row)}
                        aria-label="insert"
                        style={{ color: 'green' }}
                        disabled={isBusy}
                    >
                        {isInsertingThisRow
                            ? <CircularProgress size={14} color="inherit" />
                            : <AddOutlinedIcon fontSize='10px' />}
                    </IconButton>
                </>
            );
        },
    },
];

  const table = useReactTable({
    data: sentences,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {insertingRowIndex !== null && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 0' }}>
                <CircularProgress size={18} />
                <Typography variant="body2" style={{ marginLeft: '8px' }}>
                    Inserting intermediate sentences...
                </Typography>
            </div>
        )}
        {insertError && (
            <Typography variant="caption" color="error" style={{ textAlign: 'center' }}>
                {insertError}
            </Typography>
        )}
        <Table>
            <TableHead>
                {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                            <TableCell key={header.id} align="start" sx={{ padding: '0 2px', fontWeight:800}}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableHead>
            <TableBody>
                {table.getRowModel().rows.map((row, rowIndex) => (
                    <TableRow
                        key={row.id}
                        style={{
                            backgroundColor: 
                                rowIndex === 0 || rowIndex === table.getRowModel().rows.length - 1
                                    ? '#a9a9a9' // Dark grey background for first and last row
                                    : selectedPerturbPoints.includes(row.index)
                                    ? '#f0f0f0'
                                    : insertingRowIndex === row.index
                                    ? '#e8f5e9'
                                    : 'transparent',
                            opacity: insertingRowIndex !== null && insertingRowIndex !== row.index ? 0.65 : 1,
                        }}
                        onClick={() =>
                            setSelectedPerturbPoints(
                                selectedPerturbPoints.includes(row.index) ? [] : [row.index]
                            )
                        }
                    >
                        {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id} sx={{ padding: '0px 0px' }}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);
}
