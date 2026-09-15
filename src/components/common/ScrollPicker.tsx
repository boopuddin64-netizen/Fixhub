import React from 'react';
import {
  WheelPicker,
  WheelPickerProps,
  WheelPickerOption,
  ScrollPickerItem,
  ScrollPickerProps,
  IOSWheelPicker,
} from './WheelPicker';

export {
  WheelPicker,
  IOSWheelPicker,
  type WheelPickerProps,
  type WheelPickerOption,
  type ScrollPickerItem,
  type ScrollPickerProps,
};

export const ScrollPicker: React.FC<ScrollPickerProps> = (props) => {
  return <WheelPicker {...props} />;
};
