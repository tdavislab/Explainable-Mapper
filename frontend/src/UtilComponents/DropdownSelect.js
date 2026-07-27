import React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

const DropdownSelect = ({ label, value, onChange, options, sx }) => {
  return (
    <div className='legend-category-dropdown'>
      <InputLabel sx={{ fontSize: '13px'}}>{label}</InputLabel>
      <FormControl
        variant="standard"
        sx={{
          m: 1,
          minWidth: 100,
          ...sx, // Allow custom styles to be passed
        }}
        size="small"
      >
        <Select
          labelId={`${label.toLowerCase().replace(/\s+/g, '-')}-label`}
          id={`${label.toLowerCase().replace(/\s+/g, '-')}`}
          sx={{
            fontSize: '13px',
            '& .MuiSelect-select': {
              padding: '2px 3px',
              borderBottom: '0px solid red',
            },
            '&:before': {
              borderWidth: '0px',
            },
            '&:after': {
              borderWidth: '0px',
            },
          }}
          value={value}
          onChange={onChange}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default DropdownSelect;