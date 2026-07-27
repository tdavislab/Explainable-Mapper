import { styled } from '@mui/material/styles';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { toggleButtonGroupClasses } from '@mui/material/ToggleButtonGroup';



const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    [`& .${toggleButtonGroupClasses.grouped}`]: {
      marginBottom: theme.spacing(0.3),
      border: 0,
      paddingTop: 0.5,
      paddingBottom: 0.5,
      borderRadius: theme.shape.borderRadius,
      fontSize: '12px',
      [`&.${toggleButtonGroupClasses.disabled}`]: {
        border: 0,
      },
    },
    [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]:
      {
        marginLeft: -1,
        borderLeft: '1px solid transparent',
      },
  }));

export default StyledToggleButtonGroup;